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
export interface FormSaverErrorDetail {
	operation: 'read' | 'write' | 'remove';
	error: unknown;
}

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
	 * Immediately saves current form state into localStorage.
	 */
	saveFormState(): void;

	/**
	 * Restores form state from localStorage.
	 */
	restoreFormState(): void;

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
