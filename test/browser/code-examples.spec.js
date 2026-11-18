import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const root = new URL('../../', import.meta.url);
const distribution = new URL('node_modules/microlighter/dist/', root);
const cdn = 'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/';

async function serveDemo(
	page,
	{
		grammarFailure = false,
		stalledTheme = false,
		distinctFields = false,
	} = {},
) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: async (text) => {
					window.copiedSnippet = text;
				},
			},
		});
	});
	await page.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		let file;
		if (url.href.startsWith(cdn)) {
			if (stalledTheme && url.pathname.endsWith('.css')) return;
			if (grammarFailure && url.pathname.endsWith('/grammars/html.js'))
				return route.abort();
			if (url.pathname.endsWith('/micro-lighter-element.min.js')) {
				await page.locator('micro-lighter').evaluateAll((panels) => {
					for (const panel of panels)
						panel.dataset.authoredSnippet =
							panel.querySelector('code').textContent;
				});
			}
			file = new URL(url.href.slice(cdn.length), distribution);
		} else if (url.origin === 'http://code-demo.test') {
			if (url.pathname.split('/').some((part) => part.startsWith('.')))
				return route.abort();
			file = new URL(`.${url.pathname}`, root);
		} else {
			return route.abort();
		}
		let body;
		try {
			body = await readFile(file);
		} catch (error) {
			if (error.code === 'ENOENT' || error.code === 'EISDIR')
				return route.abort();
			throw error;
		}
		const extension = file.pathname.split('.').at(-1);
		if (extension === 'html' && url.pathname === '/demo/index.html') {
			// Older pilot demos also need an authored-mark upgrade fixture.
			body = body
				.toString()
				.replace(
					/(<pre\b[^>]*>\s*<code>)([\s\S]*?)(<\/code>)/,
					(match, start, code, end) =>
						code.includes('<mark>')
							? match
							: `${start}<mark>${code}</mark>${end}`,
				);
		}
		if (
			distinctFields &&
			extension === 'css' &&
			!url.href.startsWith(cdn)
		) {
			body = body
				.toString()
				.replace(/\bFieldText\b/g, 'rgb(255, 255, 0)')
				.replace(/\bField\b/g, 'rgb(20, 30, 40)');
		}
		await route.fulfill({
			body,
			contentType:
				{
					html: 'text/html',
					js: 'text/javascript',
					css: 'text/css',
					svg: 'image/svg+xml',
				}[extension] ?? 'application/octet-stream',
		});
	});
}

test('pinned highlighting preserves text and keyboard Copy includes the complete snippet', async ({
	page,
	browserName,
}) => {
	await serveDemo(page);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('http://code-demo.test/demo/index.html');
	await expect(page.locator('#microlighter-status')).toBeHidden();
	const panels = page.locator('micro-lighter');
	const examples = [panels.first()];
	const tabbed = page.locator('tabbed-interface').first();
	if (await tabbed.count()) {
		await expect(tabbed).toHaveAttribute('data-layout', 'tabs');
		await tabbed
			.getByRole('tab', { name: 'Installation', exact: true })
			.focus();
		await page.keyboard.press('Enter');
		examples.push(
			tabbed.locator('micro-lighter[language="javascript"]').first(),
		);
	}
	for (const panel of examples) {
		const code = panel.locator('pre > code');
		const original = await panel.getAttribute('data-authored-snippet');
		expect(original).not.toBeNull();
		await expect
			.poll(() =>
				code.evaluate((element) => {
					return (
						element.childNodes.length === 1 &&
						[...CSS.highlights.values()].some((highlight) =>
							[...highlight].some((range) =>
								element.contains(range.startContainer),
							),
						)
					);
				}),
			)
			.toBe(true);
		const button = panel.getByRole('button', { name: 'Copy', exact: true });
		await code.locator('..').focus();
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin'
				? 'Alt+Tab'
				: 'Tab',
		);
		await expect(button).toBeFocused();
		await page.keyboard.press('Enter');
		await expect
			.poll(() => page.evaluate(() => window.copiedSnippet))
			.toBe(original);
		await expect(code).toHaveText(original, { useInnerText: false });
	}
});

test('a failed grammar retains authored marks and reports the partial failure', async ({
	page,
}) => {
	await serveDemo(page, { grammarFailure: true });
	await page.goto('http://code-demo.test/demo/index.html');
	const code = page
		.locator('micro-lighter[language="html"] code:has(mark)')
		.first();
	await expect(page.locator('#microlighter-status')).toContainText(
		'Code remains readable and selectable',
	);
	await expect(code.locator('mark').first()).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => customElements.get('micro-lighter') === undefined,
			),
		)
		.toBe(true);
});

test('a stalled optional theme cannot gate the local demo or enhancement', async ({
	page,
}) => {
	await serveDemo(page, { stalledTheme: true });
	await page.goto('http://code-demo.test/demo/index.html', {
		waitUntil: 'domcontentloaded',
	});
	await expect(page.locator('main')).toBeVisible();
	await expect(
		page
			.locator('micro-lighter')
			.first()
			.getByRole('button', { name: 'Copy', exact: true }),
	).toBeVisible();
	await expect(page.locator('#microlighter-status')).toBeHidden();
});

test('loaded syntax styles respect distinct high-contrast field surfaces and inherited scheme', async ({
	page,
}) => {
	await serveDemo(page, { distinctFields: true });
	await page.emulateMedia({ contrast: 'more', colorScheme: 'dark' });
	await page.goto('http://code-demo.test/demo/index.html');
	await expect(page.locator('#microlighter-status')).toBeHidden();
	await expect(page.locator('link[data-code-theme]')).toHaveAttribute(
		'media',
		'all',
	);
	const code = page.locator('micro-lighter pre').first();
	await expect(code).toHaveCSS('background-color', 'rgb(20, 30, 40)');
	await expect(code).toHaveCSS('color', 'rgb(255, 255, 0)');
	await page.addStyleTag({ content: ':root { color-scheme: light; }' });
	await expect(page.locator('body')).toHaveCSS('color-scheme', 'light');
});

test('all heading levels use the shared monospace alias', async ({ page }) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	for (const heading of await page.locator('h1, h2, h3').all()) {
		if (
			await heading.evaluate(
				(element) =>
					Boolean(element.closest('.demo')) ||
					element.getRootNode() !== document,
			)
		)
			continue;
		await expect(heading).toHaveCSS('font-family', /system-monospace/);
	}
});
