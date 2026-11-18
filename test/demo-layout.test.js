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

it('introduces each behavior demo once on the main demo page', async () => {
	const template = document.createElement('template');
	template.innerHTML = await readFile('demo/index.html', 'utf8');
	for (const page of ['behavior.html', 'encrypted.html']) {
		expect(
			template.content.querySelectorAll(`main a[href="./${page}"]`),
		).toHaveLength(1);
	}
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
			if (/^\s*[\w$]+\.addEventListener\(/.test(code.textContent)) {
				expect(lighter.getAttribute('language'), file).toBe(
					'javascript',
				);
				expect(lighter.getAttribute('data-label'), file).toBe(
					'JavaScript',
				);
			}
			expect(lighter.getAttribute('controls'), file).toBe('copy');
			expect(pre.getAttribute('tabindex'), file).toBe('0');
			expect(pre.getAttribute('aria-label'), file).toBeTruthy();
			expect(code.textContent.trim(), file).not.toBe('');
		}
	}
	expect(pages).toBeGreaterThan(0);
});

let optionalTheme;
afterEach(() => {
	document.body.replaceChildren();
	document.head
		.querySelectorAll('link[data-code-theme]')
		.forEach((link) => link.remove());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.resetModules();
});

function authoredSnippet() {
	vi.spyOn(document.head, 'insertBefore').mockImplementation((theme) => {
		optionalTheme = theme;
		return theme;
	});
	document.body.innerHTML = `
		<p id="microlighter-status" hidden></p>
		<micro-lighter language="html"><pre><code><mark>&lt;example-tag&gt;</mark>
  &lt;p&gt;Keep this text&lt;/p&gt;
<mark>&lt;/example-tag&gt;</mark></code></pre></micro-lighter>`;
	vi.stubGlobal('Highlight', class {});
	vi.stubGlobal('CSS', { highlights: new Map() });
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/html.js',
		() => ({ default: { dependencies: ['javascript'] } }),
	);
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/javascript.js',
		() => ({ default: { dependencies: [] } }),
	);
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js',
		() => ({}),
	);
	return document.querySelector('code');
}

it('preserves complete text after loading the required grammars and element', async () => {
	const code = authoredSnippet();
	const text = code.textContent;
	await import('../demo/code-examples.js');
	expect(code.textContent).toBe(text);
	expect(code.childNodes).toHaveLength(1);
	expect(document.querySelector('#microlighter-status').hidden).toBe(true);
	const theme = optionalTheme;
	expect(theme.media).toBe('print');
	theme.dispatchEvent(new Event('load'));
	expect(theme.media).toBe('all');
});

it('retains authored marks and reports a required grammar failure', async () => {
	const code = authoredSnippet();
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/javascript.js',
		() => {
			throw new Error('Grammar unavailable');
		},
	);
	await import('../demo/code-examples.js');
	expect(code.querySelector('mark')?.textContent).toBe('<example-tag>');
	expect(document.querySelector('#microlighter-status').hidden).toBe(false);
	expect(log).toHaveBeenCalledWith(
		'MicroLighter could not load:',
		expect.any(Error),
	);
});

it('retains authored marks when custom highlights are unsupported', async () => {
	const code = authoredSnippet();
	vi.stubGlobal('Highlight', undefined);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	await import('../demo/code-examples.js');
	expect(code.querySelector('mark')?.textContent).toBe('<example-tag>');
	expect(
		document.querySelector('#microlighter-status').textContent,
	).toContain('Code remains readable and selectable');
	expect(document.querySelector('#microlighter-status').hidden).toBe(false);
});

it('retains authored marks and reports an unavailable entry module', async () => {
	const code = authoredSnippet();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.doMock(
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js',
		() => {
			throw new Error('CDN unavailable');
		},
	);
	await import('../demo/code-examples.js');
	expect(code.querySelector('mark')?.textContent).toBe('<example-tag>');
	expect(document.querySelector('#microlighter-status').hidden).toBe(false);
});

it.each(['before', 'after'])(
	'reports a theme-only failure %s successful enhancement without claiming the controls failed',
	async (timing) => {
		const code = authoredSnippet();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		if (timing === 'before') {
			vi.doMock(
				'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js',
				() => {
					optionalTheme.dispatchEvent(new Event('error'));
					return {};
				},
			);
		}
		await import('../demo/code-examples.js');
		if (timing === 'after') optionalTheme.dispatchEvent(new Event('error'));
		const status = document.querySelector('#microlighter-status');
		expect(status.hidden).toBe(false);
		expect(status.textContent).toContain(
			'Code highlighting and Copy controls are available',
		);
		expect(status.textContent).toContain('syntax theme could not load');
		expect(code.childNodes).toHaveLength(1);
		expect(log).toHaveBeenCalledWith(
			'MicroLighter theme could not load:',
			expect.any(Error),
		);
	},
);

it('does not make the optional CDN stylesheet render-blocking', async () => {
	for (const file of await readdir('demo', { recursive: true })) {
		if (!file.endsWith('.html')) continue;
		const template = document.createElement('template');
		template.innerHTML = await readFile(`demo/${file}`, 'utf8');
		expect(
			template.content.querySelector('link[href*="microlighter"]'),
			file,
		).toBeNull();
	}
});
