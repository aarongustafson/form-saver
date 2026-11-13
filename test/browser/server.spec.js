import { request as httpRequest } from 'node:http';
import { test, expect } from '@playwright/test';

test('malformed request target returns 400 without terminating the preview', async ({
	request,
}) => {
	const status = await new Promise((resolve) => {
		const raw = httpRequest(
			{
				hostname: '127.0.0.1',
				port: Number(process.env.PORT || 4192),
				path: '//[',
				method: 'GET',
			},
			(response) => {
				response.resume();
				response.on('end', () => resolve(response.statusCode));
			},
		);
		raw.on('error', () => resolve(null));
		raw.end();
	});
	expect(status).toBe(400);
	expect((await request.get('/demo/index.html')).status()).toBe(200);
});
