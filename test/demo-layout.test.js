import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('keeps code readable while progressively enhancing every full demo page', async () => {
	const pages = JSON.parse(await readFile('demo/pages.json', 'utf8'));
	for (const [file, kind] of Object.entries(pages)) {
		if (kind !== 'full') continue;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		const root = template.content;
		expect(root.querySelector('header'), file).not.toBeNull();
		expect(
			[...root.querySelectorAll('details > summary')].some((summary) =>
				summary.textContent.includes(
					'Code controls, highlighting, and fallbacks',
				),
			),
			file,
		).toBe(false);
		expect(
			root.querySelector('a.skip-link')?.getAttribute('href'),
			file,
		).toBe('#main');
		expect(root.querySelector('main')?.id, file).toBe('main');
		expect(root.querySelector('main')?.getAttribute('tabindex'), file).toBe(
			'-1',
		);
		expect(
			root.querySelector('#microlighter-status[role="status"][hidden]'),
			file,
		).not.toBeNull();
		expect(
			root.querySelector(
				'script[type="module"][src="./code-examples.js"]',
			),
			file,
		).not.toBeNull();
		const examples = root.querySelectorAll('pre > code');
		expect(examples.length, file).toBeGreaterThan(0);
		for (const code of examples) {
			const pre = code.parentElement;
			const lighter = pre.parentElement;
			expect(lighter.localName, file).toBe('micro-lighter');
			expect(lighter.getAttribute('language'), file).toMatch(
				/^(html|javascript|css|json|bash)$/,
			);
			if (/^\s*[\w$]+\.addEventListener\(/.test(code.textContent)) {
				expect(lighter.getAttribute('language'), file).toBe(
					'javascript',
				);
				expect(lighter.getAttribute('data-label'), file).toBeTruthy();
			}
			expect(lighter.getAttribute('controls'), file).toBe('copy');
			expect(pre.getAttribute('tabindex'), file).toBe('0');
			expect(pre.getAttribute('aria-label'), file).toBeTruthy();
			expect(code.textContent.trim(), file).not.toBe('');
		}
	}
});
