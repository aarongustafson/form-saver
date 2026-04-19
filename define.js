import { FormSaverElement } from './form-saver.js';

export function defineComponentName(tagName = 'form-saver') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, FormSaverElement);
	}

	return true;
}

defineComponentName();
