import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		execArgv: ['--no-experimental-webstorage'],
		globals: true,
		setupFiles: ['./test/setup.js'],
	},
});
