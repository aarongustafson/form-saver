import { readFile, readdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const root = new URL('../../', import.meta.url);
const distribution = new URL('node_modules/microlighter/dist/', root);
const cdn = 'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/';

async function serveDemo(
	page,
	{
		grammarFailure = false,
		stalledTheme = false,
		themeFailure = false,
		distinctFields = false,
		translucentFields = false,
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
			if (themeFailure && url.pathname.endsWith('.css'))
				return route.abort();
			if (grammarFailure && url.pathname.endsWith('/grammars/html.js'))
				return route.abort();
			if (url.pathname.endsWith('/micro-lighter-element.min.js')) {
				await page.locator('micro-lighter').evaluateAll((panels) => {
					panels[0].setAttribute('data-syntax-theme', 'github');
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
			(distinctFields || translucentFields) &&
			extension === 'css' &&
			!url.href.startsWith(cdn)
		) {
			body = body
				.toString()
				.replace(
					/\bFieldText\b/g,
					translucentFields ? '#ffffffd8' : 'rgb(255, 255, 0)',
				)
				.replace(
					/\bField\b/g,
					translucentFields ? '#ffffff3f' : 'rgb(20, 30, 40)',
				);
			if (translucentFields)
				body = body
					.replace(/\bCanvasText\b/g, '#ffffff')
					.replace(/\bCanvas\b/g, '#1e1e1e');
		}
		await route.fulfill({
			body,
			contentType:
				{
					html: 'text/html',
					js: 'text/javascript',
					css: 'text/css',
					json: 'application/json',
					svg: 'image/svg+xml',
				}[extension] ?? 'application/octet-stream',
		});
	});
}

test('decorative links adapt to the color scheme and disappear for contrast and print', async ({
	page,
}) => {
	await serveDemo(page);
	await page.goto('http://code-demo.test/demo/index.html');
	for (const colorScheme of ['light', 'dark']) {
		await page.emulateMedia({ colorScheme });
		const pattern = await page.locator('body').evaluate(async (body) => {
			const style = getComputedStyle(body, '::before');
			const mask = style.maskImage;
			if (mask === 'none')
				throw new Error('Missing decorative link mask.');
			const image = new Image();
			image.src = mask.slice(5, -2);
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);
			const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3];
			const probe = document.createElement('span');
			probe.style.color = 'CanvasText';
			body.append(probe);
			const canvasText = getComputedStyle(probe).color;
			probe.remove();
			return {
				opacity: style.opacity,
				color: style.backgroundColor,
				canvasText,
				image: style.backgroundImage,
				pointerEvents: style.pointerEvents,
				tile: style.maskSize,
				width: image.naturalWidth,
				height: image.naturalHeight,
				hole: alpha(32, 24),
				ribbon: alpha(12, 24),
				offsetHole: alpha(91, 48),
				offsetRibbon: alpha(71, 48),
			};
		});
		expect(pattern).toMatchObject({
			opacity: '0.02',
			color: pattern.canvasText,
			image: 'none',
			pointerEvents: 'none',
			tile: '88.5px 72px',
			width: 118,
			height: 96,
			hole: 0,
			ribbon: 255,
			offsetHole: 0,
			offsetRibbon: 255,
		});
	}
	for (const media of [
		{ contrast: 'more' },
		{ contrast: 'no-preference', forcedColors: 'active' },
		{ forcedColors: 'none', media: 'print' },
	]) {
		await page.emulateMedia(media);
		expect(
			await page
				.locator('body')
				.evaluate((body) => getComputedStyle(body, '::before').display),
		).toBe('none');
	}
});

test('reading sections inherit text color and leave their parent surface visible', async ({
	page,
}) => {
	const css = (
		await Promise.all(
			(await readdir(new URL('demo/', root)))
				.filter((file) => file.endsWith('.css'))
				.sort(
					(a, b) =>
						Number(a === 'demo-shell.css') -
						Number(b === 'demo-shell.css'),
				)
				.map((file) => readFile(new URL(`demo/${file}`, root), 'utf8')),
		)
	).join('\n');
	await page.setContent(`
		<style>${css}</style>
		<div id="reading-context" style="color: rgb(37, 71, 109); background: Canvas">
			<section class="demo-section"><h2>Example</h2><p>Reading content.</p></section>
			<aside class="api-reference"><h2>API</h2><p>Reference content.</p></aside>
		</div>
	`);
	for (const media of [
		{ colorScheme: 'light', media: 'screen' },
		{ colorScheme: 'dark' },
		{ media: 'print' },
	]) {
		await page.emulateMedia(media);
		const parentColor = await page
			.locator('#reading-context')
			.evaluate((element) => getComputedStyle(element).color);
		for (const selector of ['.demo-section', '.api-reference']) {
			await expect(page.locator(selector)).toHaveCSS(
				'color',
				parentColor,
			);
			await expect(page.locator(selector)).toHaveCSS(
				'background-image',
				'none',
			);
			await expect(page.locator(selector)).toHaveCSS(
				'background-color',
				/^rgba\(\d+, \d+, \d+, 0\)$/,
			);
		}
	}
});

const examples = [];
for (const file of (await readdir(new URL('demo/', root)))
	.filter((file) => file.endsWith('.html'))
	.sort()) {
	const html = await readFile(new URL(`demo/${file}`, root), 'utf8');
	const languages = new Set(
		[...html.matchAll(/<micro-lighter\b[^>]*\blanguage="([^"]+)"/g)].map(
			(match) => match[1],
		),
	);
	for (const language of languages) examples.push({ file, language });
}

test.describe('demo header spacing', () => {
	test.use({ javaScriptEnabled: false });

	for (const file of new Set(examples.map((example) => example.file))) {
		test(`${file}: content clears the header border without JavaScript`, async ({
			page,
		}) => {
			await serveDemo(page);
			await page.goto(`http://code-demo.test/demo/${file}`);
			for (const width of [320, 1400]) {
				await page.setViewportSize({ width, height: 900 });
				const gap = await page.locator('main').evaluate((main) => {
					const header = document.querySelector('body > header');
					const walker = document.createTreeWalker(
						main,
						NodeFilter.SHOW_TEXT,
					);
					let text;
					while ((text = walker.nextNode())) {
						if (!text.textContent.trim()) continue;
						const range = document.createRange();
						range.selectNodeContents(text);
						const rect = range.getBoundingClientRect();
						if (rect.width && rect.height) {
							return (
								rect.top - header.getBoundingClientRect().bottom
							);
						}
					}
					throw new Error('Demo has no visible main content.');
				});
				expect(gap, `${file} at ${width}px`).toBeGreaterThanOrEqual(32);
			}
		});
	}
});

for (const { file, language } of examples) {
	test(`${file}: ${language} highlighting preserves text and keyboard Copy includes the complete snippet`, async ({
		page,
		browserName,
	}) => {
		await serveDemo(page);
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.goto(`http://code-demo.test/demo/${file}`);
		await expect(page.locator('#microlighter-status')).toBeHidden();
		const panel = page
			.locator(`micro-lighter[language="${language}"]`)
			.first();
		if (!(await panel.isVisible())) {
			const installation = page.getByRole('tab', {
				name: 'Installation',
				exact: true,
			});
			await installation.focus();
			await page.keyboard.press('Enter');
		}
		await expect(panel).toBeVisible();
		const code = panel.locator('pre > code');
		const original = await panel.getAttribute('data-authored-snippet');
		expect(original).not.toBeNull();
		await expect
			.poll(() => code.evaluate((element) => element.childNodes.length))
			.toBe(1);
		if (language !== 'bash') {
			await expect
				.poll(() =>
					code.evaluate((element) =>
						[...CSS.highlights.values()].some((highlight) =>
							[...highlight].some((range) =>
								element.contains(range.startContainer),
							),
						),
					),
				)
				.toBe(true);
		}
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
	});
}

test('a failed optional theme reports only the missing theme while enhancement remains available', async ({
	page,
}) => {
	await serveDemo(page, { themeFailure: true });
	await page.goto('http://code-demo.test/demo/index.html');
	await expect(page.locator('#microlighter-status')).toContainText(
		'Code highlighting and Copy controls are available, but the syntax theme could not load.',
	);
	await expect(
		page
			.locator('micro-lighter')
			.first()
			.getByRole('button', { name: 'Copy', exact: true }),
	).toBeVisible();
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
	await page
		.locator('micro-lighter')
		.first()
		.evaluate((panel) => {
			panel.classList.remove('code-panel');
		});
	await expect(page.locator('micro-lighter').first()).toHaveCSS(
		'background-color',
		'rgb(20, 30, 40)',
	);
	await expect(code).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(code).toHaveCSS('color', 'rgb(255, 255, 0)');
	await expect(code).toHaveCSS('--syntax-keyword', 'rgb(255, 255, 0)');
	await page.addStyleTag({ content: ':root { color-scheme: light; }' });
	for (const scope of await page.locator('[data-syntax-theme]').all()) {
		await expect(scope).toHaveCSS('color-scheme', 'light');
	}
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

test('translucent high-contrast fields retain at least 4.5:1 composited code contrast', async ({
	page,
}) => {
	await serveDemo(page, { translucentFields: true });
	await page.emulateMedia({ contrast: 'more', colorScheme: 'dark' });
	await page.goto('http://code-demo.test/demo/index.html');
	await expect(page.locator('link[data-code-theme]')).toHaveAttribute(
		'media',
		'all',
	);
	const code = page.locator('micro-lighter pre code').first();
	await expect(
		page
			.locator('micro-lighter')
			.first()
			.getByRole('button', { name: 'Copy', exact: true }),
	).toBeVisible();
	for (const surface of [
		code,
		page
			.locator('micro-lighter')
			.first()
			.getByRole('button', { name: 'Copy', exact: true }),
	]) {
		const contrast = await surface.evaluate((element) => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			const context = canvas.getContext('2d');
			if (!context)
				throw new Error('Canvas color measurement is unavailable.');
			const ancestors = [];
			for (let node = element; node;) {
				ancestors.unshift(node);
				const tree = node.getRootNode();
				node =
					node.assignedSlot ||
					node.parentElement ||
					(tree instanceof ShadowRoot ? tree.host : null);
			}
			for (const node of ancestors) {
				const style = getComputedStyle(node);
				if (style.backgroundImage !== 'none')
					throw new Error(
						'The high-contrast fixture must have no background images.',
					);
				context.fillStyle = style.backgroundColor;
				context.fillRect(0, 0, 1, 1);
			}
			const background = context.getImageData(0, 0, 1, 1).data;
			if (background[3] !== 255)
				throw new Error('The measured code background must be opaque.');
			context.fillStyle = getComputedStyle(element).color;
			context.fillRect(0, 0, 1, 1);
			const foreground = context.getImageData(0, 0, 1, 1).data;
			const luminance = (rgb) =>
				[...rgb].slice(0, 3).reduce((sum, channel, index) => {
					const value = channel / 255;
					return (
						sum +
						(value <= 0.04045
							? value / 12.92
							: ((value + 0.055) / 1.055) ** 2.4) *
							[0.2126, 0.7152, 0.0722][index]
					);
				}, 0);
			const values = [luminance(background), luminance(foreground)].sort(
				(a, b) => b - a,
			);
			return (values[0] + 0.05) / (values[1] + 0.05);
		});
		expect(contrast).toBeGreaterThanOrEqual(4.5);
	}
});
