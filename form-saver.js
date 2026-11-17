/**
 * FormSaverElement - A web component that stores (and restores) values within the first form it contains.
 *
 * @element form-saver
 *
 * @attr {string} retain - Space-separated list of field names to preserve after successful submit.
 * @attr {boolean} retain-choice - If present, injects a retention checkbox so users can opt in.
 * @attr {string} retain-choice-label - Label text for the injected retention checkbox.
 * @attr {string} retain-choice-container - Optional selector for a container element into which the retention checkbox is placed.
 * @attr {string} storage-key - Optional explicit storage key override.
 * @attr {string} script - Behavior module URL with an optional initialize(element, { signal }) export.
 * @fires form-saver-error - Fired when storage, module initialization, cleanup, or a transformation fails.
 */
export class FormSaverElement extends HTMLElement {
	// ---- Static members ----

	static _autosaveDelay = 150;

	static get observedAttributes() {
		return [
			'retain',
			'retain-choice',
			'retain-choice-label',
			'retain-choice-container',
			'storage-key',
			'script',
		];
	}

	static _serializeForm($form) {
		const state = Object.create(null);

		for (const element of $form.elements) {
			if (
				!(element instanceof HTMLElement) ||
				!FormSaverElement._isSupportedControl(element)
			) {
				continue;
			}

			const key = FormSaverElement._getFieldKey(element);
			if (!key) {
				continue;
			}

			if (!Object.hasOwn(state, key)) {
				state[key] = [];
			}

			state[key].push(FormSaverElement._serializeControlValue(element));
		}

		return state;
	}

	static _applySerializedState($form, state) {
		const key_indexes = new Map();

		for (const element of $form.elements) {
			if (
				!(element instanceof HTMLElement) ||
				!FormSaverElement._isSupportedControl(element)
			) {
				continue;
			}

			const key = FormSaverElement._getFieldKey(element);
			if (
				!key ||
				!Object.hasOwn(state, key) ||
				!Array.isArray(state[key])
			) {
				continue;
			}

			const index = key_indexes.get(key) || 0;
			const value = state[key][index];
			if (value === undefined) {
				continue;
			}

			FormSaverElement._applyControlValue(element, value);
			key_indexes.set(key, index + 1);
		}
	}

	static _isSupportedControl(element) {
		if (element instanceof HTMLTextAreaElement) {
			return true;
		}

		if (element instanceof HTMLSelectElement) {
			return true;
		}

		if (element instanceof HTMLInputElement) {
			if (element.type === 'file' || element.type === 'password') {
				return false;
			}

			return !['submit', 'button', 'reset', 'image'].includes(
				element.type,
			);
		}

		return false;
	}

	static _getFieldKey(element) {
		return (
			element.getAttribute('name') || element.getAttribute('id') || null
		);
	}

	static _serializeControlValue(element) {
		if (element instanceof HTMLInputElement) {
			if (element.type === 'checkbox' || element.type === 'radio') {
				return {
					type: element.type,
					checked: element.checked,
					value: element.value,
				};
			}

			return {
				type: element.type,
				value: element.value,
			};
		}

		if (element instanceof HTMLSelectElement && element.multiple) {
			return {
				type: 'select-multiple',
				values: Array.from(element.selectedOptions).map(
					(option) => option.value,
				),
			};
		}

		return {
			type: 'value',
			value: element.value,
		};
	}

	static _applyControlValue(element, saved_value) {
		if (
			!saved_value ||
			typeof saved_value !== 'object' ||
			Array.isArray(saved_value)
		) {
			return;
		}

		if (element instanceof HTMLInputElement) {
			if (element.type === 'checkbox' || element.type === 'radio') {
				element.checked = Boolean(saved_value.checked);
				return;
			}

			element.value = saved_value.value ?? '';
			return;
		}

		if (element instanceof HTMLSelectElement && element.multiple) {
			const selected_values = Array.isArray(saved_value.values)
				? new Set(saved_value.values)
				: new Set();

			for (const option of element.options) {
				option.selected = selected_values.has(option.value);
			}
			return;
		}

		element.value = saved_value.value ?? '';
	}

	static _saveToStorage(storage_key, payload) {
		const serialized = JSON.stringify(payload);
		if (serialized === undefined) {
			throw new TypeError('The saved payload must be JSON-serializable.');
		}
		window.localStorage.setItem(storage_key, serialized);
	}

	static _readFromStorage(storage_key, empty_value = null, strict = false) {
		const value = window.localStorage.getItem(storage_key);
		if (value === null || (!strict && value === '')) {
			return empty_value;
		}

		try {
			return JSON.parse(value);
		} catch (error) {
			// Corrupted stored value; treat as empty.
			if (error instanceof SyntaxError && !strict) {
				return empty_value;
			}

			throw error;
		}
	}

	static _removeFromStorage(storage_key) {
		window.localStorage.removeItem(storage_key);
	}

	static _validateRestoredState(state) {
		const valid =
			state !== null &&
			typeof state === 'object' &&
			!Array.isArray(state) &&
			Object.values(state).every(
				(values) =>
					Array.isArray(values) &&
					Array.from(values).every((value) => {
						if (
							!value ||
							typeof value !== 'object' ||
							Array.isArray(value) ||
							typeof value.type !== 'string'
						) {
							return false;
						}
						if (value.type === 'select-multiple') {
							return (
								Array.isArray(value.values) &&
								Array.from(value.values).every(
									(item) => typeof item === 'string',
								)
							);
						}
						return (
							typeof value.value === 'string' &&
							(!['checkbox', 'radio'].includes(value.type) ||
								typeof value.checked === 'boolean')
						);
					}),
			);
		if (!valid) {
			throw new TypeError(
				'beforeRestore must return a valid form state object.',
			);
		}
	}

	static _sanitizeStoredState(value) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return { state: null, changed: value !== null };
		}

		const state = Object.create(null);
		let changed = false;

		for (const [key, saved_values] of Object.entries(value)) {
			if (!Array.isArray(saved_values)) {
				changed = true;
				continue;
			}

			const safe_values = saved_values.filter((saved_value) => {
				const is_valid =
					saved_value &&
					typeof saved_value === 'object' &&
					!Array.isArray(saved_value);
				const is_password = is_valid && saved_value.type === 'password';

				if (!is_valid || is_password) {
					changed = true;
					return false;
				}

				return true;
			});

			if (safe_values.length > 0) {
				state[key] = safe_values;
			} else if (saved_values.length > 0) {
				changed = true;
			}
		}

		return {
			state: Object.keys(state).length > 0 ? state : null,
			changed,
		};
	}

	static _uuid() {
		if (
			typeof crypto !== 'undefined' &&
			typeof crypto.randomUUID === 'function'
		) {
			return crypto.randomUUID();
		}

		return String(Date.now()) + String(Math.floor(Math.random() * 1e6));
	}

	// ---- Instance members ----

	constructor() {
		super();
		this._internals = {
			initialized: false,
			behaviorReady: null,
			behaviorPending: false,
			behaviorController: null,
			behaviorCleanup: null,
			beforeSave: null,
			beforeRestore: null,
			revision: 0,
			connection: 0,
			pendingSubmit: false,
			form: null,
			storageKey: null,
			retainCheckbox: null,
			autosaveTimer: null,
			domReadyHandler: null,
			boundSaveHandler: () => this._scheduleSave(),
			boundSubmitHandler: (event) => this._handleSubmit(event),
			boundPageHideHandler: () => this._handlePageHide(),
			boundResetHandler: () => {
				queueMicrotask(() => this.saveFormState());
			},
		};
	}

	connectedCallback() {
		this._upgradeProperty('retain');
		this._upgradeProperty('retainChoice');
		this._upgradeProperty('retainChoiceLabel');
		this._upgradeProperty('retainChoiceContainer');
		this._upgradeProperty('storageKey');
		this._upgradeProperty('script');
		this._upgradeProperty('beforeSave');
		this._upgradeProperty('beforeRestore');

		queueMicrotask(() => {
			this._initialize();
		});

		if (!this._internals.initialized && document.readyState === 'loading') {
			if (!this._internals.domReadyHandler) {
				this._internals.domReadyHandler = () => {
					this._internals.domReadyHandler = null;
					this._initialize();
				};
			}
			document.addEventListener(
				'DOMContentLoaded',
				this._internals.domReadyHandler,
				{ once: true },
			);
		}
	}

	disconnectedCallback() {
		this._internals.revision++;
		this._internals.connection++;
		if (this._internals.domReadyHandler) {
			document.removeEventListener(
				'DOMContentLoaded',
				this._internals.domReadyHandler,
			);
			this._internals.domReadyHandler = null;
		}

		this._removeFormListeners();
		this._cancelPendingSave();
		window.removeEventListener(
			'pagehide',
			this._internals.boundPageHideHandler,
		);
		this._internals.initialized = false;
		this._internals.form = null;
		this._internals.storageKey = null;
		this._internals.retainCheckbox = null;
		this._internals.pendingSubmit = false;
		this._internals.behaviorReady = null;
		this._cancelBehavior();
	}

	attributeChangedCallback(name, old_value, new_value) {
		if (old_value === new_value || !this._internals.initialized) {
			return;
		}

		switch (name) {
			case 'retain':
				break;
			case 'retain-choice':
			case 'retain-choice-label':
			case 'retain-choice-container':
				this._renderRetentionControl();
				break;
			case 'storage-key':
				this._computeStorageKey();
				break;
			case 'script':
				this.disconnectedCallback();
				if (this.isConnected) this._initialize();
				break;
		}
	}

	/**
	 * Space-separated list of fields to retain after successful form submission.
	 */
	get retain() {
		return this.getAttribute('retain');
	}

	set retain(value) {
		if (value === null || value === undefined || value === '') {
			this.removeAttribute('retain');
			return;
		}

		this.setAttribute('retain', String(value));
	}

	/**
	 * Inject a retention checkbox into the form.
	 */
	get retainChoice() {
		return this.hasAttribute('retain-choice');
	}

	set retainChoice(value) {
		if (value) {
			this.setAttribute('retain-choice', '');
		} else {
			this.removeAttribute('retain-choice');
		}
	}

	/**
	 * Label text for the optional retention checkbox.
	 */
	get retainChoiceLabel() {
		return this.getAttribute('retain-choice-label');
	}

	set retainChoiceLabel(value) {
		if (value === null || value === undefined || value === '') {
			this.removeAttribute('retain-choice-label');
			return;
		}

		this.setAttribute('retain-choice-label', String(value));
	}

	/**
	 * Optional selector for a container element into which the retention checkbox is placed.
	 */
	get retainChoiceContainer() {
		return this.getAttribute('retain-choice-container');
	}

	set retainChoiceContainer(value) {
		if (value === null || value === undefined || value === '') {
			this.removeAttribute('retain-choice-container');
			return;
		}

		this.setAttribute('retain-choice-container', String(value));
	}

	/**
	 * Optional explicit storage key override.
	 */
	get storageKey() {
		return this.getAttribute('storage-key');
	}

	set storageKey(value) {
		if (value === null || value === undefined || value === '') {
			this.removeAttribute('storage-key');
			return;
		}

		this.setAttribute('storage-key', String(value));
	}

	/**
	 * Module URL with an optional initialize(element, { signal }) export.
	 */
	get script() {
		return this.getAttribute('script');
	}

	set script(value) {
		if (value === null || value === undefined || value === '') {
			this.removeAttribute('script');
			return;
		}

		this.setAttribute('script', String(value));
	}

	get beforeSave() {
		return this._internals.beforeSave;
	}

	set beforeSave(value) {
		this._setStorageHook('beforeSave', value);
	}

	get beforeRestore() {
		return this._internals.beforeRestore;
	}

	set beforeRestore(value) {
		this._setStorageHook('beforeRestore', value);
	}

	_setStorageHook(name, value) {
		if (
			value !== null &&
			value !== undefined &&
			typeof value !== 'function'
		) {
			throw new TypeError(`${name} must be a function or null.`);
		}
		if (this._internals[name] === (value ?? null)) return;
		this._internals[name] = value ?? null;
		if (!this._internals.behaviorPending) this._internals.revision++;
	}

	get _usesAsyncStorage() {
		return Boolean(
			this._internals.behaviorReady ||
			this.beforeSave ||
			this.beforeRestore,
		);
	}

	loadModule(url) {
		return import(new URL(url, this.baseURI).href);
	}

	/**
	 * Clears persisted data for this form.
	 */
	clearSavedData() {
		this._cancelPendingSave();
		this._internals.revision++;
		if (!this._internals.storageKey) {
			return;
		}

		this._removeSavedState();
	}

	/**
	 * Saves current form state, asynchronously when a script or hook is configured.
	 */
	saveFormState() {
		this._cancelPendingSave();

		if (!this._internals.form || !this._internals.storageKey) {
			return;
		}

		const payload = FormSaverElement._serializeForm(this._internals.form);
		const revision = ++this._internals.revision;
		if (this._usesAsyncStorage) {
			return this._saveTransformedState(payload, revision);
		}
		this._writeSavedState(payload);
	}

	/**
	 * Restores form state from localStorage.
	 */
	restoreFormState() {
		if (!this._internals.form || !this._internals.storageKey) {
			return;
		}

		const revision = ++this._internals.revision;
		if (this._usesAsyncStorage) {
			return this._restoreTransformedState(revision);
		}

		const saved_state = this._readSavedState();
		if (!saved_state) {
			return;
		}

		FormSaverElement._applySerializedState(
			this._internals.form,
			saved_state,
		);
	}

	_initialize() {
		if (this._internals.initialized || !this.isConnected) {
			return;
		}

		const $form = this.querySelector('form');
		if (!$form) {
			return;
		}

		this._internals.form = $form;
		this._computeStorageKey();
		this._addFormListeners();
		this._renderRetentionControl();
		this._internals.initialized = true;
		if (this.hasAttribute('script')) {
			const script = this.script;
			const connection = this._internals.connection;
			const controller = new AbortController();
			this._internals.behaviorController = controller;
			this._internals.behaviorPending = true;
			this._internals.behaviorReady = Promise.resolve().then(() =>
				this._loadBehaviorScript(script, connection, controller),
			);
		}
		this.restoreFormState();
	}

	async _loadBehaviorScript(script, connection, controller) {
		if (connection !== this._internals.connection) return false;
		try {
			const url = new URL(script, this.baseURI);
			if (
				!script?.trim() ||
				!['http:', 'https:'].includes(url.protocol)
			) {
				throw new TypeError('Use an http or https module URL.');
			}
			const module = await this.loadModule(url.href);
			if (connection !== this._internals.connection) return false;
			if ('initialize' in module) {
				if (typeof module.initialize !== 'function') {
					throw new TypeError(
						'The module initialize export must be a function.',
					);
				}
				const cleanup = await module.initialize(this, {
					signal: controller.signal,
				});
				if (cleanup !== undefined && typeof cleanup !== 'function') {
					throw new TypeError(
						'An initializer may return a cleanup function or undefined.',
					);
				}
				if (
					connection !== this._internals.connection ||
					controller.signal.aborted
				) {
					if (cleanup) this._disposeBehavior(cleanup);
					return false;
				}
				this._internals.behaviorCleanup = cleanup ?? null;
			}
			return true;
		} catch (error) {
			if (connection === this._internals.connection) {
				this._cancelBehavior();
				this._reportStorageError('initialize', error);
			}
			return false;
		} finally {
			if (connection === this._internals.connection) {
				this._internals.behaviorPending = false;
			}
		}
	}

	_cancelBehavior() {
		const controller = this._internals.behaviorController;
		const cleanup = this._internals.behaviorCleanup;
		this._internals.behaviorController = null;
		this._internals.behaviorPending = false;
		this._internals.behaviorCleanup = null;
		this._internals.beforeSave = null;
		this._internals.beforeRestore = null;
		controller?.abort();
		if (cleanup) this._disposeBehavior(cleanup);
	}

	_disposeBehavior(cleanup) {
		try {
			cleanup();
		} catch (error) {
			this._reportStorageError('cleanup', error);
		}
	}

	_isCurrentOperation(revision) {
		return (
			this._internals.initialized && revision === this._internals.revision
		);
	}

	async _saveTransformedState(state, revision) {
		const ready = this._internals.behaviorReady;
		if (ready && !(await ready)) return;
		if (!this._isCurrentOperation(revision)) return;

		try {
			const payload = this.beforeSave
				? await this.beforeSave(state)
				: state;
			if (!this._isCurrentOperation(revision)) return;
			if (payload === undefined) {
				throw new TypeError(
					'beforeSave must return a JSON-serializable payload.',
				);
			}
			this._writeSavedState(payload);
		} catch (error) {
			if (this._isCurrentOperation(revision)) {
				this._reportStorageError('beforeSave', error);
			}
		}
	}

	async _restoreTransformedState(revision) {
		const ready = this._internals.behaviorReady;
		if (ready && !(await ready)) return;
		if (!this._isCurrentOperation(revision)) return;

		let payload;
		const missing = Symbol();
		try {
			payload = FormSaverElement._readFromStorage(
				this._internals.storageKey,
				missing,
				true,
			);
		} catch (error) {
			this._reportStorageError('read', error);
			return;
		}
		if (payload === missing) return;

		try {
			const beforeRestore = this.beforeRestore;
			const restored = beforeRestore
				? await beforeRestore.call(this, payload)
				: payload;
			if (!this._isCurrentOperation(revision)) return;
			if (beforeRestore)
				FormSaverElement._validateRestoredState(restored);
			const { state, changed } =
				FormSaverElement._sanitizeStoredState(restored);
			if (changed) {
				if (state) await this._saveTransformedState(state, revision);
				else this._removeSavedState();
			}
			if (state && this._isCurrentOperation(revision)) {
				FormSaverElement._applySerializedState(
					this._internals.form,
					state,
				);
			}
		} catch (error) {
			if (this._isCurrentOperation(revision)) {
				this._reportStorageError('beforeRestore', error);
			}
		}
	}

	_addFormListeners() {
		const $form = this._internals.form;
		if (!$form) {
			return;
		}

		$form.addEventListener('input', this._internals.boundSaveHandler);
		$form.addEventListener('change', this._internals.boundSaveHandler);
		$form.addEventListener('reset', this._internals.boundResetHandler);
		$form.addEventListener('submit', this._internals.boundSubmitHandler);
		window.addEventListener(
			'pagehide',
			this._internals.boundPageHideHandler,
		);
	}

	_removeFormListeners() {
		const $form = this._internals.form;
		if (!$form) {
			return;
		}

		$form.removeEventListener('input', this._internals.boundSaveHandler);
		$form.removeEventListener('change', this._internals.boundSaveHandler);
		$form.removeEventListener('reset', this._internals.boundResetHandler);
		$form.removeEventListener('submit', this._internals.boundSubmitHandler);
	}

	_handleSubmit(event) {
		if (event.defaultPrevented) {
			this._internals.pendingSubmit = false;
			return;
		}

		this.saveFormState();
		this._internals.pendingSubmit = true;
	}

	_handlePageHide() {
		if (this._usesAsyncStorage && this._internals.pendingSubmit) {
			this._internals.pendingSubmit = false;
			// Remove the full draft before starting asynchronous retention work.
			this.clearSavedData();
			const fields = this._retainedFieldNames;
			if (fields.size > 0 && this._shouldRetainAfterSubmit()) {
				const state = FormSaverElement._serializeForm(
					this._internals.form,
				);
				const retained = Object.fromEntries(
					Object.entries(state).filter(([name]) => fields.has(name)),
				);
				if (Object.keys(retained).length > 0) {
					return this._saveTransformedState(
						retained,
						this._internals.revision,
					);
				}
			}
			return;
		}

		this._flushPendingSave();

		if (!this._internals.pendingSubmit || !this._internals.storageKey) {
			return;
		}

		const retained_fields = this._retainedFieldNames;
		if (retained_fields.size > 0 && this._shouldRetainAfterSubmit()) {
			const saved_state = this._readSavedState();
			if (saved_state) {
				const filtered_state = Object.fromEntries(
					Object.entries(saved_state).filter(([field_name]) =>
						retained_fields.has(field_name),
					),
				);

				if (Object.keys(filtered_state).length > 0) {
					this._writeSavedState(filtered_state);
				} else {
					this._removeSavedState();
				}
			} else {
				this._removeSavedState();
			}
		} else {
			this._removeSavedState();
		}

		this._internals.pendingSubmit = false;
	}

	_scheduleSave() {
		this._internals.revision++;
		this._cancelPendingSave();
		this._internals.autosaveTimer = window.setTimeout(() => {
			this._internals.autosaveTimer = null;
			this.saveFormState();
		}, FormSaverElement._autosaveDelay);
	}

	_flushPendingSave() {
		if (this._internals.autosaveTimer === null) {
			return;
		}

		this._cancelPendingSave();
		this.saveFormState();
	}

	_cancelPendingSave() {
		if (this._internals.autosaveTimer === null) {
			return;
		}

		window.clearTimeout(this._internals.autosaveTimer);
		this._internals.autosaveTimer = null;
	}

	_readSavedState() {
		try {
			const stored_state = FormSaverElement._readFromStorage(
				this._internals.storageKey,
			);
			const { state, changed } =
				FormSaverElement._sanitizeStoredState(stored_state);

			if (changed) {
				if (state) {
					this._writeSavedState(state);
				} else {
					this._removeSavedState();
				}
			}

			return state;
		} catch (error) {
			this._reportStorageError('read', error);
			return null;
		}
	}

	_writeSavedState(state) {
		try {
			FormSaverElement._saveToStorage(this._internals.storageKey, state);
			return true;
		} catch (error) {
			this._reportStorageError('write', error);
			return false;
		}
	}

	_removeSavedState() {
		try {
			FormSaverElement._removeFromStorage(this._internals.storageKey);
			return true;
		} catch (error) {
			this._reportStorageError('remove', error);
			return false;
		}
	}

	_reportStorageError(operation, error) {
		this.dispatchEvent(
			new CustomEvent('form-saver-error', {
				bubbles: true,
				composed: true,
				detail: { operation, error },
			}),
		);
	}

	get _retainedFieldNames() {
		const raw_value = this.retain || '';
		return new Set(raw_value.split(/\s+/u).filter(Boolean));
	}

	_shouldRetainAfterSubmit() {
		if (!this.retainChoice) {
			return true;
		}

		return Boolean(this._internals.retainCheckbox?.checked);
	}

	_renderRetentionControl() {
		const $form = this._internals.form;
		if (!$form) {
			return;
		}

		const retained_fields = this._retainedFieldNames;
		const $existing_control = $form.querySelector(
			'[data-form-saver-retain-control]',
		);

		if (!this.retainChoice || retained_fields.size === 0) {
			if ($existing_control) {
				$existing_control.remove();
			}
			this._internals.retainCheckbox = null;
			return;
		}

		if ($existing_control) {
			$existing_control.remove();
		}

		const control_id = `${this.localName}-retain-${FormSaverElement._uuid()}`;
		const $wrapper = document.createElement('p');
		$wrapper.setAttribute('data-form-saver-retain-control', '');

		const $checkbox = document.createElement('input');
		$checkbox.type = 'checkbox';
		$checkbox.id = control_id;
		$checkbox.name = 'form-saver-retain';
		$checkbox.checked = false;

		const $label = document.createElement('label');
		$label.setAttribute('for', control_id);
		$label.append(
			$checkbox,
			document.createTextNode(
				` ${this.retainChoiceLabel || 'Store my contact information for later'}`,
			),
		);

		$wrapper.append($label);
		this._insertRetentionControl($form, $wrapper);
		this._internals.retainCheckbox = $checkbox;
	}

	_insertRetentionControl($form, $control) {
		const container_selector = this.retainChoiceContainer;
		if (container_selector) {
			const $container = $form.querySelector(container_selector);
			if ($container) {
				$container.append($control);
				return;
			}
		}

		const $submit_control = $form.querySelector(
			'button[type="submit"], input[type="submit"]',
		);

		if ($submit_control && $submit_control.parentNode) {
			$submit_control.parentNode.insertBefore($control, $submit_control);
			return;
		}

		$form.append($control);
	}

	/**
	 * Computes the storage key and assigns it to this._internals.storageKey.
	 * Uses the explicit storage-key attribute when present, otherwise derives
	 * the key from the form's method and action.
	 */
	_computeStorageKey() {
		this._internals.revision++;
		if (this.storageKey) {
			this._internals.storageKey = this.storageKey;
			return;
		}

		const $form = this._internals.form;
		if (!$form) {
			this._internals.storageKey = null;
			return;
		}

		const method = ($form.method || 'get').toLowerCase();
		const action = $form.getAttribute('action') || window.location.href;
		const resolved_action = new URL(action, window.location.href).href;

		this._internals.storageKey = `form-saver:${method}:${resolved_action}`;
	}

	/**
	 * Upgrade a property to handle cases where it was set before the element upgraded.
	 * @param {string} prop - Property name to upgrade
	 * @private
	 */
	_upgradeProperty(prop) {
		if (Object.prototype.hasOwnProperty.call(this, prop)) {
			const value = this[prop];
			delete this[prop];
			this[prop] = value;
		}
	}
}
