import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
	countAuthoredPairs,
	expectNativeFocus,
	expectPairLayout,
	readDemoStyles,
	serveDemo,
} from './demo-fixture.js';

test.beforeEach(async ({ page }) => {
	await page.route(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/**',
		(route) => route.abort(),
	);
});

const styles = await readDemoStyles();

test('shared form defaults yield to layered component controls', async ({
	page,
}) => {
	await page.setContent(`
		<style>
			${styles}
			@layer example-control {
				.example-control { margin: 0; padding: 0; line-height: 1.5; }
				.example-control label {
					display: inline-flex;
					min-block-size: 44px;
					margin: 0;
					padding: 0.5rem;
				}
			}
		</style>
		<fieldset class="example-control">
			<legend>Example control</legend>
			<label><input type="radio" name="example">Choice</label>
		</fieldset>
	`);
	const label = page.locator('label');
	await expect(label).toHaveCSS('display', 'inline-flex');
	await expect(page.locator('fieldset')).toHaveCSS('margin-top', '0px');
	expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

// The study's 62 scheme observations reduce to 19 palettes for these eight
// tokens. Preserve alpha; these fixtures test authored CSS, not OS repainting.
// Source: github.com/aarongustafson/system-color-study, November 2026 captures.
const tokens = [
	'Canvas',
	'CanvasText',
	'ButtonFace',
	'ButtonText',
	'Field',
	'FieldText',
	'Mark',
	'MarkText',
];
const palettes = [
	[6, '#ffffff', '#000000', '#efefef', '#000000', '#ffffff', '#000000'],
	[8, '#121212', '#ffffff', '#6b6b6b', '#ffffff', '#3b3b3b', '#ffffff'],
	[3, '#ffffff', '#000000', '#e9e9ed', '#000000', '#ffffff', '#000000'],
	[3, '#1c1b22', '#fbfbfe', '#2b2a33', '#fbfbfe', '#2b2a33', '#fbfbfe'],
	[2, '#ffffff', '#000000', '#c0c0c0', '#000000d8', '#ffffff', '#000000d8'],
	[
		1,
		'#1e1e1e',
		'#ffffff',
		'#ffffff3f',
		'#ffffffd8',
		'#ffffff3f',
		'#ffffffd8',
	],
	[2, '#ffffff', '#000000', '#f0f0f0', '#000000', '#ffffff', '#000000'],
	[6, '#202020', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	[4, '#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#3d3d3d'],
	[4, '#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#ffffff'],
	[4, '#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffffff'],
	[2, '#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffee32'],
	[8, '#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#b6f6f0'],
	[2, '#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#202020'],
	[2, '#ffffff', '#000000', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	[2, '#000000', '#ffffff', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	[1, '#ffffff', '#000000', '#ffffff', '#000000d8', '#ffffff', '#000000d8'],
	[1, '#282828', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	[1, '#202020', '#ffffff', '#00000000', '#ffffff', '#00000000', '#ffffff'],
];

const markup = `<!doctype html><html lang="en"><body data-demo-page="full">
	<header><h1>Demo palette</h1><a href="#example">Example link</a><code>Inline code</code></header>
	<main>
		<section class="demo-section" id="example">
			<h2>Example</h2><p>Example description with <code>inline code</code>.</p>
			<small>Section help</small>
			<div class="code-demo-pair">
				<pre><code>Example <mark>marked passage</mark><small>Code detail</small></code></pre>
				<div class="demo">
					<p>Live example</p><small>Live help</small>
					<label for="field">Field <small>Nested label help</small></label>
					<input id="field" value="Entered text">
					<button type="submit">Submit <small>Button detail</small></button>
					<button type="reset">Reset</button>
					<p role="status">Loading, error, and recovery feedback</p>
				</div>
			</div>
		</section>
		<aside class="note"><p>Note with <code>code</code> and <a href="#example">a link</a>.</p><small>Note help</small></aside>
		<section class="api-reference"><p>API information</p><small>API help</small></section>
	</main>
	<footer><p>Author credit</p></footer>
</body></html>`;

async function render(page, css = styles) {
	await page.setContent(markup);
	await page.addStyleTag({ content: css });
}

async function measurements(page, includeLinks = false) {
	return page.evaluate((measureLinks) => {
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext('2d');
		if (!context)
			throw new Error('Canvas color measurement is unavailable.');

		const pixel = () =>
			[...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
		const paint = (color) => {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return pixel();
		};
		const luminance = (rgb) =>
			rgb
				.map((channel) => {
					const value = channel / 255;
					return value <= 0.04045
						? value / 12.92
						: ((value + 0.055) / 1.055) ** 2.4;
				})
				.reduce(
					(sum, channel, index) =>
						sum + channel * [0.2126, 0.7152, 0.0722][index],
					0,
				);
		const ratio = (first, second) => {
			const a = luminance(first);
			const b = luminance(second);
			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		};
		const background = (element) => {
			context.clearRect(0, 0, 1, 1);
			const ancestors = [];
			for (let node = element; node; node = node.parentElement)
				ancestors.unshift(node);
			for (const node of ancestors) {
				const style = getComputedStyle(node);
				paint(style.backgroundColor);
				if (style.backgroundImage !== 'none') {
					const uniform = style.backgroundImage.match(
						/^linear-gradient\((.+), \1\)$/,
					);
					if (!uniform)
						throw new Error(
							'Only uniform color gradients are supported by this contrast check.',
						);
					paint(uniform[1]);
				}
			}
			if (context.getImageData(0, 0, 1, 1).data[3] !== 255)
				throw new Error('The measured background must be opaque.');
			return pixel();
		};

		const selectors = [
			...(measureLinks ? ['a'] : []),
			'header code',
			'body',
			'.demo-section > p',
			'.demo-section > p code',
			'.demo > p',
			'pre code',
			'mark',
			'.note p',
			'.note code',
			'.note a',
			'.api-reference p',
			'input',
			'button',
			'button[type="reset"]',
			'footer',
			...Array.from(document.querySelectorAll('small'), (_, index) => ({
				small: index,
			})),
		];
		const text = selectors.map((selector) => {
			const element =
				typeof selector === 'string'
					? document.querySelector(selector)
					: document.querySelectorAll('small')[selector.small];
			if (!element)
				throw new Error(`Missing sample: ${JSON.stringify(selector)}`);
			const bg = background(element);
			const foreground = paint(getComputedStyle(element).color);
			return {
				selector,
				ratio: ratio(foreground, bg),
				foreground,
				background: bg,
			};
		});
		const field = document.querySelector('input');
		const button = document.querySelector('button');
		const controls = [field, button].map((element) => {
			const surround = background(element.parentElement);
			const fill = background(element);
			const border = paint(getComputedStyle(element).borderTopColor);
			return {
				selector: element.tagName,
				ratio: Math.max(ratio(border, surround), ratio(fill, surround)),
			};
		});
		return {
			text,
			controls,
		};
	}, includeLinks);
}

function usesButtonSurface(sample) {
	return typeof sample.selector === 'string'
		? ['header code', 'button', 'button[type="reset"]'].includes(
				sample.selector,
			)
		: sample.selector.small === 4;
}

test('pairs the demo shell surfaces and preserves note accents', async ({
	page,
}) => {
	await page.emulateMedia({
		colorScheme: 'light',
		forcedColors: 'none',
		contrast: 'no-preference',
	});
	await render(page);
	await page.locator('body').evaluate((body) => {
		const probes = document.createElement('div');
		probes.innerHTML = `
			<span id="button-palette" style="color:ButtonText;background:ButtonFace;border:1px solid ButtonBorder"></span>
			<span id="canvas-palette" style="color:CanvasText;background:Canvas;border:1px solid color-mix(in srgb, CanvasText 22%, Canvas)"></span>
			<span id="accent-palette" style="color:AccentColor"></span>`;
		body.appendChild(probes);
	});
	const colors = (selector) =>
		page.locator(selector).evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				foreground: style.color,
				background: style.backgroundColor,
				border: style.borderTopColor,
				accent: style.borderLeftColor,
			};
		});
	const button = await colors('#button-palette');
	for (const selector of [
		'header code',
		'button[type="submit"]',
		'button[type="reset"]',
	]) {
		const actual = await colors(selector);
		expect(actual.foreground, selector).toBe(button.foreground);
		expect(actual.background, selector).toBe(button.background);
	}
	const canvas = await colors('#canvas-palette');
	for (const selector of ['.demo-section', '.demo', '.api-reference']) {
		const actual = await colors(selector);
		expect(actual.foreground, selector).toBe(canvas.foreground);
		expect(actual.background, selector).toBe(
			selector === '.demo' ? canvas.background : 'rgba(0, 0, 0, 0)',
		);
	}
	for (const selector of ['.demo-section > p', '.demo-section > small'])
		expect((await colors(selector)).foreground).toBe(canvas.foreground);
	for (const selector of ['.note', '.note code', '.note a', '.note > small'])
		expect((await colors(selector)).foreground, selector).toBe(
			canvas.foreground,
		);
	expect((await colors('.note')).background).toBe(canvas.background);
	for (const selector of ['.demo-section', '.demo'])
		expect((await colors(selector)).border, selector).toBe(canvas.border);
	expect((await colors('footer')).border).toBe(canvas.foreground);
	const accent = (await colors('#accent-palette')).foreground;
	expect((await colors('.note')).accent).toBe(accent);
	expect((await colors('.code-demo-pair')).background).toBe(
		'rgba(0, 0, 0, 0)',
	);
});

test('translucent fields retain contrast over colored labels', async ({
	page,
}) => {
	const [, ...values] = palettes[5];
	const colors = Object.fromEntries(
		tokens.map((token, index) => [
			token,
			[...values, '#ffff00', '#000000'][index],
		]),
	);
	await page.emulateMedia({
		colorScheme: 'light',
		forcedColors: 'none',
		contrast: 'no-preference',
	});
	await render(
		page,
		styles.replace(
			/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field|MarkText|Mark)\b/g,
			(token) => colors[token],
		),
	);
	await page.locator('label').evaluate((label) => {
		label.style.backgroundColor = 'pink';
		label.append(document.querySelector('input'));
	});
	const samples = await measurements(page);
	expect(
		samples.text.find((sample) => sample.selector === 'input').ratio,
	).toBeGreaterThanOrEqual(4.5);
	expect(
		samples.controls.find((sample) => sample.selector === 'INPUT').ratio,
	).toBeGreaterThanOrEqual(3);
});

for (const [index, [observations, ...values]] of palettes.entries()) {
	test(`recorded palette ${index + 1} (${observations} observations)`, async ({
		page,
	}) => {
		const colors = Object.fromEntries(
			tokens.map((token, position) => [
				token,
				[...values, '#ffff00', '#000000'][position],
			]),
		);
		const css = styles.replace(
			/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field|MarkText|Mark)\b/g,
			(token) => colors[token],
		);
		await page.emulateMedia({
			colorScheme: 'light',
			forcedColors: 'none',
			contrast: 'no-preference',
		});
		await render(page, css);
		await page.locator('input').focus();
		const samples = await measurements(page);
		for (const sample of samples.text)
			expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
				4.5,
			);
		const footer = samples.text.find(
			(sample) => sample.selector === 'footer',
		);
		const channel = (hex, position) =>
			parseInt(hex.slice(1 + position * 2, 3 + position * 2), 16);
		for (let position = 0; position < 3; position++) {
			const expected =
				channel(values[1], position) * 0.8 +
				channel(values[0], position) * 0.2;
			expect(
				Math.abs(footer.foreground[position] - expected),
			).toBeLessThanOrEqual(1);
		}
		const small = (index) =>
			samples.text.find(
				(sample) =>
					typeof sample.selector === 'object' &&
					sample.selector.small === index,
			);
		expect(small(1).foreground).toEqual(
			samples.text.find((sample) => sample.selector === 'pre code')
				.foreground,
		);
		expect(small(4).foreground).toEqual(
			samples.text.find((sample) => sample.selector === 'button')
				.foreground,
		);
		for (const sample of samples.controls)
			expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
				3,
			);
		// Native outlines use the browser palette, not the substituted CSS tokens.
		await expectNativeFocus(page.locator('input'));

		for (const type of ['submit', 'reset']) {
			const button = page.locator(`button[type="${type}"]`);
			await button.hover();
			const hover = await button.evaluate(
				(element, { face, text }) => {
					const probe = document.createElement('span');
					probe.style.backgroundColor = `color-mix(in srgb, ${face} 95%, ${text})`;
					document.body.append(probe);
					try {
						const style = getComputedStyle(element);
						return {
							background: style.backgroundColor,
							expected: getComputedStyle(probe).backgroundColor,
							opacity: style.opacity,
							decoration: style.textDecorationLine,
						};
					} finally {
						probe.remove();
					}
				},
				{ face: colors.ButtonFace, text: colors.ButtonText },
			);
			expect(hover.background).toBe(hover.expected);
			expect(hover.opacity).toBe('1');
			expect(hover.decoration).toBe('none');
			const selector =
				type === 'submit' ? 'button' : 'button[type="reset"]';
			const sample = (await measurements(page)).text.find(
				(item) => item.selector === selector,
			);
			expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});
}

for (const scheme of ['light', 'dark']) {
	test(`native ${scheme} palette and keyboard focus`, async ({
		page,
		browserName,
	}) => {
		await page.emulateMedia({
			colorScheme: scheme,
			forcedColors: 'none',
			contrast: 'no-preference',
		});
		await render(page);
		const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
		await page.keyboard.press(tab);
		await expect(page.locator('header a')).toBeFocused();
		await page.keyboard.press(tab);
		await expect(page.locator('input')).toBeFocused();
		const samples = await measurements(page, true);
		expect(
			samples.text.filter(
				(sample) => !usesButtonSurface(sample) && sample.ratio < 4.5,
			),
		).toEqual([]);
		await expectNativeFocus(page.locator('input'));

		const link = page.locator('header a');
		await link.hover();
		await page.mouse.down();
		const activeColor = await link.evaluate(
			(element) => getComputedStyle(element).color,
		);
		await page.mouse.up();
		await link.evaluate((element) => element.blur());
		expect(activeColor).toBe(
			await link.evaluate((element) => getComputedStyle(element).color),
		);
	});

	test(`native ${scheme} ButtonText on ButtonFace contrast`, async ({
		page,
		browserName,
	}) => {
		test.fail(
			process.platform === 'linux' &&
				browserName === 'webkit' &&
				scheme === 'dark',
			'Bundled Ubuntu WebKit resolves white ButtonText on light ButtonFace (1.82:1); track the native pair without replacing it for every platform.',
		);
		await page.emulateMedia({
			colorScheme: scheme,
			forcedColors: 'none',
			contrast: 'no-preference',
		});
		await render(page);
		const samples = await measurements(page);
		expect(
			samples.text.filter(
				(sample) => usesButtonSurface(sample) && sample.ratio < 4.5,
			),
		).toEqual([]);
		for (const type of ['submit', 'reset']) {
			await page.locator(`button[type="${type}"]`).hover();
			const selector =
				type === 'submit' ? 'button' : 'button[type="reset"]';
			const sample = (await measurements(page)).text.find(
				(item) => item.selector === selector,
			);
			expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});
}

test('secondary text falls back when color-mix is unavailable', async ({
	page,
}) => {
	await render(page, styles.replace(/color:\s*color-mix\([^;]+\);/g, ''));
	const colors = await page.locator('footer').evaluate((element) => ({
		footer: getComputedStyle(element).color,
		body: getComputedStyle(document.body).color,
	}));
	expect(colors.footer).toBe(colors.body);
});

test('button hover falls back to the system face and underline without color-mix', async ({
	page,
}) => {
	await render(
		page,
		styles.replaceAll('color-mix(', 'unsupported-color-mix('),
	);
	for (const type of ['submit', 'reset']) {
		const button = page.locator(`button[type="${type}"]`);
		const background = await button.evaluate(
			(element) => getComputedStyle(element).backgroundColor,
		);
		await button.hover();
		await expect(button).toHaveCSS('background-color', background);
		await expect(button).toHaveCSS('text-decoration-line', 'underline');
	}
});

for (const preference of ['more-contrast', 'forced-colors']) {
	test(`button hover preserves the full system pair with ${preference}`, async ({
		page,
		browserName,
	}) => {
		test.skip(
			preference === 'forced-colors' && browserName !== 'chromium',
			'Forced-color emulation is checked in Chromium only.',
		);
		await page.emulateMedia({
			contrast: preference === 'more-contrast' ? 'more' : 'no-preference',
			forcedColors: preference === 'forced-colors' ? 'active' : 'none',
		});
		const supportsAdjustment = await page.evaluate(() =>
			CSS.supports('forced-color-adjust', 'auto'),
		);
		await render(page);
		for (const type of ['submit', 'reset']) {
			const button = page.locator(`button[type="${type}"]`);
			const background = await button.evaluate(
				(element) => getComputedStyle(element).backgroundColor,
			);
			await button.hover();
			await expect(button).toHaveCSS('background-color', background);
			await expect(button).toHaveCSS('text-decoration-line', 'underline');
			if (supportsAdjustment)
				await expect(button).toHaveCSS('forced-color-adjust', 'auto');
		}
	});
}

for (const topLayer of ['popover', 'dialog']) {
	test(`native focus ignores clipping outside an open ${topLayer}`, async ({
		page,
	}) => {
		await page.setContent(`
			<div style="overflow: hidden; width: 1px; height: 1px">
				<${topLayer === 'dialog' ? 'dialog' : 'div popover'} id="popup">
					<button>Visible control</button>
				</${topLayer === 'dialog' ? 'dialog' : 'div'}>
			</div>
		`);
		await page.locator('#popup').evaluate((popup) => {
			if (popup.localName === 'dialog') popup.showModal();
			else popup.showPopover();
		});
		await page.keyboard.press('Tab');
		await expectNativeFocus(page.locator('button'));
	});
}

test('native focus still detects clipping inside an open popover', async ({
	page,
}) => {
	await page.setContent(`
		<div popover id="popup">
			<div style="overflow: hidden; width: 1px; height: 1px">
				<button>Clipped control</button>
			</div>
		</div>
	`);
	await page.locator('#popup').evaluate((popup) => popup.showPopover());
	await page.keyboard.press('Tab');
	await expect(expectNativeFocus(page.locator('button'))).rejects.toThrow(
		'Ancestors must leave room for the native focus ring',
	);
});

test('note and live-demo controls preserve native keyboard focus', async ({
	page,
	browserName,
}) => {
	await render(page);
	await page.keyboard.press(
		browserName === 'webkit' && process.platform === 'darwin'
			? 'Alt+Tab'
			: 'Tab',
	);
	for (const selector of ['.note a', 'input'])
		await expectNativeFocus(page.locator(selector));
});

test('more contrast keeps supporting text at full strength', async ({
	page,
}) => {
	await page.emulateMedia({ contrast: 'more' });
	await render(page);
	const colors = await page.locator('footer').evaluate((element) => ({
		footer: getComputedStyle(element).color,
		body: getComputedStyle(document.body).color,
	}));
	expect(colors.footer).toBe(colors.body);
});

test('forced-color emulation preserves paired prose and focus', async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'CI emulation is checked in Chromium only.',
	);
	await page.emulateMedia({ forcedColors: 'active' });
	await render(page);
	await page.locator('input').focus();
	const samples = await measurements(page);
	for (const sample of samples.text)
		expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(
			4.5,
		);
	await expectNativeFocus(page.locator('input'));
	const colors = await page.locator('footer').evaluate((element) => ({
		footer: getComputedStyle(element).color,
		body: getComputedStyle(document.body).color,
		adjustment: getComputedStyle(element).forcedColorAdjust,
	}));
	expect(colors.footer).toBe(colors.body);
	expect(colors.adjustment).toBe('auto');
});

test('code/live examples stack without horizontal page overflow', async ({
	page,
}) => {
	await render(page);
	const code = page.locator('.code-demo-pair > :is(pre, micro-lighter)');
	const demo = page.locator('.code-demo-pair > .demo');
	const wideCode = await code.boundingBox();
	const wideDemo = await demo.boundingBox();
	expect(wideDemo.x).toBeGreaterThan(wideCode.x);
	await page.setViewportSize({ width: 320, height: 800 });
	const narrowCode = await code.boundingBox();
	const narrowDemo = await demo.boundingBox();
	expect(narrowDemo.y).toBeGreaterThan(narrowCode.y);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(320);
});

async function hasAuthoredFallback(demos) {
	return demos.evaluateAll((elements) => {
		const visible = (element) => {
			if (getComputedStyle(element).visibility !== 'visible')
				return false;
			while (
				element &&
				getComputedStyle(element).display === 'contents'
			) {
				element = element.parentElement;
			}
			return element?.checkVisibility({
				opacityProperty: true,
			});
		};
		const hasArea = (rect) => rect.width > 0 && rect.height > 0;
		return elements.some((element) => {
			const walker = document.createTreeWalker(
				element,
				NodeFilter.SHOW_TEXT,
			);
			while (walker.nextNode()) {
				const text = walker.currentNode;
				if (!text.textContent.trim() || !visible(text.parentElement))
					continue;
				const range = document.createRange();
				range.selectNodeContents(text);
				if ([...range.getClientRects()].some(hasArea)) return true;
			}
			return [...element.querySelectorAll('img[alt]')].some(
				(image) =>
					image.getAttribute('alt').trim() &&
					visible(image) &&
					[...image.getClientRects()].some(hasArea),
			);
		});
	});
}

test.describe('authored demo without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('native fallback may follow an enhancement-only example', async ({
		page,
	}) => {
		await page.setContent(`
			<div class="demo">
				<example-image src="image.jpg" alt="Requires enhancement"></example-image>
			</div>
			<div class="demo">
				<img alt="Useful native fallback" width="200" height="20">
			</div>
		`);
		expect(await hasAuthoredFallback(page.locator('.demo'))).toBe(true);
	});

	test('native fallback accepts rendered text without a wrapper box', async ({
		page,
	}) => {
		await page.setContent(`
			<div class="demo" style="display: contents">
				<span style="display: contents">Readable native fallback</span>
			</div>
		`);
		expect(await hasAuthoredFallback(page.locator('.demo'))).toBe(true);
	});

	test('native fallback respects visible text overrides without a wrapper box', async ({
		page,
	}) => {
		await page.setContent(`
			<div class="demo" style="visibility: hidden">
				<span style="display: contents; visibility: visible">Readable fallback</span>
			</div>
		`);
		expect(await hasAuthoredFallback(page.locator('.demo'))).toBe(true);
	});

	test('native fallback rejects empty, decorative, and hidden images', async ({
		page,
	}) => {
		await page.setContent(`
			<div class="demo"><example-image src="image.jpg"></example-image></div>
			<div class="demo"><img alt="" width="20" height="20"></div>
			<div class="demo"><img alt="Hidden fallback" width="200" height="20" hidden></div>
		`);
		expect(await hasAuthoredFallback(page.locator('.demo'))).toBe(false);
	});

	for (const [name, content] of [
		['style-only content', '<style>.demo { color: red; }</style>'],
		['script-only content', '<script>window.example = true;</script>'],
		['hidden text', '<p hidden>Hidden fallback</p>'],
		[
			'hidden display:contents text',
			'<span style="display: contents; visibility: hidden">Hidden fallback</span>',
		],
		[
			'invisible text',
			'<p style="visibility: hidden">Invisible fallback</p>',
		],
		['transparent text', '<p style="opacity: 0">Transparent fallback</p>'],
		[
			'invisible image',
			'<img alt="Invisible fallback" width="200" height="20" style="visibility: hidden">',
		],
		[
			'transparent image',
			'<span style="opacity: 0"><img alt="Transparent fallback" width="200" height="20"></span>',
		],
	]) {
		test(`native fallback rejects ${name}`, async ({ page }) => {
			await page.setContent(`<div class="demo">${content}</div>`);
			expect(await hasAuthoredFallback(page.locator('.demo'))).toBe(
				false,
			);
		});
	}

	test('authored pair counting accepts class order and HTML quoting', async ({
		page,
	}) => {
		const html = `
			<div class="stacked code-demo-pair"><pre>Code</pre><div class="demo">Example</div></div>
			<div class='code-demo-pair stacked'><pre>Code</pre><div class="demo">Example</div></div>
			<div class="not-code-demo-pair">Unrelated</div>
		`;
		await page.setContent(html);
		expect(await countAuthoredPairs(page, html)).toBe(2);
		await expect(page.locator('.code-demo-pair')).toHaveCount(2);
	});

	test('keeps fallback content and code/live pairs usable', async ({
		page,
	}) => {
		const html = await readFile(
			new URL('../../demo/index.html', import.meta.url),
			'utf8',
		);
		await serveDemo(page);
		await page.goto('http://code-demo.test/demo/index.html');
		const pairs = page.locator('.code-demo-pair');
		const authoredPairs = await countAuthoredPairs(page, html);
		expect(authoredPairs).toBeGreaterThan(0);
		await expect(pairs).toHaveCount(authoredPairs);
		const hasFallback = await hasAuthoredFallback(page.locator('.demo'));
		expect(hasFallback).toBe(true);
		for (const width of [1000, 320]) {
			await page.setViewportSize({ width, height: 800 });
			for (const pair of await pairs.all()) {
				await expectPairLayout(pair, width);
			}
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth),
			).toBeLessThanOrEqual(width);
		}
	});
});
