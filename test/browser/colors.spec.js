import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const read = (file) =>
	readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const css = await read('demo/styles.css');
const source = await read('form-saver.js');
const definition = await read('define.js');
const tokens = [
	'Canvas',
	'CanvasText',
	'ButtonFace',
	'ButtonText',
	'Field',
	'FieldText',
];
// The study's 62 scheme observations reduce to these 19 distinct palettes.
const palettes = [
	['#ffffff', '#000000', '#efefef', '#000000', '#ffffff', '#000000'],
	['#121212', '#ffffff', '#6b6b6b', '#ffffff', '#3b3b3b', '#ffffff'],
	['#ffffff', '#000000', '#e9e9ed', '#000000', '#ffffff', '#000000'],
	['#1c1b22', '#fbfbfe', '#2b2a33', '#fbfbfe', '#2b2a33', '#fbfbfe'],
	['#ffffff', '#000000', '#c0c0c0', '#000000d8', '#ffffff', '#000000d8'],
	['#1e1e1e', '#ffffff', '#ffffff3f', '#ffffffd8', '#ffffff3f', '#ffffffd8'],
	['#ffffff', '#000000', '#f0f0f0', '#000000', '#ffffff', '#000000'],
	['#202020', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#3d3d3d'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffee32'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#b6f6f0'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#202020'],
	['#ffffff', '#000000', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#000000', '#ffffff', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#ffffff', '#000000', '#ffffff', '#000000d8', '#ffffff', '#000000d8'],
	['#282828', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#202020', '#ffffff', '#00000000', '#ffffff', '#00000000', '#ffffff'],
];

function substitute(styles, palette) {
	const map = Object.fromEntries(
		tokens.map((token, i) => [token.toLowerCase(), palette[i]]),
	);
	return styles.replace(
		/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field)\b/gi,
		(token) => map[token.toLowerCase()],
	);
}

async function contrast(locator) {
	return locator.evaluate((element) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		const pixel = () => [...context.getImageData(0, 0, 1, 1).data];
		const paint = (color) => {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return pixel();
		};
		const background = () => {
			context.clearRect(0, 0, 1, 1);
			const ancestors = [];
			for (let node = element; node; node = node.parentElement)
				ancestors.unshift(node);
			for (const node of ancestors) {
				const style = getComputedStyle(node);
				if (style.opacity !== '1')
					throw new Error('Unsupported group opacity');
				paint(style.backgroundColor);
				if (style.backgroundImage !== 'none') {
					const gradient = style.backgroundImage.match(
						/^linear-gradient\((.+), \1\)$/,
					);
					if (!gradient)
						throw new Error(
							`Unsupported background ${style.backgroundImage}`,
						);
					paint(gradient[1]);
				}
			}
			if (pixel()[3] !== 255)
				throw new Error('Expected opaque backplate');
			return pixel();
		};
		const luminance = (rgb) =>
			rgb.slice(0, 3).reduce((sum, channel, i) => {
				const n = channel / 255;
				return (
					sum +
					(n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4) *
						[0.2126, 0.7152, 0.0722][i]
				);
			}, 0);
		const ratio = (a, b) => {
			const [high, low] = [luminance(a), luminance(b)].sort(
				(a, b) => b - a,
			);
			return (high + 0.05) / (low + 0.05);
		};
		const style = getComputedStyle(element);
		const fill = background();
		const text = ratio(paint(style.color), fill);
		background();
		const boundary =
			parseFloat(style.borderTopWidth) > 0 &&
			!['none', 'hidden'].includes(style.borderTopStyle)
				? ratio(paint(style.borderTopColor), fill)
				: 1;
		return { text, boundary };
	});
}

async function demo(page, file = 'index.html') {
	await page.route('https://esm.sh/**', (route) =>
		route.fulfill({ contentType: 'text/javascript', body: source }),
	);
	await page.route('https://unpkg.com/**', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: definition.replace(
				"'./form-saver.js'",
				"'http://127.0.0.1:4192/form-saver.js'",
			),
		}),
	);
	await page.goto(`/demo/${file}`);
	await expect(page.locator('[data-action="save"]').first()).toBeEnabled();
}

test('recorded study palettes preserve reading, feedback, fields and button contrast', async ({
	page,
}) => {
	test.setTimeout(120000);
	await demo(page);
	const style = await page.addStyleTag({ content: css });
	for (const palette of palettes) {
		await style.evaluate(
			(style, css) => {
				style.textContent = css;
			},
			substitute(css, palette),
		);
		for (const selector of [
			'body',
			'.demo-section',
			'.demo',
			'pre',
			'code',
			'.api-reference',
			'footer',
			'.draft-feedback',
			'input[name="name"]',
			'textarea',
			'button[type="submit"]',
			'[data-action="save"]',
		]) {
			const element = page.locator(selector).first();
			expect(
				(await contrast(element)).text,
				`${palette[0]} ${selector}`,
			).toBeGreaterThanOrEqual(4.5);
		}
		for (const selector of [
			'input[name="name"]',
			'textarea',
			'button[type="submit"]',
			'[data-action="save"]',
		]) {
			expect(
				(await contrast(page.locator(selector).first())).boundary,
				selector,
			).toBeGreaterThanOrEqual(3);
		}
		const button = page.locator('button[type="submit"]').first();
		await button.hover();
		expect((await contrast(button)).text).toBeGreaterThanOrEqual(4.5);
		await page.mouse.move(0, 0);
	}
});

for (const colorScheme of ['light', 'dark']) {
	test(`${colorScheme}: reading and state feedback retain contrast`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await demo(page);
		for (const selector of [
			'body',
			'.demo',
			'pre',
			'.draft-feedback',
			'footer',
			'input[name="name"]',
		]) {
			expect(
				(await contrast(page.locator(selector).first())).text,
				selector,
			).toBeGreaterThanOrEqual(4.5);
		}
	});
	test(`${colorScheme}: native button pair retains contrast`, async ({
		page,
		browserName,
	}) => {
		test.fail(
			process.platform === 'linux' &&
				browserName === 'webkit' &&
				colorScheme === 'dark',
			'Bundled Ubuntu WebKit native dark ButtonText/ButtonFace is 1.82:1, outside the recorded study.',
		);
		await page.emulateMedia({ colorScheme });
		await demo(page);
		expect(
			(await contrast(page.locator('button[type="submit"]').first()))
				.text,
		).toBeGreaterThanOrEqual(4.5);
	});
}

for (const file of ['index.html', 'esm.html', 'unpkg.html']) {
	test(`${file}: native keyboard focus, save/reload, localized error, responsive layout`, async ({
		page,
	}) => {
		await demo(page, file);
		const saver = page.locator('form-saver').first();
		const name = saver.locator('input[name="name"]');
		await page.locator('header a').focus();
		await page.keyboard.press('Tab');
		// Scrollable code samples may be native tab stops before the live form.
		for (
			let i = 0;
			i < 3 &&
			!(await name.evaluate(
				(element) => element === document.activeElement,
			));
			i += 1
		) {
			await page.keyboard.press('Tab');
		}
		await expect(name).toBeFocused();
		expect(
			await name.evaluate((element) => {
				const style = getComputedStyle(element);
				return (
					style.outlineStyle !== 'none' &&
					parseFloat(style.outlineWidth) > 0
				);
			}),
		).toBe(true);
		await name.fill('Invented demo name');
		await saver.locator('[data-action="save"]').focus();
		await page.keyboard.press('Space');
		await expect(saver.locator('[role="status"]')).toContainText(
			'Draft saved',
		);
		await expect(saver.locator('[data-action="save"]')).toBeFocused();
		await page.reload();
		await expect(name).toHaveValue('Invented demo name');
		await expect(saver.locator('[role="status"]')).toContainText(
			'stored draft',
		);
		await saver.locator('[role="status"]').evaluate((element) => {
			element.dataset.error = 'No se pudo guardar. Conserva una copia.';
		});
		await page.evaluate(() => {
			Storage.prototype.setItem = () => {
				throw new DOMException('Denied', 'SecurityError');
			};
		});
		await name.fill('Still entered');
		await saver.locator('[data-action="save"]').click();
		await expect(saver.locator('[role="status"]')).toHaveText(
			'No se pudo guardar. Conserva una copia.',
		);
		await expect(name).toHaveValue('Still entered');
		const pair = page.locator('.code-demo-pair').first();
		const codeBox = await pair.locator('pre').boundingBox();
		const liveBox = await pair.locator('.demo').boundingBox();
		expect(codeBox.x).toBeLessThan(liveBox.x);
		await page.setViewportSize({ width: 320, height: 900 });
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		expect((await pair.locator('pre').boundingBox()).y).toBeLessThan(
			(await pair.locator('.demo').boundingBox()).y,
		);
		await page.evaluate(() => {
			document.documentElement.style.fontSize = '200%';
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
	});
	test(`${file}: module failure leaves editable form and honest recovery`, async ({
		page,
	}) => {
		await page.route('**/*.js*', (route) => route.abort());
		await page.goto(`/demo/${file}`);
		await page.locator('input[name="name"]').first().fill('Not lost');
		await expect(page.locator('input[name="name"]').first()).toHaveValue(
			'Not lost',
		);
		await expect(
			page.locator('[data-action="save"]').first(),
		).toBeDisabled();
		await expect(page.locator('[role="status"]').first()).toContainText(
			'unavailable',
		);
		expect(
			await page
				.locator('form')
				.first()
				.evaluate((form) => form.method),
		).toBe('post');
		await page.locator('input[type="email"]').first().fill('invalid');
		expect(
			await page
				.locator('form')
				.first()
				.evaluate((form) => form.checkValidity()),
		).toBe(false);
	});
}

test('no JavaScript preserves native form controls and recovery text', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	for (const file of ['index.html', 'esm.html', 'unpkg.html']) {
		const page = await context.newPage();
		await page.goto(`http://127.0.0.1:4192/demo/${file}`);
		await page.locator('input[name="name"]').first().fill('Native draft');
		await expect(page.locator('input[name="name"]').first()).toHaveValue(
			'Native draft',
		);
		await expect(page.locator('text=Without JavaScript')).toBeVisible();
		await expect(
			page.locator('[data-action="save"]').first(),
		).toBeDisabled();
		await page.close();
	}
	await context.close();
});

test('storage read denial has visible recovery without hiding the native form', async ({
	page,
}) => {
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new DOMException('Denied', 'SecurityError');
		};
	});
	await demo(page);
	for (const feedback of await page.locator('[role="status"]').all()) {
		await expect(feedback).toContainText('storage is unavailable');
	}
	await page.locator('input[name="name"]').first().fill('Safe in form');
	await expect(page.locator('input[name="name"]').first()).toHaveValue(
		'Safe in form',
	);
});

test('retention checkbox stays keyboard-operable and draft saving excludes secrets', async ({
	page,
}) => {
	await demo(page);
	const saver = page.locator('form-saver[retain-choice]').first();
	const checkbox = saver.locator('input[type="checkbox"]');
	await checkbox.focus();
	await page.keyboard.press('Space');
	await expect(checkbox).toBeChecked();
	await saver.locator('input[name="name"]').fill('Draft');
	await saver.locator('form').evaluate((form) => {
		for (const type of ['password', 'file']) {
			const input = document.createElement('input');
			input.type = type;
			input.name = type;
			if (type === 'password') input.value = 'never-save';
			form.append(input);
		}
		form.closest('form-saver').saveFormState();
	});
	const stored = await saver.evaluate((saver) =>
		JSON.parse(localStorage.getItem(saver.storageKey)),
	);
	expect(stored.name[0].value).toBe('Draft');
	expect(stored).not.toHaveProperty('password');
	expect(stored).not.toHaveProperty('file');
});

test('canceled submissions, resets and disconnect cleanup preserve native/data semantics', async ({
	page,
}) => {
	await demo(page);
	const saver = page.locator('form-saver').first();
	const input = saver.locator('input[name="name"]');
	await input.fill('Keep this');
	await saver.locator('[data-action="save"]').click();
	await saver.locator('form').evaluate((form) => {
		form.addEventListener('submit', (event) => event.preventDefault());
	});
	await saver.locator('button[type="submit"]').click();
	await expect(input).toHaveValue('Keep this');
	expect(
		await saver.evaluate(
			(saver) =>
				JSON.parse(localStorage.getItem(saver.storageKey)).name[0]
					.value,
		),
	).toBe('Keep this');
	await saver.locator('form').evaluate((form) => form.reset());
	await expect(input).toHaveValue('');
	await expect
		.poll(() =>
			saver.evaluate(
				(saver) =>
					JSON.parse(localStorage.getItem(saver.storageKey)).name[0]
						.value,
			),
		)
		.toBe('');
	expect(
		await saver.evaluate(async (saver) => {
			const form = saver.querySelector('form');
			const key = saver.storageKey;
			const before = localStorage.getItem(key);
			saver.remove();
			form.querySelector('input').value = 'Detached';
			form.dispatchEvent(new Event('input', { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 250));
			return localStorage.getItem(key) === before;
		}),
	).toBe(true);
});

for (const choice of [null, false, true]) {
	test(`native POST navigation applies retention choice ${choice}`, async ({
		page,
	}) => {
		await demo(page);
		const saver =
			choice === null
				? page.locator('form-saver').first()
				: page.locator('form-saver[retain-choice]').first();
		await saver.getByLabel('Name', { exact: true }).fill('Invented sender');
		await saver
			.getByLabel('Message', { exact: true })
			.fill('Private draft');
		if (choice) await saver.getByRole('checkbox').check();
		let submitted = '';
		await page.route('**/contact', async (route) => {
			submitted = route.request().postData();
			await route.fulfill({
				contentType: 'text/html',
				body: '<!doctype html><title>Demo receipt</title><p>Test receipt only.</p>',
			});
		});
		await Promise.all([
			page.waitForURL('**/contact'),
			saver.getByRole('button', { name: 'Send', exact: true }).click(),
		]);
		expect(submitted).toContain('name=Invented+sender');
		await page.goto('/demo/index.html');
		await expect(saver.getByLabel('Name', { exact: true })).toHaveValue(
			choice ? 'Invented sender' : '',
		);
		await expect(saver.getByLabel('Message', { exact: true })).toHaveValue(
			'',
		);
	});
}

test('native label associations and status semantics remain exposed', async ({
	page,
}) => {
	await demo(page);
	const saver = page.locator('form-saver[retain-choice]').first();
	await expect(
		saver.getByRole('checkbox', {
			name: 'Store my contact information for later',
		}),
	).toBeVisible();
	const snapshot = await saver.ariaSnapshot();
	expect(snapshot).toContain('textbox "Name"');
	expect(snapshot).toContain('textbox "Email"');
	expect(snapshot).toContain('textbox "Message"');
	expect(snapshot).toContain('status');
	await saver
		.getByLabel('Name', { exact: true })
		.fill('Visible only in the field');
	expect(await saver.locator('[role="status"]').textContent()).not.toContain(
		'Visible only in the field',
	);
});

test('increased contrast preserves full-strength feedback and native focus', async ({
	page,
}) => {
	await page.emulateMedia({ contrast: 'more' });
	await demo(page);
	expect(
		(await contrast(page.locator('.draft-feedback').first())).text,
	).toBeGreaterThanOrEqual(4.5);
	expect(
		await page
			.locator('footer')
			.evaluate((element) => getComputedStyle(element).color),
	).toBe(
		await page
			.locator('body')
			.evaluate((element) => getComputedStyle(element).color),
	);
});

test('forced-color emulation keeps automatic adjustment and non-color state feedback', async ({
	page,
}) => {
	await page.emulateMedia({ forcedColors: 'active' });
	await demo(page);
	test.skip(
		!(await page.evaluate(
			() => matchMedia('(forced-colors: active)').matches,
		)),
		'Engine does not emulate forced colors.',
	);
	test.skip(
		!(await page.evaluate(() =>
			CSS.supports('forced-color-adjust', 'auto'),
		)),
		'Engine lacks forced-color-adjust support; OS repainting remains untested.',
	);
	expect(
		await page
			.locator('body')
			.evaluate((element) => getComputedStyle(element).forcedColorAdjust),
	).toBe('auto');
	await page.locator('[data-action="save"]').first().click();
	await expect(page.locator('[role="status"]').first()).toContainText(
		'Draft saved',
	);
});

test('preview is no-cache and does not expose repository metadata', async ({
	request,
}) => {
	expect(
		(await request.get('/demo/index.html')).headers()['cache-control'],
	).toBe('no-store');
	expect((await request.get('/.git/config')).status()).toBe(404);
	expect((await request.post('/contact')).status()).toBe(405);
});
