import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
	expectNativeFocus,
	expectPairLayout,
	readDemoStyles,
	serveDemo,
} from './demo-fixture.js';

const root = new URL('../../', import.meta.url);

for (const [name, html] of [
	[
		'reordered attributes',
		'<link href="styles.css" rel="stylesheet"><link href="demo-shell.css" rel="stylesheet">',
	],
	[
		'single-quoted attributes',
		"<link rel='stylesheet' href='styles.css'><link rel='stylesheet' href='demo-shell.css'>",
	],
]) {
	test(`stylesheet extraction preserves order with ${name}`, async () => {
		const expected = await Promise.all(
			['styles.css', 'demo-shell.css'].map((file) =>
				readFile(new URL(`demo/${file}`, root), 'utf8'),
			),
		);
		expect(await readDemoStyles('index.html', html)).toBe(
			expected.join('\n'),
		);
	});
}

for (const colorScheme of ['light', 'dark']) {
	test(`${colorScheme}: header stays transparent and navigation links use their native minimum size`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		await expect(page.locator('body > header')).toHaveCSS(
			'background-color',
			'rgba(0, 0, 0, 0)',
		);
		const minimum = await page
			.locator('header nav a')
			.first()
			.evaluate((link) => {
				const actual = getComputedStyle(link).minBlockSize;
				const original = link.getAttribute('style');
				link.style.minBlockSize = 'revert';
				const native = getComputedStyle(link).minBlockSize;
				if (original === null) link.removeAttribute('style');
				else link.setAttribute('style', original);
				return { actual, native };
			});
		expect(minimum.actual).toBe(minimum.native);
	});

	test(`${colorScheme}: shared demo controls retain unclipped browser-native keyboard focus`, async ({
		page,
		browserName,
	}) => {
		await page.emulateMedia({ colorScheme });
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin'
				? 'Alt+Tab'
				: 'Tab',
		);
		await expect(page.locator('.skip-link')).toBeFocused();
		for (const control of [
			page.locator('.skip-link'),
			page.locator('header a').first(),
			page.locator('micro-lighter pre').first(),
			page.locator('micro-lighter').first().getByRole('button'),
		]) {
			await expectNativeFocus(control);
		}
		await expect(page.locator('.code-panel').first()).toHaveCSS(
			'outline-style',
			'none',
		);
	});
}

for (const mode of ['light', 'dark', 'forced colors']) {
	test(`${mode}: notes use a neutral Canvas surface with a left border`, async ({
		page,
	}) => {
		await page.emulateMedia({
			colorScheme: mode === 'dark' ? 'dark' : 'light',
			forcedColors: mode === 'forced colors' ? 'active' : 'none',
		});
		const css = await readDemoStyles();
		await page.setContent(`
			<style>${css}</style>
			<div class="demo-section">
				<aside class="note">Helpful context with <code>inline code</code>.</aside>
			</div>
			<span id="canvas" style="background: Canvas; color: CanvasText">Reference</span>
		`);
		const canvas = await page.locator('#canvas').evaluate((element) => {
			const style = getComputedStyle(element);
			return { background: style.backgroundColor, color: style.color };
		});
		const note = page.locator('.note');
		await expect(note).toHaveCSS('background-color', canvas.background);
		await expect(note).toHaveCSS('background-image', 'none');
		await expect(note).toHaveCSS('color', canvas.color);
		await expect(note).toHaveCSS('border-left-width', '4px');
		await expect(note).toHaveCSS('border-left-style', 'solid');
		await expect(note.locator('code')).toHaveCSS('color', canvas.color);
		await expect(note.locator('code')).toHaveCSS(
			'background-color',
			/^rgba\(\d+, \d+, \d+, 0\)$/,
		);
	});
}

test('decorative links adapt to the color scheme', async ({ page }) => {
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
});

for (const [mode, media] of [
	['more contrast', { contrast: 'more' }],
	['forced colors', { forcedColors: 'active' }],
	['print', { media: 'print' }],
]) {
	test(`${mode}: decorative links are hidden`, async ({ page }) => {
		await page.emulateMedia(media);
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		expect(
			await page
				.locator('body')
				.evaluate((body) => getComputedStyle(body, '::before').display),
		).toBe('none');
		await page.unrouteAll({ behavior: 'wait' });
	});
}

test('reading sections inherit text color and leave their parent surface visible', async ({
	page,
}) => {
	const css = await readDemoStyles();
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
const pages = JSON.parse(
	await readFile(new URL('demo/pages.json', root), 'utf8'),
);
const fullPages = Object.keys(pages)
	.filter((file) => pages[file] === 'full')
	.sort();
for (const file of fullPages) {
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

	for (const file of fullPages) {
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
			await expect(
				page.locator('micro-lighter code mark').first(),
			).toBeVisible();
			await expect(page.locator('#microlighter-status')).toBeHidden();
		});
	}
});

for (const file of fullPages) {
	test(`${file}: code pages and live pairs reflow without horizontal page overflow`, async ({
		page,
	}) => {
		await serveDemo(page);
		await page.goto(`http://code-demo.test/demo/${file}`);
		await expect(page.locator('#microlighter-status')).toBeHidden();
		for (const width of [320, 1400]) {
			await page.setViewportSize({ width, height: 900 });
			await expect
				.poll(
					() =>
						page.evaluate(
							() =>
								document.documentElement.scrollWidth <=
								window.innerWidth,
						),
					{ message: `${file} at ${width}px` },
				)
				.toBe(true);
			const pair = page.locator('.code-demo-pair').first();
			if (await pair.count()) {
				await expectPairLayout(pair, width);
			}
		}
	});
}

test('intentionally stacked pairs reflow at wide and narrow widths', async ({
	page,
}) => {
	await page.setContent(`
		<style>
			.code-demo-pair { display: grid; grid-template-columns: 1fr; }
		</style>
		<div class="code-demo-pair"><pre>Code</pre><div class="demo">Live example</div></div>
	`);
	for (const width of [320, 1400]) {
		await page.setViewportSize({ width, height: 900 });
		await expectPairLayout(page.locator('.code-demo-pair'), width);
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
	await serveDemo(page, {
		themeFailure: true,
		transformHtml: (html) =>
			html.replace(
				/data-theme-failure-message="[^"]+"/,
				'data-theme-failure-message="No se pudo cargar el tema de sintaxis."',
			),
	});
	await page.goto('http://code-demo.test/demo/index.html');
	const status = page.locator('#microlighter-status');
	const message = await status.getAttribute('data-theme-failure-message');
	expect(message?.trim()).toBeTruthy();
	await expect(status).toHaveText(message);
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
	await serveDemo(page, {
		grammarFailure: true,
		transformHtml: (html) =>
			html.replace(
				/data-failure-message="[^"]+"/,
				'data-failure-message="El ejemplo sigue disponible sin resaltado."',
			),
	});
	await page.goto('http://code-demo.test/demo/index.html');
	const code = page
		.locator('micro-lighter[language="html"] code:has(mark)')
		.first();
	const status = page.locator('#microlighter-status');
	const message = await status.getAttribute('data-failure-message');
	expect(message?.trim()).toBeTruthy();
	await expect(status).toHaveText(message);
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
