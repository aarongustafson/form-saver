import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

const css = await readFile(
	new URL('../../demo/styles.css', import.meta.url),
	'utf8',
);

for (const name of ['index', 'esm', 'unpkg']) {
	for (const mode of ['light', 'dark', 'forced']) {
		test(`${name}: marked code contrast, reflow, and keyboard scrolling (${mode})`, async ({
			page,
			browserName,
		}) => {
			test.skip(
				mode === 'forced' && browserName !== 'chromium',
				'Forced-color emulation is only supported by Chromium.',
			);
			await page.emulateMedia({
				colorScheme: mode === 'dark' ? 'dark' : 'light',
				forcedColors: mode === 'forced' ? 'active' : 'none',
			});
			const html = await readFile(
				new URL(`../../demo/${name}.html`, import.meta.url),
				'utf8',
			);
			await page.route('**/*', (route) => route.abort());
			await page.setContent(
				html.replace('</head>', `<style>${css}</style></head>`),
			);
			const marks = page.locator('pre code mark');
			expect(await marks.count()).toBeGreaterThan(0);
			const ratios = await marks.evaluateAll((elements) => {
				const luminance = (color) => {
					const channels = color
						.match(/[\d.]+/g)
						.slice(0, 3)
						.map(Number);
					return channels.reduce((sum, channel, index) => {
						const n = channel / 255;
						return (
							sum +
							(n <= 0.04045
								? n / 12.92
								: ((n + 0.055) / 1.055) ** 2.4) *
								[0.2126, 0.7152, 0.0722][index]
						);
					}, 0);
				};
				return elements.map((element) => {
					const style = getComputedStyle(element);
					const a = luminance(style.color);
					const b = luminance(style.backgroundColor);
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				});
			});
			for (const ratio of ratios)
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			for (const width of [1280, 320]) {
				await page.setViewportSize({ width, height: 800 });
				expect(
					await page.evaluate(
						() => document.documentElement.scrollWidth,
					),
				).toBeLessThanOrEqual(width);
				for (const pair of await page
					.locator('.code-demo-pair')
					.all()) {
					const code = await pair.locator('pre').boundingBox();
					const live = await pair.locator('.demo').boundingBox();
					if (width === 320)
						expect(live.y).toBeGreaterThanOrEqual(
							code.y + code.height,
						);
					else
						expect(live.x).toBeGreaterThanOrEqual(
							code.x + code.width,
						);
				}
			}
			for (const pre of await page.locator('pre').all()) {
				if (
					!(await pre.evaluate(
						(element) => element.scrollWidth > element.clientWidth,
					))
				)
					continue;
				await expect(pre).toHaveAttribute('tabindex', '0');
				await pre.scrollIntoViewIfNeeded();
				await pre.focus();
				await page.keyboard.press('Shift+Tab');
				await page.keyboard.press('Tab');
				await expect(pre).toBeFocused();
				await expect
					.poll(async () => {
						await page.keyboard.press('ArrowRight');
						return pre.evaluate((element) => element.scrollLeft);
					})
					.toBeGreaterThan(0);
			}
		});
	}
}
