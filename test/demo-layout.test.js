import { readFile, readdir } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';

it('identifies the component in the generated site-root page title', async () => {
	const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
	const pkg = JSON.parse(await readFile('package.json', 'utf8'));
	const title = workflow.match(/<title>(.*?)<\/title>/s)?.[1];
	expect(title).toBe(pkg.name.split('/').pop());
});

it('trims block-edge margins inside demo sections', async () => {
	const styles = await readFile('demo/styles.css', 'utf8');
	expect(styles).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});

it('keeps code readable while progressively enhancing every full demo page', async () => {
	let pages = 0;
	for (const file of await readdir('demo', { recursive: true })) {
		if (!file.endsWith('.html')) continue;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		const root = template.content;
		const examples = root.querySelectorAll('pre > code');
		if (!root.querySelector('main') || !examples.length) continue;
		pages += 1;
		expect(root.querySelector('a.skip-link')?.getAttribute('href')).toBe(
			'#main',
		);
		expect(root.querySelector('main')?.id).toBe('main');
		expect(root.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
		expect(
			root.querySelector('link[href="./demo-shell.css"]'),
			file,
		).not.toBeNull();
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
		for (const code of examples) {
			const pre = code.parentElement;
			const lighter = pre.parentElement;
			expect(lighter.localName, file).toBe('micro-lighter');
			expect(lighter.getAttribute('language'), file).toMatch(
				/^(html|javascript|css|json|bash)$/,
			);
			expect(lighter.getAttribute('controls'), file).toBe('copy');
			expect(pre.getAttribute('tabindex'), file).toBe('0');
			expect(pre.getAttribute('aria-label'), file).toBeTruthy();
			expect(code.textContent.trim(), file).not.toBe('');
		}
	}
	expect(pages).toBeGreaterThan(0);
});

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.resetModules();
});

it('preserves the complete snippet when enabling syntax highlighting', async () => {
	document.body.innerHTML = `
		<p id="microlighter-status" hidden></p>
		<micro-lighter><pre><code><mark>&lt;example-tag&gt;</mark>
  &lt;p&gt;Keep this text&lt;/p&gt;
<mark>&lt;/example-tag&gt;</mark></code></pre></micro-lighter>`;
	const code = document.querySelector('code');
	const text = code.textContent;
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js',
		() => ({}),
	);
	await import('../demo/code-examples.js');
	expect(code.textContent).toBe(text);
	expect(code.childNodes).toHaveLength(1);
	expect(document.querySelector('#microlighter-status').hidden).toBe(true);
});

it('keeps authored highlights and reports an unavailable optional enhancement', async () => {
	document.body.innerHTML = `
		<p id="microlighter-status" hidden></p>
		<micro-lighter><pre><code><mark>&lt;example-tag&gt;</mark></code></pre></micro-lighter>`;
	const error = new Error('CDN unavailable');
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js',
		() => {
			throw error;
		},
	);
	await import('../demo/code-examples.js');
	expect(document.querySelector('code mark')?.textContent).toBe(
		'<example-tag>',
	);
	const status = document.querySelector('#microlighter-status');
	expect(status.hidden).toBe(false);
	expect(status.textContent).toContain(
		'Code remains readable and selectable',
	);
	expect(log).toHaveBeenCalledWith(
		'MicroLighter could not load:',
		expect.any(Error),
	);
});
