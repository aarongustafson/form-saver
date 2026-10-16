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
 * @fires form-saver-error - Fired when localStorage cannot be read, written, or cleared.
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
		window.localStorage.setItem(storage_key, JSON.stringify(payload));
	}

	static _readFromStorage(storage_key) {
		const value = window.localStorage.getItem(storage_key);
		if (!value) {
			return null;
		}

		try {
			return JSON.parse(value);
		} catch (error) {
			// Corrupted stored value; treat as empty.
			if (error instanceof SyntaxError) {
				return null;
			}

			throw error;
		}
	}

	static _removeFromStorage(storage_key) {
		window.localStorage.removeItem(storage_key);
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
	 * Clears persisted data for this form.
	 */
	clearSavedData() {
		if (!this._internals.storageKey) {
			return;
		}

		this._removeSavedState();
	}

	/**
	 * Immediately saves current form state into localStorage.
	 */
	saveFormState() {
		this._cancelPendingSave();

		if (!this._internals.form || !this._internals.storageKey) {
			return;
		}

		const payload = FormSaverElement._serializeForm(this._internals.form);
		this._writeSavedState(payload);
	}

	/**
	 * Restores form state from localStorage.
	 */
	restoreFormState() {
		if (!this._internals.form || !this._internals.storageKey) {
			return;
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
		if (this._internals.initialized) {
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
		this.restoreFormState();
		this._internals.initialized = true;
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
