import { beforeAll } from 'vitest';
import { FormSaverElement } from '../form-saver.js';

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get('form-saver')) {
		customElements.define('form-saver', FormSaverElement);
	}

	// Make the class available globally for testing static methods
	globalThis.FormSaverElement = FormSaverElement;
});
