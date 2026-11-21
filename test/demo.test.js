import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(resolve(file), 'utf8');

it('identifies the component in the generated site-root page title', () => {
	const workflow = read('.github/workflows/pages.yml');
	const pkg = JSON.parse(read('package.json'));
	const title = workflow.match(/<title>(.*?)<\/title>/s)?.[1];
	expect(title).toBe(pkg.name.split('/').pop());
});

it('trims block-edge margins inside demo sections', () => {
	const styles = read('demo/demo-shell.css');
	expect(styles).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});

it('introduces each behavior demo once on the main demo page', () => {
	const template = document.createElement('template');
	template.innerHTML = read('demo/index.html');
	for (const page of ['behavior.html', 'encrypted.html']) {
		expect(
			template.content.querySelectorAll(`main a[href="./${page}"]`),
		).toHaveLength(1);
	}
});

describe('demo accessibility baseline', () => {
	it('keeps feedback and reading panels on paired reading surfaces', () => {
		const css = read('demo/demo-shell.css') + read('demo/styles.css');
		expect(css).not.toMatch(
			/GrayText|ActiveText|HighlightText|SelectedItem/,
		);
		expect(css).not.toMatch(/outline:.*AccentColor|opacity:\s*0\.8/);
		expect(css).toMatch(/\.demo\s*\{[^}]*color:\s*CanvasText/s);
	});

	it.each([
		'index.html',
		'esm.html',
		'unpkg.html',
		'encrypted.html',
		'behavior.html',
	])(
		'%s has responsive code/live pairs and authored recovery feedback',
		(file) => {
			const html = read(`demo/${file}`);
			expect(html).toContain('class="code-demo-pair"');
			expect(html).toContain('role="status"');
			expect(html).toContain('data-error=');
			expect(html).toContain('Without JavaScript');
			expect(html).toContain('<footer>');
			expect(html).not.toContain('Save draft now');
			expect(html).not.toContain('data-action="save"');
			expect(html).not.toMatch(/data-(ready|restored|saved)=/);
			const template = document.createElement('template');
			template.innerHTML = html;
			for (const saver of template.content.querySelectorAll(
				'form-saver',
			)) {
				const feedback = saver.querySelector('[role="status"]');
				expect(
					feedback,
					saver.getAttribute('storage-key'),
				).not.toBeNull();
				expect(feedback.textContent).toBe('');
			}
		},
	);
});
