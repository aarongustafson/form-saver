import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('classifies every nonignored demo page and loads shared defaults before local styles', async () => {
	const pages = JSON.parse(await readFile('demo/pages.json', 'utf8'));
	const files = execFileSync(
		'git',
		[
			'ls-files',
			'--cached',
			'--others',
			'--exclude-standard',
			'--',
			'demo/*.html',
		],
		{ encoding: 'utf8' },
	)
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((file) => file.slice('demo/'.length));
	expect(Object.keys(pages).sort()).toEqual([...new Set(files)].sort());
	expect(Object.values(pages)).toContain('full');
	for (const [file, kind] of Object.entries(pages)) {
		expect(['full', 'embedded', 'fixture'], file).toContain(kind);
		expect(file).toMatch(/^[a-z0-9][a-z0-9/-]*\.html$/);
		const html = await readFile(`demo/${file}`, 'utf8');
		const template = document.createElement('template');
		template.innerHTML = html;
		const root = template.content;
		if (kind !== 'full') continue;
		expect(html, file).toMatch(/<body\b[^>]*data-demo-page="full"/);
		const styles = [...root.querySelectorAll('link[rel="stylesheet"]')].map(
			(link) => link.getAttribute('href'),
		);
		expect(styles[0], file).toBe('./demo-shell.css');
		expect(styles.at(-1), file).toBe('./styles.css');
		for (const style of root.querySelectorAll('style')) {
			expect(style.closest('.demo'), file).not.toBeNull();
		}
		for (const example of root.querySelectorAll('.demo')) {
			expect(
				example.getAttribute('data-demo-label')?.trim(),
				file,
			).toBeTruthy();
		}
		const status = root.querySelector('#microlighter-status');
		for (const message of [
			'data-loading-message',
			'data-failure-message',
			'data-theme-failure-message',
		]) {
			expect(
				status?.getAttribute(message)?.trim(),
				`${file}: ${message}`,
			).toBeTruthy();
		}
	}
});
