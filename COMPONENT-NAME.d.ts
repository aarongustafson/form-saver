/**
 * ComponentNameElement - COMPONENT_DESCRIPTION
 *
 * @element COMPONENT-NAME
 *
 * @attr {string} example-attribute - Description of the attribute
 *
 * @fires COMPONENT-NAME:event-name - Description of the event
 *
 * @slot - Default slot for content
 *
 * @cssprop --component-name-color - Description of CSS custom property
 */
export class ComponentNameElement extends HTMLElement {
	/**
	 * List of attributes to observe for changes
	 */
	static readonly observedAttributes: string[];

	/**
	 * Internal state and flags
	 */
	private readonly _internals: {
		isRendered: boolean;
	};

	constructor();

	/**
	 * Called when the element is connected to the DOM
	 */
	connectedCallback(): void;

	/**
	 * Called when an observed attribute changes
	 * @param name - The attribute name that changed
	 * @param oldValue - The previous value
	 * @param newValue - The new value
	 */
	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;

	/**
	 * Upgrade a property to handle cases where it was set before the element upgraded.
	 * This is especially important for framework compatibility.
	 * @param prop - Property name to upgrade
	 * @private
	 */
	private _upgradeProperty(prop: string): void;

	/**
	 * Example attribute as a property.
	 * Reflects between property and attribute to keep them in sync.
	 */
	get exampleAttribute(): string | null;
	set exampleAttribute(value: string | null | undefined);

	/**
	 * Renders the component's shadow DOM content
	 */
	render(): void;
}
