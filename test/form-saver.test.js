import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormSaverElement } from '../form-saver.js';

describe('FormSaverElement', () => {
	let element;

	beforeEach(() => {
		element = document.createElement('form-saver');
		document.body.appendChild(element);
	});

	afterEach(() => {
		element.remove();
	});

	it('should be defined', () => {
		expect(customElements.get('form-saver')).toBe(FormSaverElement);
	});

	it('should create an instance', () => {
		expect(element).toBeInstanceOf(FormSaverElement);
		expect(element).toBeInstanceOf(HTMLElement);
	});

	it('should have a shadow root', () => {
		expect(element.shadowRoot).toBeTruthy();
	});

	describe('Shadow DOM Best Practices', () => {
		it('should create shadow root in constructor', () => {
			const newElement = new FormSaverElement();
			expect(newElement.shadowRoot).toBeTruthy();
		});

		it('should support the hidden attribute with proper display style', () => {
			element.setAttribute('hidden', '');
			const styles = window.getComputedStyle(element);
			expect(styles.display).toBe('none');
		});

		it('should have default display style of block', () => {
			const styles = window.getComputedStyle(element);
			expect(styles.display).toBe('block');
		});
	});

	describe('Attributes and Properties', () => {
		it('should reflect attribute to property', () => {
			element.setAttribute('example-attribute', 'test-value');
			expect(element.exampleAttribute).toBe('test-value');
		});

		it('should reflect property to attribute', () => {
			element.exampleAttribute = 'property-value';
			expect(element.getAttribute('example-attribute')).toBe(
				'property-value',
			);
		});

		it('should remove attribute when property set to null', () => {
			element.exampleAttribute = 'test';
			expect(element.hasAttribute('example-attribute')).toBe(true);

			element.exampleAttribute = null;
			expect(element.hasAttribute('example-attribute')).toBe(false);
		});

		it('should remove attribute when property set to undefined', () => {
			element.exampleAttribute = 'test';
			expect(element.hasAttribute('example-attribute')).toBe(true);

			element.exampleAttribute = undefined;
			expect(element.hasAttribute('example-attribute')).toBe(false);
		});

		it('should handle lazy property upgrade (property set before element upgrade)', () => {
			// Create an element but don't connect it yet
			const uninitializedElement =
				document.createElement('form-saver');

			// Set property before connecting (simulates framework setting property before upgrade)
			uninitializedElement.exampleAttribute = 'early-value';

			// Now connect it
			document.body.appendChild(uninitializedElement);

			// Property should be preserved
			expect(uninitializedElement.exampleAttribute).toBe('early-value');
			expect(uninitializedElement.getAttribute('example-attribute')).toBe(
				'early-value',
			);

			uninitializedElement.remove();
		});
	});

	// Add more tests here
});
