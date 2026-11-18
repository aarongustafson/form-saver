import { expect, test } from '@playwright/test';

const key = 'demo:encrypted';

test('encrypts drafts with fresh IVs and restores them across reloads', async ({
	page,
}) => {
	await page.goto('/demo/encrypted.html');
	const name = page.getByLabel('Name', { exact: true });
	await name.fill('Invented Person');
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), key))
		.toBeTruthy();
	const first = await page.evaluate((key) => localStorage.getItem(key), key);
	expect(first).not.toContain('Invented Person');
	const payload = JSON.parse(first);
	expect(payload).toEqual({
		version: 1,
		algorithm: 'AES-GCM',
		iv: expect.any(Array),
		ciphertext: expect.any(Array),
	});
	expect(payload.iv).toHaveLength(12);
	await page.locator('form-saver').evaluate((saver) => saver.saveFormState());
	const next = JSON.parse(
		await page.evaluate((key) => localStorage.getItem(key), key),
	);
	expect(next.iv).not.toEqual(payload.iv);
	await page.reload();
	await expect(name).toHaveValue('Invented Person');
	await expect(page.getByRole('status')).toBeEmpty();
});

test('reports tampering instead of restoring or replacing the encrypted draft', async ({
	page,
}) => {
	await page.goto('/demo/encrypted.html');
	await page.getByLabel('Name', { exact: true }).fill('Invented Person');
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), key))
		.toBeTruthy();
	const corrupted = await page.evaluate((key) => {
		const payload = JSON.parse(localStorage.getItem(key));
		payload.ciphertext[0] ^= 1;
		const value = JSON.stringify(payload);
		localStorage.setItem(key, value);
		return value;
	}, key);
	await page.reload();
	await expect(page.getByRole('status')).toContainText('Keep a copy');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
	expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
		corrupted,
	);
});

test('keeps form usable and saves nothing when the module cannot load', async ({
	page,
}) => {
	await page.route('**/draft-storage.js', (route) => route.abort());
	await page.goto('/demo/encrypted.html');
	await expect(page.getByRole('status')).toContainText('Keep a copy');
	await page.getByLabel('Name', { exact: true }).fill('Invented Person');
	await page.waitForTimeout(300);
	expect(
		await page.evaluate((key) => localStorage.getItem(key), key),
	).toBeNull();
});

test('reports malformed JSON without discarding the encrypted draft', async ({
	page,
}) => {
	await page.goto('/demo/encrypted.html');
	const corrupted = '{"ciphertext":';
	await page.evaluate(
		({ key, corrupted }) => localStorage.setItem(key, corrupted),
		{ key, corrupted },
	);
	await page.reload();
	await expect(page.getByRole('status')).toContainText('Keep a copy');
	expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
		corrupted,
	);
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
});

test('removing the behavior preserves live edits, retention choice, and ciphertext', async ({
	page,
}) => {
	await page.goto('/demo/encrypted.html');
	await page.getByLabel('Name', { exact: true }).fill('Saved example');
	await page.locator('form-saver').evaluate((saver) => saver.saveFormState());
	const original = await page.evaluate(
		(key) => localStorage.getItem(key),
		key,
	);
	await page.locator('form-saver').evaluate((saver) => {
		saver.querySelector('[name=name]').value = 'Unsaved example';
		saver.querySelector('[name=form-saver-retain]').checked = true;
		saver.script = null;
	});
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
		'Unsaved example',
	);
	await expect(page.getByRole('checkbox')).toBeChecked();
	expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
		original,
	);
});

test('reset followed by clearing cannot recreate an encrypted draft', async ({
	page,
}) => {
	await page.goto('/demo/encrypted.html');
	await page.getByLabel('Name', { exact: true }).fill('Saved example');
	await page.locator('form-saver').evaluate((saver) => saver.saveFormState());
	await page.locator('form-saver').evaluate((saver) => {
		saver.querySelector('form').reset();
		saver.clearSavedData();
	});
	await page.waitForTimeout(300);
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
	expect(
		await page.evaluate((key) => localStorage.getItem(key), key),
	).toBeNull();
});
