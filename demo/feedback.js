// These messages belong to the demo author, not the component's API.
for (const saver of document.querySelectorAll('form-saver')) {
	const feedback = saver.querySelector('[role="status"]');
	if (!feedback) continue;

	saver.addEventListener('form-saver-error', () => {
		feedback.textContent = feedback.dataset.error;
	});
}
