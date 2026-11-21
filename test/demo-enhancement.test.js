import { readFile, readdir } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';

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
		<p id="microlighter-status" hidden
			data-loading-message="Loading optional code highlighting and Copy controls."
			data-failure-message="MicroLighter could not load. Code remains readable and selectable; the component loads independently."
			data-theme-failure-message="Code highlighting and Copy controls are available, but the syntax theme could not load. The component loads independently."></p>
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

it('uses authored translated loading and failure messages', async () => {
	authoredSnippet();
	const status = document.querySelector('#microlighter-status');
	status.dataset.loadingMessage = 'Chargement du code.';
	status.dataset.failureMessage = 'Le code reste lisible.';
	vi.stubGlobal('Highlight', undefined);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	await import('../demo/code-examples.js');
	expect(status.textContent).toBe('Le code reste lisible.');
	expect(status.hidden).toBe(false);
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
