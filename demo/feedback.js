// These messages belong to the demo author, not the component's API.
for (const saver of document.querySelectorAll('form-saver')) {
	const feedback = saver.querySelector('[role="status"]');
	if (!feedback) continue;

	let failed = false;
	saver.addEventListener('form-saver-error', () => {
		failed = true;
		feedback.textContent = feedback.dataset.error;
	});

	saver.addEventListener('click', (event) => {
		const button = event.target.closest('button[data-action]');
		if (!button || button.disabled) return;
		failed = false;
		if (button.dataset.action === 'save') {
			saver.saveFormState();
			if (!failed) feedback.textContent = feedback.dataset.saved;
		}
	});

	customElements.whenDefined('form-saver').then(() => {
		for (const button of saver.querySelectorAll('[data-action]')) {
			button.disabled = false;
		}
		if (!failed) {
			try {
				feedback.textContent = localStorage.getItem(saver.storageKey)
					? feedback.dataset.restored
					: feedback.dataset.ready;
			} catch {
				feedback.textContent = feedback.dataset.error;
			}
		}
	});
}
