import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FormSaverElement } from '../form-saver.js';

describe('FormSaverElement', () => {
	let host;

	beforeEach(() => {
		window.localStorage.clear();
		host = document.createElement('div');
		document.body.appendChild(host);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		host.remove();
		window.localStorage.clear();
	});

	function setupFormSaver(markup = '') {
		host.innerHTML = `<form-saver>${markup}</form-saver>`;
		const element = host.querySelector('form-saver');
		const form = element.querySelector('form');
		element._initialize();

		return { element, form };
	}

	it('should be defined', () => {
		expect(customElements.get('form-saver')).toBe(FormSaverElement);
	});

	it('should create an instance', () => {
		const element = document.createElement('form-saver');
		expect(element).toBeInstanceOf(FormSaverElement);
		expect(element).toBeInstanceOf(HTMLElement);
	});

	it('should keep everything in light DOM', () => {
		const element = document.createElement('form-saver');
		expect(element.shadowRoot).toBeNull();
	});

	describe('Storage Key', () => {
		it('derives storage key from method and action', () => {
			const { element } = setupFormSaver(`
				<form action="/save-profile" method="post">
					<input name="firstName" value="Ada" />
				</form>
			`);

			element.saveFormState();
			const expectedAction = new URL(
				'/save-profile',
				window.location.href,
			).href;
			const key = `form-saver:post:${expectedAction}`;

			expect(window.localStorage.getItem(key)).toBeTruthy();
		});

		it('uses explicit storage-key when provided', () => {
			const { element } = setupFormSaver(`
				<form action="/save-profile" method="post">
					<input name="firstName" value="Ada" />
				</form>
			`);

			element.setAttribute('storage-key', 'custom-key');
			element.saveFormState();

			expect(window.localStorage.getItem('custom-key')).toBeTruthy();
		});
	});

	describe('Save and Restore', () => {
		it('saves supported fields and ignores file and password inputs', () => {
			const { element } = setupFormSaver(`
				<form action="/save-profile" method="post">
					<input name="text" value="Hello" />
					<input type="password" name="password" value="secret" />
					<textarea name="notes">Details</textarea>
					<input type="checkbox" name="agree" checked />
					<input type="radio" name="plan" value="basic" checked />
					<input type="radio" name="plan" value="pro" />
					<select name="country">
						<option value="us" selected>US</option>
						<option value="ca">CA</option>
					</select>
					<select name="topics" multiple>
						<option value="a" selected>A</option>
						<option value="b" selected>B</option>
						<option value="c">C</option>
					</select>
					<input type="file" name="resume" />
				</form>
			`);

			element.saveFormState();

			const expectedAction = new URL(
				'/save-profile',
				window.location.href,
			).href;
			const key = `form-saver:post:${expectedAction}`;
			const saved = JSON.parse(window.localStorage.getItem(key));

			expect(saved.text[0].value).toBe('Hello');
			expect(saved.notes[0].value).toBe('Details');
			expect(saved.agree[0].checked).toBe(true);
			expect(saved.plan).toHaveLength(2);
			expect(saved.country[0].value).toBe('us');
			expect(saved.topics[0].values).toEqual(['a', 'b']);
			expect(saved.password).toBeUndefined();
			expect(saved.resume).toBeUndefined();
		});

		it('supports field names that overlap object prototype properties', () => {
			const { element } = setupFormSaver(`
				<form action="/unusual-names" method="post">
					<input name="constructor" value="safe" />
				</form>
			`);

			expect(() => element.saveFormState()).not.toThrow();

			const action = new URL('/unusual-names', window.location.href).href;
			const saved = JSON.parse(
				window.localStorage.getItem(`form-saver:post:${action}`),
			);

			expect(saved.constructor[0].value).toBe('safe');
		});

		it('restores saved values on connect (DOM ready path)', () => {
			const action = new URL('/restore', window.location.href).href;
			window.localStorage.setItem(
				`form-saver:post:${action}`,
				JSON.stringify({
					firstName: [{ type: 'text', value: 'Grace' }],
					agree: [{ type: 'checkbox', checked: true, value: 'on' }],
					plan: [
						{ type: 'radio', checked: false, value: 'basic' },
						{ type: 'radio', checked: true, value: 'pro' },
					],
				}),
			);

			const { form } = setupFormSaver(`
				<form action="/restore" method="post">
					<input name="firstName" value="" />
					<input type="checkbox" name="agree" />
					<input type="radio" name="plan" value="basic" checked />
					<input type="radio" name="plan" value="pro" />
				</form>
			`);

			expect(form.elements.firstName.value).toBe('Grace');
			expect(form.elements.agree.checked).toBe(true);
			expect(form.elements.plan[0].checked).toBe(false);
			expect(form.elements.plan[1].checked).toBe(true);
		});

		it('never restores passwords and scrubs legacy password values', () => {
			const action = new URL('/legacy-password', window.location.href)
				.href;
			const key = `form-saver:post:${action}`;
			window.localStorage.setItem(
				key,
				JSON.stringify({
					username: [{ type: 'text', value: 'Ada' }],
					password: [{ type: 'password', value: 'secret' }],
				}),
			);

			const { form } = setupFormSaver(`
				<form action="/legacy-password" method="post">
					<input name="username" value="" />
					<input type="password" name="password" value="" />
				</form>
			`);

			expect(form.elements.username.value).toBe('Ada');
			expect(form.elements.password.value).toBe('');
			expect(JSON.parse(window.localStorage.getItem(key))).toEqual({
				username: [{ type: 'text', value: 'Ada' }],
			});
		});

		it('ignores malformed saved field values', () => {
			const action = new URL('/malformed', window.location.href).href;
			window.localStorage.setItem(
				`form-saver:post:${action}`,
				JSON.stringify({
					name: 'not-an-array',
					email: [null, 'not-an-object'],
				}),
			);

			const { form } = setupFormSaver(`
				<form action="/malformed" method="post">
					<input name="name" value="Original" />
					<input name="email" value="original@example.com" />
				</form>
			`);

			expect(form.elements.name.value).toBe('Original');
			expect(form.elements.email.value).toBe('original@example.com');
		});
	});

	describe('Autosave', () => {
		it('debounces event-driven saves', () => {
			vi.useFakeTimers();
			const { form } = setupFormSaver(`
				<form action="/debounce" method="post">
					<input name="message" value="" />
				</form>
			`);
			const key = `form-saver:post:${new URL('/debounce', window.location.href).href}`;

			form.elements.message.value = 'first';
			form.elements.message.dispatchEvent(
				new Event('input', { bubbles: true }),
			);
			form.elements.message.value = 'latest';
			form.elements.message.dispatchEvent(
				new Event('input', { bubbles: true }),
			);

			expect(window.localStorage.getItem(key)).toBeNull();
			vi.advanceTimersByTime(FormSaverElement._autosaveDelay);

			const saved = JSON.parse(window.localStorage.getItem(key));
			expect(saved.message[0].value).toBe('latest');
		});

		it('flushes a pending autosave on pagehide', () => {
			vi.useFakeTimers();
			const { form } = setupFormSaver(`
				<form action="/pagehide-flush" method="post">
					<input name="message" value="latest" />
				</form>
			`);
			const key = `form-saver:post:${new URL('/pagehide-flush', window.location.href).href}`;

			form.elements.message.dispatchEvent(
				new Event('input', { bubbles: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			expect(
				JSON.parse(window.localStorage.getItem(key)).message[0].value,
			).toBe('latest');
		});

		it('cancels pending autosaves when disconnected', () => {
			vi.useFakeTimers();
			const { element, form } = setupFormSaver(`
				<form action="/disconnect" method="post">
					<input name="message" value="unsaved" />
				</form>
			`);
			const key = `form-saver:post:${new URL('/disconnect', window.location.href).href}`;

			form.elements.message.dispatchEvent(
				new Event('input', { bubbles: true }),
			);
			element.remove();
			vi.runAllTimers();

			expect(window.localStorage.getItem(key)).toBeNull();
		});
	});

	describe('Storage errors', () => {
		it.each([
			{
				operation: 'read',
				method: '_readFromStorage',
				run: (element) => element.restoreFormState(),
			},
			{
				operation: 'write',
				method: '_saveToStorage',
				run: (element) => element.saveFormState(),
			},
			{
				operation: 'remove',
				method: '_removeFromStorage',
				run: (element) => element.clearSavedData(),
			},
		])(
			'emits a form-saver-error event when a $operation fails',
			({ operation, method, run }) => {
				const { element } = setupFormSaver(`
					<form action="/${operation}-error" method="post">
						<input name="message" value="hello" />
					</form>
				`);
				const error = new DOMException(
					'Storage unavailable',
					'SecurityError',
				);
				const listener = vi.fn();
				element.addEventListener('form-saver-error', listener);
				vi.spyOn(FormSaverElement, method).mockImplementation(() => {
					throw error;
				});

				run(element);

				expect(listener).toHaveBeenCalledOnce();
				expect(listener.mock.calls[0][0].detail).toEqual({
					operation,
					error,
				});
			},
		);
	});

	describe('Submit handling', () => {
		it('clears storage after submit followed by pagehide', () => {
			const { element, form } = setupFormSaver(`
				<form action="/submit" method="post">
					<input name="email" value="ada@example.com" />
				</form>
			`);

			element.saveFormState();

			const action = new URL('/submit', window.location.href).href;
			const key = `form-saver:post:${action}`;
			expect(window.localStorage.getItem(key)).toBeTruthy();

			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			expect(window.localStorage.getItem(key)).toBeNull();
		});

		it('does not clear when submit is prevented', () => {
			host.innerHTML = `<form-saver>
				<form action="/prevented" method="post">
					<input name="email" value="ada@example.com" />
				</form>
			</form-saver>`;

			const element = host.querySelector('form-saver');
			const form = element.querySelector('form');

			form.addEventListener('submit', (event) => event.preventDefault());
			element._initialize();
			element.saveFormState();

			const action = new URL('/prevented', window.location.href).href;
			const key = `form-saver:post:${action}`;

			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			expect(window.localStorage.getItem(key)).toBeTruthy();
		});
	});

	describe('Retention', () => {
		it('retains configured fields after successful submit', () => {
			const { element, form } = setupFormSaver(`
				<form action="/retain" method="post">
					<input name="email" value="ada@example.com" />
					<input name="message" value="hello" />
				</form>
			`);

			element.setAttribute('retain', 'email');
			element.saveFormState();

			const action = new URL('/retain', window.location.href).href;
			const key = `form-saver:post:${action}`;

			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			const saved = JSON.parse(window.localStorage.getItem(key));
			expect(saved.email).toBeTruthy();
			expect(saved.message).toBeUndefined();
		});

		it('never retains password fields after submit', () => {
			const { element, form } = setupFormSaver(`
				<form action="/retain-password" method="post">
					<input type="password" name="password" value="secret" />
				</form>
			`);

			element.setAttribute('retain', 'password');
			element.saveFormState();

			const action = new URL('/retain-password', window.location.href)
				.href;
			const key = `form-saver:post:${action}`;
			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			expect(window.localStorage.getItem(key)).toBeNull();
		});

		it('matches retain list by id if name is not present', () => {
			const { element, form } = setupFormSaver(`
				<form action="/retain-by-id" method="post">
					<input id="email-id" value="ada@example.com" />
					<input id="note-id" value="hello" />
				</form>
			`);

			element.setAttribute('retain', 'email-id');
			element.saveFormState();

			const action = new URL('/retain-by-id', window.location.href).href;
			const key = `form-saver:post:${action}`;

			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			const saved = JSON.parse(window.localStorage.getItem(key));
			expect(saved['email-id']).toBeTruthy();
			expect(saved['note-id']).toBeUndefined();
		});

		it('injects an accessible retain-choice checkbox before submit by default', () => {
			const { element, form } = setupFormSaver(`
				<form action="/toggle" method="post">
					<input name="email" value="ada@example.com" />
					<button type="submit">Submit</button>
				</form>
			`);

			element.setAttribute('retain', 'email');
			element.setAttribute('retain-choice', '');

			const control = form.querySelector(
				'[data-form-saver-retain-control]',
			);
			const checkbox = control.querySelector('input[type="checkbox"]');
			const label = control.querySelector('label');

			expect(control).toBeTruthy();
			expect(checkbox.checked).toBe(false);
			expect(label.getAttribute('for')).toBe(checkbox.id);
			expect(label.textContent).toBe(
				' Store my contact information for later',
			);
			expect(control.nextElementSibling?.getAttribute('type')).toBe(
				'submit',
			);
		});

		it('honors custom retain-choice-label and retain-choice-container', () => {
			const { element, form } = setupFormSaver(`
				<form action="/toggle-selector" method="post">
					<input name="email" value="ada@example.com" />
					<div class="slot-container"></div>
					<button type="submit">Submit</button>
				</form>
			`);

			element.setAttribute('retain', 'email');
			element.setAttribute('retain-choice', '');
			element.setAttribute('retain-choice-label', 'Remember my details');
			element.setAttribute('retain-choice-container', '.slot-container');

			const $container = form.querySelector('.slot-container');
			const control = $container.querySelector(
				'[data-form-saver-retain-control]',
			);
			const label = control.querySelector('label');

			expect(label.textContent).toBe(' Remember my details');
			expect($container.contains(control)).toBe(true);
		});

		it('retains fields only when user opts in via injected checkbox', () => {
			const { element, form } = setupFormSaver(`
				<form action="/toggle-retain" method="post">
					<input name="email" value="ada@example.com" />
					<input name="message" value="hello" />
					<button type="submit">Submit</button>
				</form>
			`);

			element.setAttribute('retain', 'email');
			element.setAttribute('retain-choice', '');
			element.saveFormState();

			const action = new URL('/toggle-retain', window.location.href).href;
			const key = `form-saver:post:${action}`;

			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));
			expect(window.localStorage.getItem(key)).toBeNull();

			element.saveFormState();
			const checkbox = form.querySelector(
				'[data-form-saver-retain-control] input[type="checkbox"]',
			);
			checkbox.checked = true;
			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			);
			window.dispatchEvent(new Event('pagehide'));

			const saved = JSON.parse(window.localStorage.getItem(key));
			expect(saved.email).toBeTruthy();
			expect(saved.message).toBeUndefined();
		});
	});

	// Add more tests here
});
