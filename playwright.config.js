import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:${process.env.PORT || 4192}`;

export default defineConfig({
	testDir: './test/browser',
	workers: 1,
	use: { baseURL },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
	webServer: {
		command: 'node scripts/serve.js',
		url: `${baseURL}/demo/index.html`,
		reuseExistingServer: false,
	},
});
