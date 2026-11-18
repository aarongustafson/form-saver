const status = document.getElementById('microlighter-status');
status.hidden = false;
status.textContent = 'Loading optional code highlighting and Copy controls.';

try {
	await import('https://cdn.jsdelivr.net/npm/microlighter@2.2.0/dist/micro-lighter-element.min.js');
	// MicroLighter requires one text node; retain authored marks until it loads.
	for (const code of document.querySelectorAll(
		'micro-lighter > pre > code',
	)) {
		if (code.children.length) code.textContent = code.textContent;
	}
	status.textContent = '';
	status.hidden = true;
} catch (error) {
	console.error('MicroLighter could not load:', error);
	status.textContent =
		'MicroLighter could not load. Code remains readable and selectable; the component loads independently.';
}
