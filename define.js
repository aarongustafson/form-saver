import { ComponentNameElement } from './COMPONENT-NAME.js';

export function defineComponentName(tagName = 'COMPONENT-NAME') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, ComponentNameElement);
	}

	return true;
}

defineComponentName();
