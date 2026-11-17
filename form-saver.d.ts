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
 * @attr {string} script - Module URL whose default initializer returns storage transformation hooks.
 * @fires form-saver-error - Fired when storage, module initialization, or a transformation fails.
 */
export interface FormSaverErrorDetail {
	operation:
		| 'read'
		| 'write'
		| 'remove'
		| 'initialize'
		| 'beforeSave'
		| 'beforeRestore';
	error: unknown;
}

export type FormSaverControlState = {
	type: string;
	value?: string;
	checked?: boolean;
	values?: string[];
};

export type FormSaverState = Record<string, FormSaverControlState[]>;
export type FormSaverPayload =
	| null
	| boolean
	| number
	| string
	| FormSaverPayload[]
	| { [key: string]: FormSaverPayload };

export interface FormSaverStorageHooks {
	beforeSave(
		state: FormSaverState,
	): FormSaverPayload | Promise<FormSaverPayload>;
	beforeRestore(
		payload: FormSaverPayload,
	): FormSaverState | Promise<FormSaverState>;
}

export type FormSaverStorageInitializer = (
	element: FormSaverElement,
) => FormSaverStorageHooks | Promise<FormSaverStorageHooks>;

export class FormSaverElement extends HTMLElement {
	/**
	 * List of attributes to observe for changes.
	 */
	static readonly observedAttributes: string[];

	constructor();

	connectedCallback(): void;
	disconnectedCallback(): void;

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;

	/**
	 * Space-separated list of fields to retain after successful form submission.
	 */
	get retain(): string | null;
	set retain(value: string | null | undefined);

	/**
	 * Inject a retention checkbox into the form.
	 */
	get retainChoice(): boolean;
	set retainChoice(value: boolean);

	/**
	 * Label text for the optional retention checkbox.
	 */
	get retainChoiceLabel(): string | null;
	set retainChoiceLabel(value: string | null | undefined);

	/**
	 * Optional selector for a container element into which the retention checkbox is placed.
	 */
	get retainChoiceContainer(): string | null;
	set retainChoiceContainer(value: string | null | undefined);

	/**
	 * Optional explicit storage key override.
	 */
	get storageKey(): string | null;
	set storageKey(value: string | null | undefined);

	/**
	 * Module URL resolved against the element's document base URI.
	 */
	get script(): string | null;
	set script(value: string | null | undefined);

	/**
	 * Saves current form state, asynchronously when a script is configured.
	 */
	saveFormState(): void | Promise<void>;

	/**
	 * Restores form state from localStorage.
	 */
	restoreFormState(): void | Promise<void>;

	/**
	 * Clears persisted data for this form.
	 */
	clearSavedData(): void;

	addEventListener(
		type: 'form-saver-error',
		listener: (
			this: FormSaverElement,
			event: CustomEvent<FormSaverErrorDetail>,
		) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;

	removeEventListener(
		type: 'form-saver-error',
		listener: (
			this: FormSaverElement,
			event: CustomEvent<FormSaverErrorDetail>,
		) => void,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;

	/**
	 * Upgrade a property to handle cases where it was set before the element upgraded.
	 * @param prop - Property name to upgrade
	 * @private
	 */
	private _upgradeProperty(prop: string): void;
}
