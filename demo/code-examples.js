const status = document.getElementById('microlighter-status');
status.hidden = false;
status.textContent = 'Loading optional code highlighting and Copy controls.';

function reportFailure(error) {
	console.error('MicroLighter could not load:', error);
	status.hidden = false;
	status.textContent =
		'MicroLighter could not load. Code remains readable and selectable; the component loads independently.';
}

try {
	if (typeof Highlight !== 'function' || !globalThis.CSS?.highlights) {
		throw new Error('CSS Custom Highlight API unavailable.');
	}

	let themeFailed = false;
	const theme = document.createElement('link');
	theme.rel = 'stylesheet';
	theme.href =
		'https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/themes/github.css';
	theme.dataset.codeTheme = '';
	theme.media = 'print';
	theme.addEventListener(
		'load',
		() => {
			theme.media = 'all';
		},
		{ once: true },
	);
	theme.addEventListener(
		'error',
		() => {
			themeFailed = true;
			reportFailure(new Error('Optional syntax theme unavailable.'));
		},
		{ once: true },
	);
	document.head.insertBefore(
		theme,
		document.head.querySelector('link[rel="stylesheet"]'),
	);

	const panels = [...document.querySelectorAll('micro-lighter[language]')];
	const grammars = {
		html: () =>
			import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/html.js'),
		css: () =>
			import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/css.js'),
		javascript: () =>
			import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/javascript.js'),
		json: () =>
			import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/json.js'),
		bash: () =>
			import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/grammars/bash.js'),
	};
	const loaded = new Set();
	async function loadGrammar(language) {
		if (!Object.hasOwn(grammars, language)) {
			throw new Error(`Unsupported demo language: ${language}`);
		}
		if (loaded.has(language)) return;
		loaded.add(language);
		const { default: grammar } = await grammars[language]();
		await Promise.all((grammar.dependencies ?? []).map(loadGrammar));
	}
	await Promise.all(
		panels.map((panel) => loadGrammar(panel.getAttribute('language'))),
	);
	await import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js');
	// The pinned highlighter requires one text node and swallows grammar failures.
	for (const panel of panels) {
		const code = panel.querySelector(':scope > pre > code');
		if (code?.children.length) code.textContent = code.textContent;
	}
	if (!themeFailed) {
		status.textContent = '';
		status.hidden = true;
	}
} catch (error) {
	reportFailure(error);
}
