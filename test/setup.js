import { beforeAll } from 'vitest';
import { ComponentNameElement } from '../COMPONENT-NAME.js';

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get('COMPONENT-NAME')) {
		customElements.define('COMPONENT-NAME', ComponentNameElement);
	}

	// Make the class available globally for testing static methods
	globalThis.ComponentNameElement = ComponentNameElement;
});
