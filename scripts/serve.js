import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
	'.css': 'text/css',
	'.html': 'text/html',
	'.js': 'text/javascript',
};
const runtime = new Set(['/define.js', '/index.js', '/form-saver.js']);

createServer(async (request, response) => {
	response.setHeader('Cache-Control', 'no-store');
	if (!['GET', 'HEAD'].includes(request.method)) {
		response.writeHead(405, { Allow: 'GET, HEAD' }).end();
		return;
	}
	const pathname = new URL(request.url, 'http://localhost').pathname;
	const path = resolve(root, `.${pathname}`);
	if (
		!path.startsWith(`${resolve(root)}${sep}`) ||
		(!pathname.startsWith('/demo/') && !runtime.has(pathname)) ||
		!types[extname(path)]
	) {
		response.writeHead(404).end();
		return;
	}
	try {
		const file = await stat(path);
		if (!file.isFile()) {
			response.writeHead(404).end();
			return;
		}
		response.writeHead(200, {
			'Content-Type': types[extname(path)],
			'Content-Length': file.size,
		});
		if (request.method === 'HEAD') response.end();
		else
			createReadStream(path)
				.on('error', () => response.destroy())
				.pipe(response);
	} catch (error) {
		response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
	}
}).listen(Number(process.env.PORT || 4192), '127.0.0.1');
