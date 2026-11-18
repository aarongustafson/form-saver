import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { FormSaverElement } from '../form-saver.js';

const fixture = pathToFileURL(resolve('test/fixtures/storage-hooks.js')).href;
const script = 'https://example.test/storage-hooks.js';
const state = { message: [{ type: 'text', value: 'saved' }] };
const deferred = () => {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('storage transformation modules', () => {
	let element;
	let errors;
	let hooks;

	beforeEach(() => {
		localStorage.clear();
		hooks = {
			beforeSave: vi.fn(async (value) => ({ wrapped: value })),
			beforeRestore: vi.fn(async (payload) => payload.wrapped),
		};
		element = document.createElement('form-saver');
		element.script = script;
		element.storageKey = 'hooks-test';
		element.innerHTML = `<form>
			<input name="message" value="current">
			<input name="email" value="demo@example.com">
			<input name="password" type="password" value="secret">
			<button type="submit">Send</button>
		</form>`;
		vi.spyOn(element, 'loadModule').mockImplementation(
			() => import(fixture),
		);
		element.configureStorage = vi.fn(() => {
			element.beforeSave = hooks.beforeSave;
			element.beforeRestore = hooks.beforeRestore;
		});
		errors = vi.fn();
		element.addEventListener('form-saver-error', errors);
	});

	afterEach(() => {
		vi.useRealTimers();
		element.remove();
		localStorage.clear();
		vi.restoreAllMocks();
	});

	async function connect() {
		document.body.append(element);
		await vi.waitFor(() =>
			expect(element.configureStorage).toHaveBeenCalledOnce(),
		);
	}

	it('awaits per-element initialization, transforms saves and restores before validation', async () => {
		const init = deferred();
		element.configureStorage.mockImplementation(async () => {
			await init.promise;
			element.beforeSave = hooks.beforeSave;
			element.beforeRestore = hooks.beforeRestore;
		});
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		await connect();
		expect(element.querySelector('input').value).toBe('current');
		expect(hooks.beforeRestore).not.toHaveBeenCalled();
		init.resolve(hooks);
		await vi.waitFor(() =>
			expect(element.querySelector('input').value).toBe('saved'),
		);
		await element.saveFormState();
		const payload = JSON.parse(localStorage.getItem('hooks-test'));
		expect(payload.wrapped.message).toEqual(state.message);
		expect(payload.wrapped.password).toBeUndefined();
		expect(hooks.beforeSave).toHaveBeenCalledOnce();
	});

	it.each(['beforeSave', 'beforeRestore'])(
		'reports %s failures without plaintext fallback or deleting the draft',
		async (operation) => {
			const error = new Error('Key unavailable');
			hooks[operation].mockRejectedValue(error);
			const original = JSON.stringify({ wrapped: state });
			localStorage.setItem('hooks-test', original);
			await connect();
			if (operation === 'beforeSave') await element.saveFormState();
			await vi.waitFor(() => expect(errors).toHaveBeenCalled());
			expect(errors.mock.calls[0][0].detail).toEqual({
				operation,
				error,
			});
			expect(localStorage.getItem('hooks-test')).toBe(original);
		},
	);

	it.each(['reject', 'invalid'])(
		'fails closed when module initialization is %s',
		async (failure) => {
			if (failure === 'reject') {
				element.configureStorage.mockRejectedValue(
					new Error('Unauthorized'),
				);
			} else {
				element.configureStorage.mockResolvedValue({
					beforeSave: null,
				});
			}
			await connect();
			await element.saveFormState();
			expect(localStorage.getItem('hooks-test')).toBeNull();
			expect(errors.mock.calls[0][0].detail.operation).toBe('initialize');
		},
	);

	it('reports a missing module without persisting form values', async () => {
		element.loadModule.mockRejectedValue(new Error('Module unavailable'));
		document.body.append(element);
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		await element.saveFormState();
		expect(errors.mock.calls[0][0].detail.operation).toBe('initialize');
		expect(localStorage.getItem('hooks-test')).toBeNull();
	});

	it('waits for initialization before saving edits made during key acquisition', async () => {
		const init = deferred();
		element.configureStorage.mockImplementation(async () => {
			await init.promise;
			element.beforeSave = hooks.beforeSave;
			element.beforeRestore = hooks.beforeRestore;
		});
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		await connect();
		element.querySelector('input').value = 'edited while loading';
		const pending = element.saveFormState();
		expect(hooks.beforeSave).not.toHaveBeenCalled();
		init.resolve(hooks);
		await pending;
		expect(hooks.beforeRestore).not.toHaveBeenCalled();
		expect(
			JSON.parse(localStorage.getItem('hooks-test')).wrapped.message[0]
				.value,
		).toBe('edited while loading');
	});

	it('does not fall back to plaintext even when an initialization error listener saves', async () => {
		element.setAttribute('script', ' ');
		element.addEventListener(
			'form-saver-error',
			() => element.saveFormState(),
			{ once: true },
		);
		document.body.append(element);
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		await element.saveFormState();
		expect(localStorage.getItem('hooks-test')).toBeNull();
	});

	it('initializes again after reconnecting and discards the old hooks', async () => {
		await connect();
		element.remove();
		element.configureStorage.mockImplementation(() => {
			element.beforeSave = async () => ({ reconnected: true });
			element.beforeRestore = hooks.beforeRestore;
		});
		document.body.append(element);
		await vi.waitFor(() =>
			expect(element.configureStorage).toHaveBeenCalledTimes(2),
		);
		await element.saveFormState();
		expect(JSON.parse(localStorage.getItem('hooks-test'))).toEqual({
			reconnected: true,
		});
		expect(hooks.beforeSave).not.toHaveBeenCalled();
	});

	it('passes a JSON null payload to beforeRestore instead of treating it as absent', async () => {
		hooks.beforeSave.mockResolvedValue(null);
		hooks.beforeRestore.mockResolvedValue(state);
		await connect();
		await element.saveFormState();
		await element.restoreFormState();
		expect(hooks.beforeRestore).toHaveBeenCalledWith(null);
		expect(element.querySelector('input').value).toBe('saved');
	});

	it.each(['read', 'write'])(
		'reports %s failures in the transformed storage path',
		async (operation) => {
			await connect();
			const error = new Error('Storage unavailable');
			vi.spyOn(
				FormSaverElement,
				operation === 'read' ? '_readFromStorage' : '_saveToStorage',
			).mockImplementation(() => {
				throw error;
			});
			if (operation === 'read') await element.restoreFormState();
			else await element.saveFormState();
			expect(errors.mock.calls[0][0].detail).toEqual({
				operation,
				error,
			});
		},
	);

	it('re-transforms sanitized state rather than writing decrypted values', async () => {
		localStorage.setItem(
			'hooks-test',
			JSON.stringify({
				wrapped: {
					...state,
					password: [{ type: 'password', value: 'legacy' }],
				},
			}),
		);
		await connect();
		await vi.waitFor(() => expect(hooks.beforeSave).toHaveBeenCalledOnce());
		expect(JSON.parse(localStorage.getItem('hooks-test'))).toEqual({
			wrapped: state,
		});
		expect(element.querySelector('[name=password]').value).toBe('secret');
	});

	it('reports invalid restored state and leaves the payload intact', async () => {
		hooks.beforeRestore.mockResolvedValue('invalid');
		localStorage.setItem('hooks-test', '{"wrapped":"opaque"}');
		await connect();
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		expect(errors.mock.calls[0][0].detail.operation).toBe('beforeRestore');
		expect(localStorage.getItem('hooks-test')).toBe('{"wrapped":"opaque"}');
	});

	it.each([
		{ message: 'not an array' },
		{ message: [null] },
		{ message: [{ type: 'text', value: 42 }] },
		{ message: [{ type: 'checkbox', checked: 'false', value: 'yes' }] },
		{ message: [{ type: 'select-multiple', values: [42] }] },
		{ message: Array(1) },
	])(
		'preserves the whole draft when a restore hook returns invalid state: %j',
		async (invalid) => {
			const original = JSON.stringify({ wrapped: state });
			localStorage.setItem('hooks-test', original);
			hooks.beforeRestore.mockResolvedValue(invalid);
			await connect();
			await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
			expect(errors.mock.calls[0][0].detail.operation).toBe(
				'beforeRestore',
			);
			expect(localStorage.getItem('hooks-test')).toBe(original);
			expect(element.querySelector('input').value).toBe('current');
		},
	);

	it('reports malformed JSON without calling the restore hook or removing the draft', async () => {
		const original = '{"wrapped":';
		localStorage.setItem('hooks-test', original);
		await connect();
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		expect(errors.mock.calls[0][0].detail.operation).toBe('read');
		expect(hooks.beforeRestore).not.toHaveBeenCalled();
		expect(localStorage.getItem('hooks-test')).toBe(original);
	});

	it.each(['neither', 'beforeSave', 'beforeRestore'])(
		'allows an initializer to configure %s storage hooks',
		async (selected) => {
			element.configureStorage.mockImplementation(() => {
				if (selected === 'beforeSave')
					element.beforeSave = hooks.beforeSave;
				if (selected === 'beforeRestore')
					element.beforeRestore = hooks.beforeRestore;
			});
			const original =
				selected === 'beforeRestore' ? { wrapped: state } : state;
			localStorage.setItem('hooks-test', JSON.stringify(original));
			await connect();
			await vi.waitFor(() =>
				expect(element.querySelector('input').value).toBe('saved'),
			);
			await element.saveFormState();
			const saved = JSON.parse(localStorage.getItem('hooks-test'));
			expect(
				selected === 'beforeSave'
					? saved.wrapped.message
					: saved.message,
			).toEqual(state.message);
			expect(errors).not.toHaveBeenCalled();
		},
	);

	it('accepts a behavior module without an initializer', async () => {
		element.loadModule.mockResolvedValue({});
		document.body.append(element);
		await vi.waitFor(() =>
			expect(element.loadModule).toHaveBeenCalledOnce(),
		);
		await element.saveFormState();
		expect(
			JSON.parse(localStorage.getItem('hooks-test')).message[0].value,
		).toBe('current');
		expect(errors).not.toHaveBeenCalled();
	});

	it.each(['disconnect', 'script'])(
		'aborts module listeners and runs cleanup on %s',
		async (action) => {
			const listener = vi.fn();
			const cleanup = vi.fn();
			let signal;
			element.configureStorage.mockImplementation((saver, context) => {
				signal = context.signal;
				document.addEventListener('storage-review', listener, {
					signal,
				});
				saver.beforeSave = hooks.beforeSave;
				return cleanup;
			});
			await connect();
			await element.saveFormState();
			if (action === 'disconnect') element.remove();
			else element.script = null;
			document.dispatchEvent(new Event('storage-review'));
			expect(signal.aborted).toBe(true);
			expect(listener).not.toHaveBeenCalled();
			expect(cleanup).toHaveBeenCalledOnce();
			expect(element.beforeSave).toBeNull();
			expect(element.beforeRestore).toBeNull();
		},
	);

	it('disposes late initialization results without reactivating a disconnected module', async () => {
		const pending = deferred();
		const cleanup = vi.fn();
		let signal;
		element.configureStorage.mockImplementation((saver, context) => {
			signal = context.signal;
			return pending.promise;
		});
		await connect();
		element.remove();
		pending.resolve(cleanup);
		await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
		expect(signal.aborted).toBe(true);
		expect(errors).not.toHaveBeenCalled();
	});

	it('reports cleanup failures and still clears module hooks', async () => {
		element.configureStorage.mockImplementation(() => {
			element.beforeSave = hooks.beforeSave;
			return () => {
				throw new Error('Cleanup failed');
			};
		});
		await connect();
		await element.saveFormState();
		element.remove();
		expect(errors.mock.calls[0][0].detail.operation).toBe('cleanup');
		expect(element.beforeSave).toBeNull();
	});

	it.each(['', 'data:text/javascript,export{}', 'javascript:void(0)'])(
		'rejects unsupported script URLs: %s',
		async (url) => {
			element.setAttribute('script', url);
			document.body.append(element);
			await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
			await element.saveFormState();
			expect(element.loadModule).not.toHaveBeenCalled();
			expect(localStorage.getItem('hooks-test')).toBeNull();
		},
	);

	it('supports optional hooks configured directly without a script', async () => {
		element.script = null;
		element.beforeSave = hooks.beforeSave;
		element.beforeRestore = hooks.beforeRestore;
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		document.body.append(element);
		await vi.waitFor(() =>
			expect(element.querySelector('input').value).toBe('saved'),
		);
		await element.saveFormState();
		expect(
			JSON.parse(localStorage.getItem('hooks-test')).wrapped.message,
		).toEqual(state.message);
	});

	it('does not restore over edits made while decryption is pending', async () => {
		const restore = deferred();
		hooks.beforeRestore.mockReturnValue(restore.promise);
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		await connect();
		await vi.waitFor(() =>
			expect(hooks.beforeRestore).toHaveBeenCalledOnce(),
		);
		const input = element.querySelector('input');
		input.value = 'new edit';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		restore.resolve(state);
		await Promise.resolve();
		await element.saveFormState();
		expect(input.value).toBe('new edit');
	});

	it('never lets an older asynchronous save overwrite a newer one', async () => {
		await connect();
		const first = deferred();
		hooks.beforeSave.mockReturnValueOnce(first.promise);
		const pending = element.saveFormState();
		await vi.waitFor(() => expect(hooks.beforeSave).toHaveBeenCalledOnce());
		element.querySelector('input').value = 'latest';
		await element.saveFormState();
		first.resolve({ wrapped: state });
		await pending;
		expect(
			JSON.parse(localStorage.getItem('hooks-test')).wrapped.message[0]
				.value,
		).toBe('latest');
	});

	it('invalidates an in-flight save when its callback is replaced', async () => {
		await connect();
		const first = deferred();
		hooks.beforeSave.mockReturnValueOnce(first.promise);
		const pending = element.saveFormState();
		await vi.waitFor(() => expect(hooks.beforeSave).toHaveBeenCalledOnce());
		element.beforeSave = null;
		first.resolve({ wrapped: state });
		await pending;
		expect(localStorage.getItem('hooks-test')).toBeNull();
	});

	it('rejects invalid hook assignments without replacing an existing callback', () => {
		element.beforeSave = hooks.beforeSave;
		expect(() => {
			element.beforeSave = 'not a function';
		}).toThrow(TypeError);
		expect(element.beforeSave).toBe(hooks.beforeSave);
		element.beforeSave = undefined;
		expect(element.beforeSave).toBeNull();
	});

	it.each(['beforeSave', 'beforeRestore', 'storage-key'])(
		'cancels a queued autosave when %s changes',
		async (change) => {
			await connect();
			vi.useFakeTimers();
			localStorage.setItem('another-key', 'existing draft');
			element
				.querySelector('input')
				.dispatchEvent(new Event('input', { bubbles: true }));
			if (change === 'storage-key') element.storageKey = 'another-key';
			else element[change] = null;
			await vi.advanceTimersByTimeAsync(200);
			expect(localStorage.getItem('hooks-test')).toBeNull();
			expect(localStorage.getItem('another-key')).toBe('existing draft');
		},
	);

	it('lets an explicit restore supersede an older queued autosave', async () => {
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		await connect();
		vi.useFakeTimers();
		const restore = deferred();
		hooks.beforeRestore.mockReturnValue(restore.promise);
		element.querySelector('input').value = 'unsaved edit';
		element
			.querySelector('input')
			.dispatchEvent(new Event('input', { bubbles: true }));
		const pending = element.restoreFormState();
		await vi.advanceTimersByTimeAsync(200);
		restore.resolve(state);
		await pending;
		expect(element.querySelector('input').value).toBe('saved');
		expect(hooks.beforeSave).not.toHaveBeenCalled();
	});

	it('does not recreate a cleared draft from a queued reset save', async () => {
		await connect();
		element.querySelector('form').reset();
		element.clearSavedData();
		await Promise.resolve();
		await Promise.resolve();
		expect(localStorage.getItem('hooks-test')).toBeNull();
		expect(hooks.beforeSave).not.toHaveBeenCalled();
	});

	it('invalidates a pending restore synchronously on reset', async () => {
		localStorage.setItem('hooks-test', JSON.stringify({ wrapped: state }));
		await connect();
		const restore = deferred();
		hooks.beforeRestore.mockReturnValue(restore.promise);
		const pending = element.restoreFormState();
		await Promise.resolve();
		await Promise.resolve();
		restore.resolve(state);
		element.querySelector('form').reset();
		await pending;
		expect(element.querySelector('input').value).toBe('current');
	});

	it.each(['replace', 'remove'])(
		'preserves live fields and retention choice on script %s',
		async (action) => {
			element.retain = 'email';
			element.retainChoice = true;
			localStorage.setItem(
				'hooks-test',
				JSON.stringify({ wrapped: state }),
			);
			await connect();
			const input = element.querySelector('input');
			input.value = 'live edit';
			const checkbox = element.querySelector('[name=form-saver-retain]');
			checkbox.checked = true;
			const original = localStorage.getItem('hooks-test');
			if (action === 'replace') element.script = '/new-behavior.js';
			else element.script = null;
			await Promise.resolve();
			await Promise.resolve();
			expect(input.value).toBe('live edit');
			expect(element.querySelector('[name=form-saver-retain]')).toBe(
				checkbox,
			);
			expect(checkbox.checked).toBe(true);
			expect(localStorage.getItem('hooks-test')).toBe(original);
		},
	);

	it('preserves pending submission cleanup when script changes', async () => {
		await connect();
		await element.saveFormState();
		element
			.querySelector('form')
			.dispatchEvent(new Event('submit', { cancelable: true }));
		element.script = '/replacement.js';
		await element._handlePageHide();
		expect(localStorage.getItem('hooks-test')).toBeNull();
	});

	it('preserves an opaque draft when restore-only sanitization has no encoder', async () => {
		const original = '{"encrypted":"opaque"}';
		localStorage.setItem('hooks-test', original);
		element.configureStorage.mockImplementation(() => {
			element.beforeRestore = () => ({
				...state,
				password: [{ type: 'password', value: 'legacy' }],
			});
		});
		await connect();
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		expect(localStorage.getItem('hooks-test')).toBe(original);
		expect(element.querySelector('input').value).toBe('current');
		expect(errors.mock.calls[0][0].detail.operation).toBe('beforeRestore');
	});

	it('preserves an incompatible save-only envelope during restore', async () => {
		const original = JSON.stringify({ wrapped: state });
		localStorage.setItem('hooks-test', original);
		element.configureStorage.mockImplementation(() => {
			element.beforeSave = hooks.beforeSave;
		});
		await connect();
		await vi.waitFor(() => expect(errors).toHaveBeenCalledOnce());
		expect(localStorage.getItem('hooks-test')).toBe(original);
		expect(errors.mock.calls[0][0].detail.operation).toBe('beforeRestore');
	});

	it.each([
		new ArrayBuffer(8),
		{ ciphertext: undefined },
		{ value: NaN },
		{ value: new Date() },
		[undefined],
	])(
		'rejects unsupported payload %j before replacing a stored draft',
		async (payload) => {
			const original = JSON.stringify({ wrapped: state });
			localStorage.setItem('hooks-test', original);
			hooks.beforeSave.mockResolvedValue(payload);
			await connect();
			await element.saveFormState();
			expect(localStorage.getItem('hooks-test')).toBe(original);
			expect(errors).toHaveBeenCalled();
		},
	);

	it('accepts nested JSON payloads with repeated non-circular references', async () => {
		const shared = Object.assign(Object.create(null), { value: 'shared' });
		const payload = {
			first: shared,
			second: shared,
			entries: [null, true, 42, 'text'],
		};
		hooks.beforeSave.mockResolvedValue(payload);
		await connect();
		await element.saveFormState();
		expect(JSON.parse(localStorage.getItem('hooks-test'))).toEqual(payload);
		expect(errors).not.toHaveBeenCalled();
	});

	it('reports circular payloads without replacing an existing draft', async () => {
		const original = JSON.stringify({ wrapped: state });
		localStorage.setItem('hooks-test', original);
		const payload = {};
		payload.self = payload;
		hooks.beforeSave.mockResolvedValue(payload);
		await connect();
		await element.saveFormState();
		expect(localStorage.getItem('hooks-test')).toBe(original);
		expect(errors.mock.calls[0][0].detail.operation).toBe('write');
	});

	it.each(['clear', 'disconnect', 'storage-key', 'script', 'submit'])(
		'invalidates an in-flight save on %s',
		async (action) => {
			await connect();
			const save = deferred();
			hooks.beforeSave.mockReturnValue(save.promise);
			const pending = element.saveFormState();
			await vi.waitFor(() =>
				expect(hooks.beforeSave).toHaveBeenCalledOnce(),
			);
			if (action === 'clear') element.clearSavedData();
			if (action === 'disconnect') element.remove();
			if (action === 'storage-key') element.storageKey = 'another-key';
			if (action === 'script') element.script = '';
			if (action === 'submit') {
				element
					.querySelector('form')
					.dispatchEvent(new Event('submit', { cancelable: true }));
				window.dispatchEvent(new Event('pagehide'));
			}
			save.resolve({ wrapped: state });
			await pending;
			expect(localStorage.getItem('hooks-test')).toBeNull();
			expect(localStorage.getItem('another-key')).toBeNull();
		},
	);

	it('transforms only opted-in retained fields after submit', async () => {
		element.retain = 'email';
		element.retainChoice = true;
		await connect();
		await element.saveFormState();
		element.querySelector('[name=form-saver-retain]').checked = true;
		element
			.querySelector('form')
			.dispatchEvent(new Event('submit', { cancelable: true }));
		window.dispatchEvent(new Event('pagehide'));
		await vi.waitFor(() =>
			expect(JSON.parse(localStorage.getItem('hooks-test'))).toEqual({
				wrapped: {
					email: [{ type: 'text', value: 'demo@example.com' }],
				},
			}),
		);
	});

	it('removes the full draft even if encrypting retained fields fails', async () => {
		element.retain = 'email';
		await connect();
		await element.saveFormState();
		hooks.beforeSave.mockRejectedValue(new Error('Encryption unavailable'));
		element
			.querySelector('form')
			.dispatchEvent(new Event('submit', { cancelable: true }));
		await element._handlePageHide();
		expect(localStorage.getItem('hooks-test')).toBeNull();
		expect(errors.mock.calls[0][0].detail.operation).toBe('beforeSave');
	});

	it.each(['script', 'plain'])(
		'explicit clear cancels post-submit retention with %s storage',
		async (mode) => {
			element.retain = 'email';
			if (mode === 'script') await connect();
			else {
				element.script = null;
				document.body.append(element);
				await Promise.resolve();
			}
			await element.saveFormState();
			element
				.querySelector('form')
				.dispatchEvent(new Event('submit', { cancelable: true }));
			element.clearSavedData();
			await element._handlePageHide();
			expect(localStorage.getItem('hooks-test')).toBeNull();
		},
	);

	it.each(['abort', 'cleanup'])(
		'blocks saves made by old module %s during replacement',
		async (phase) => {
			let teardownSave;
			element.configureStorage.mockImplementation((saver, { signal }) => {
				saver.beforeSave = hooks.beforeSave;
				saver.beforeRestore = hooks.beforeRestore;
				const save = () => {
					teardownSave = saver.saveFormState();
				};
				if (phase === 'abort')
					signal.addEventListener('abort', save, { once: true });
				return phase === 'cleanup' ? save : undefined;
			});
			await connect();
			await element.saveFormState();
			const original = localStorage.getItem('hooks-test');
			element.configureStorage.mockImplementation(() => {});
			element.script = '/new.js';
			await teardownSave;
			expect(localStorage.getItem('hooks-test')).toBe(original);
		},
	);

	it('allows a native field named toJSON without hooks', async () => {
		element.script = null;
		element.querySelector('input').name = 'toJSON';
		document.body.append(element);
		await Promise.resolve();
		element.saveFormState();
		expect(JSON.parse(localStorage.getItem('hooks-test')).toJSON).toEqual([
			{ type: 'text', value: 'current' },
		]);
		expect(errors).not.toHaveBeenCalled();
	});

	it('rejects a callable serializer without invoking it or replacing the draft', async () => {
		await connect();
		await element.saveFormState();
		const original = localStorage.getItem('hooks-test');
		const serializer = vi.fn(() => 'unexpected');
		hooks.beforeSave.mockResolvedValue({ toJSON: serializer });
		await element.saveFormState();
		expect(serializer).not.toHaveBeenCalled();
		expect(localStorage.getItem('hooks-test')).toBe(original);
		expect(errors).toHaveBeenCalledOnce();
	});

	it.each([
		{ wrapped: state },
		{
			iv: [1, 2],
			ciphertext: [3, 4],
			metadata: [{ type: 'password', value: 'metadata' }],
		},
		{
			ciphertext: ['encoded', null],
			metadata: [{ type: 'password', value: 'metadata' }],
		},
	])(
		'preserves direct-hook payload %j through reconnect until the decoder is reinstalled',
		async (payload) => {
			hooks.beforeSave.mockResolvedValue(payload);
			hooks.beforeRestore.mockResolvedValue(state);
			element.script = null;
			element.beforeSave = hooks.beforeSave;
			element.beforeRestore = hooks.beforeRestore;
			document.body.append(element);
			await Promise.resolve();
			await element.saveFormState();
			const original = localStorage.getItem('hooks-test');
			element.remove();
			document.body.append(element);
			await Promise.resolve();
			expect(localStorage.getItem('hooks-test')).toBe(original);
			expect(errors.mock.calls[0][0].detail.operation).toBe('read');
			element.beforeRestore = hooks.beforeRestore;
			await element.restoreFormState();
			expect(element.querySelector('input').value).toBe('saved');
			expect(localStorage.getItem('hooks-test')).toBe(original);
		},
	);

	it.each(['script', 'hooks'])(
		'retains live selected fields when %s are removed after submit',
		async (source) => {
			element.retain = 'email';
			element.retainChoice = true;
			if (source === 'hooks') {
				element.script = null;
				element.beforeSave = hooks.beforeSave;
				element.beforeRestore = hooks.beforeRestore;
				document.body.append(element);
				await Promise.resolve();
			} else await connect();
			await element.saveFormState();
			element.querySelector('[name=form-saver-retain]').checked = true;
			element
				.querySelector('form')
				.dispatchEvent(new Event('submit', { cancelable: true }));
			if (source === 'script') element.script = null;
			else {
				element.beforeSave = null;
				element.beforeRestore = null;
			}
			await element._handlePageHide();
			expect(JSON.parse(localStorage.getItem('hooks-test'))).toEqual({
				email: [{ type: 'text', value: 'demo@example.com' }],
			});
		},
	);
});
