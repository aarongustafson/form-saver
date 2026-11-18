import { expect, test } from '@playwright/test';

test('a behavior-only module adds keyboard-operable help without storage hooks', async ({
	page,
}) => {
	await page.goto('/demo/behavior.html');
	const toggle = page.locator('[data-toggle-help]');
	await expect(toggle).toBeVisible();
	await expect(toggle).toHaveAccessibleName('Show writing tips');
	const tips = page.locator('#writing-tips');
	await expect(tips).toBeHidden();
	await toggle.focus();
	await page.keyboard.press('Enter');
	await expect(tips).toBeVisible();
	await expect(toggle).toBeFocused();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(toggle).toHaveAccessibleName('Hide writing tips');
	expect(
		await page.locator('form-saver').evaluate((saver) => ({
			beforeSave: saver.beforeSave,
			beforeRestore: saver.beforeRestore,
		})),
	).toEqual({ beforeSave: null, beforeRestore: null });
	await page.getByLabel('Message', { exact: true }).fill('Invented draft');
	await page.locator('form-saver').evaluate((saver) => saver.saveFormState());
	expect(
		await page.evaluate(() =>
			JSON.parse(localStorage.getItem('demo:behavior')),
		),
	).toEqual({
		message: [{ type: 'value', value: 'Invented draft' }],
	});
	await page.reload();
	await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
		'Invented draft',
	);
	await expect(page.locator('form-saver').getByRole('status')).toBeEmpty();
	await page.locator('form-saver').evaluate((saver) => {
		saver.remove();
		document.querySelector('.demo').append(saver);
	});
	await expect(toggle).toBeVisible();
	await expect(tips).toBeHidden();
	await toggle.click();
	await expect(tips).toBeVisible();
});

test('behavior module failure leaves help and the native form available', async ({
	page,
}) => {
	await page.route('**/writing-help.js', (route) => route.abort());
	await page.goto('/demo/behavior.html');
	await expect(page.locator('form-saver').getByRole('status')).toContainText(
		'Keep a copy',
	);
	await expect(page.locator('#writing-tips')).toBeVisible();
	await expect(page.locator('[data-toggle-help]')).toBeHidden();
	await page.getByLabel('Message', { exact: true }).fill('Still editable');
	await page.locator('form-saver').evaluate((saver) => saver.saveFormState());
	expect(
		await page.evaluate(() => localStorage.getItem('demo:behavior')),
	).toBeNull();
});

test('without JavaScript, writing help and form controls remain available', async ({
	browser,
	baseURL,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto(`${baseURL}/demo/behavior.html`);
		await expect(page.locator('#writing-tips')).toBeVisible();
		await expect(page.locator('[data-toggle-help]')).toBeHidden();
		await page.getByLabel('Message', { exact: true }).fill('Native draft');
		await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
			'Native draft',
		);
	} finally {
		await context.close();
	}
});

test('behavior demo code and controls reflow in light, dark, and forced colors', async ({
	page,
}) => {
	await page.goto('/demo/behavior.html');
	for (const colorScheme of ['light', 'dark']) {
		await page.emulateMedia({ colorScheme });
		for (const width of [1280, 320]) {
			await page.setViewportSize({ width, height: 900 });
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			const panels = await page
				.locator('.code-demo-pair > *')
				.evaluateAll((elements) =>
					elements.map((element) => {
						const bounds = element.getBoundingClientRect();
						return { x: bounds.x, y: bounds.y };
					}),
				);
			if (width === 1280) expect(panels[0].y).toBe(panels[1].y);
			else expect(panels[0].x).toBe(panels[1].x);
		}
	}
	await page.emulateMedia({ forcedColors: 'active' });
	await page.getByRole('button', { name: 'Show writing tips' }).click();
	await expect(page.locator('#writing-tips')).toBeVisible();
});
