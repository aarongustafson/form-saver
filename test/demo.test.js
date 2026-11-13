import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(resolve(file), 'utf8');

describe('demo accessibility baseline', () => {
	it('keeps feedback and reading panels on paired reading surfaces', () => {
		const css = read('demo/styles.css');
		expect(css).not.toMatch(
			/GrayText|ActiveText|HighlightText|SelectedItem/,
		);
		expect(css).not.toMatch(/outline:.*AccentColor|opacity:\s*0\.8/);
		expect(css).toMatch(/\.demo\s*\{[^}]*color:\s*CanvasText/s);
	});

	it.each(['index.html', 'esm.html', 'unpkg.html'])(
		'%s has responsive code/live pairs and authored recovery feedback',
		(file) => {
			const html = read(`demo/${file}`);
			expect(html).toContain('class="code-demo-pair"');
			expect(html).toContain('role="status"');
			expect(html).toContain('data-error=');
			expect(html).toContain('Without JavaScript');
			expect(html).toContain('<footer>');
			const template = document.createElement('template');
			template.innerHTML = html;
			for (const saver of template.content.querySelectorAll(
				'form-saver',
			)) {
				expect(
					saver.querySelector('[role="status"]'),
					saver.getAttribute('storage-key'),
				).not.toBeNull();
			}
		},
	);
});
