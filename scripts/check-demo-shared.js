import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function sharedPath(root, file) {
	if (
		typeof file !== 'string' ||
		file
			.split('/')
			.some(
				(part) =>
					!/^[\w.-]+$/.test(part) || part === '.' || part === '..',
			)
	)
		throw new Error(`Invalid shared demo path: ${file}`);
	let path = root;
	for (const part of file.split('/')) {
		path = join(path, part);
		if (lstatSync(path).isSymbolicLink())
			throw new Error(`Shared demo path is a symbolic link: ${file}`);
	}
	if (!lstatSync(path).isFile())
		throw new Error(`Shared demo path is not a file: ${file}`);
	return path;
}

function snapshot(root) {
	const files = JSON.parse(
		readFileSync(sharedPath(root, 'demo/shared-files.json'), 'utf8'),
	);
	if (
		!Array.isArray(files) ||
		files.length === 0 ||
		new Set(files).size !== files.length
	) {
		throw new Error(
			'Shared demo allowlist must contain unique file paths.',
		);
	}
	return Object.fromEntries(
		files.map((file) => [
			file,
			createHash('sha256')
				.update(readFileSync(sharedPath(root, file)))
				.digest('hex'),
		]),
	);
}

export function checkSharedFiles(root) {
	const integrity = readFileSync(
		sharedPath(root, 'demo/shared-integrity.json'),
	);
	const expected = JSON.parse(integrity);
	const actual = snapshot(root);
	if (
		!expected ||
		Array.isArray(expected) ||
		Object.keys(expected).sort().join('\n') !==
			Object.keys(actual).sort().join('\n')
	)
		throw new Error(
			'Shared demo allowlist differs from the recorded snapshot.',
		);
	for (const [file, hash] of Object.entries(actual)) {
		if (expected[file] !== hash) {
			throw new Error(
				`Shared demo file differs from the starter snapshot: ${file}. Fix the starter source; do not patch consumer copies or integrity metadata.`,
			);
		}
	}
	let provenance;
	try {
		provenance = JSON.parse(
			readFileSync(sharedPath(root, 'demo/shared-source.json'), 'utf8'),
		);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	if (
		provenance !== undefined &&
		(!provenance ||
			typeof provenance !== 'object' ||
			Object.keys(provenance).sort().join('\n') !==
				'integrity\nrepository\nrevision' ||
			provenance.repository !== 'aarongustafson/web-component-starter' ||
			typeof provenance.revision !== 'string' ||
			!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(provenance.revision) ||
			provenance.integrity !==
				createHash('sha256').update(integrity).digest('hex'))
	)
		throw new Error(
			'Shared source provenance differs from the recorded snapshot. Review the source pin; do not edit metadata to bypass drift checks.',
		);
	return Object.keys(actual);
}

function recordSharedFiles(root) {
	const origin = execFileSync('git', ['remote', 'get-url', 'origin'], {
		cwd: root,
		encoding: 'utf8',
	}).trim();
	if (
		![
			'https://github.com/aarongustafson/web-component-starter.git',
			'https://github.com/aarongustafson/web-component-starter',
			'git@github.com:aarongustafson/web-component-starter.git',
			'ssh://git@github.com/aarongustafson/web-component-starter.git',
		].includes(origin)
	)
		throw new Error(
			'Only the canonical starter may record a shared demo snapshot.',
		);
	const target = join(root, 'demo/shared-integrity.json');
	// Refuse a redirected output before publishing generated integrity metadata.
	if (lstatSync(join(root, 'demo')).isSymbolicLink())
		throw new Error('Demo directory must not be a symbolic link.');
	try {
		if (!lstatSync(target).isFile())
			throw new Error('Shared demo snapshot must be an ordinary file.');
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	const data = snapshot(root);
	writeFileSync(target, `${JSON.stringify(data, null, '\t')}\n`, {
		flag: 'w',
	});
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const root = fileURLToPath(new URL('../', import.meta.url));
		const args = process.argv.slice(2);
		if (args.length === 1 && args[0] === '--record')
			recordSharedFiles(root);
		else if (args.length)
			throw new Error(
				'Use no arguments to check, or --record in the starter only.',
			);
		console.log(
			`Verified ${checkSharedFiles(root).length} shared demo files.`,
		);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
