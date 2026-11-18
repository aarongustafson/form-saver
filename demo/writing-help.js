export function initialize(saver, { signal }) {
	const button = saver.querySelector('[data-toggle-help]');
	const help = saver.querySelector(
		`#${button?.getAttribute('aria-controls')}`,
	);
	if (
		!button ||
		!help ||
		!button.dataset.showLabel ||
		!button.dataset.hideLabel
	) {
		throw new TypeError(
			'Writing help needs a button, help panel, and authored labels.',
		);
	}

	const update = (expanded) => {
		help.hidden = !expanded;
		button.setAttribute('aria-expanded', String(expanded));
		button.textContent = expanded
			? button.dataset.hideLabel
			: button.dataset.showLabel;
	};
	update(false);
	button.hidden = false;
	button.addEventListener('click', () => update(help.hidden), { signal });

	return () => {
		update(true);
		button.hidden = true;
	};
}
