# Web Components Best Practices

This template incorporates best practices from Google's [Custom Element Best Practices](https://web.dev/articles/custom-elements-best-practices) guide. This document explains the patterns used in the template and why they're important.

## Shadow DOM

### ✅ Create shadow root in constructor

The shadow root is created in the `constructor()`:

```javascript
constructor() {
  super();
  this.attachShadow({ mode: 'open' });
}
```

**Why?** The constructor is when you have exclusive knowledge of your element. Setting up implementation details here means you don't need to guard against situations where your element is detached and reattached.

### ✅ Support the `hidden` attribute

The template includes proper support for the `hidden` attribute:

```css
:host {
  display: block;
}

:host([hidden]) {
  display: none;
}
```

**Why?** Custom elements with a default `display` style will override the lower specificity built-in `hidden` attribute. Always add `:host([hidden]) { display: none }` to ensure `hidden` works as expected.

### ✅ Use `<slot>` for content projection

The template uses `<slot>` to allow users to pass content:

```html
<slot></slot>
```

**Why?** This makes your component more composable. When custom elements aren't supported, nested content remains visible and accessible (progressive enhancement).

## Attributes and Properties

### ✅ Property/Attribute Reflection

Properties and attributes are kept in sync:

```javascript
get exampleAttribute() {
  return this.getAttribute('example-attribute');
}

set exampleAttribute(value) {
  if (value === null || value === undefined) {
    this.removeAttribute('example-attribute');
  } else {
    this.setAttribute('example-attribute', value);
  }
}
```

**Why?** Users can interact with your element either declaratively (HTML attributes) or imperatively (JavaScript properties). Keeping them in sync prevents confusion and bugs.

### ✅ Avoid Reentrancy in `attributeChangedCallback`

The `attributeChangedCallback` only handles side effects, not the full state update:

```javascript
attributeChangedCallback(name, oldValue, newValue) {
  if (oldValue === newValue) return;
  
  switch (name) {
    case 'example-attribute':
      // Only handle side effects here
      // The property getter reads from the attribute
      break;
  }
}
```

**Why?** If `attributeChangedCallback` also sets the property, and the property setter reflects to the attribute, you create an infinite loop. Instead, let the property getter read from the attribute directly.

### ✅ Lazy Property Upgrade

The `_upgradeProperty()` method handles properties set before the element was defined:

```javascript
_upgradeProperty(prop) {
  if (Object.prototype.hasOwnProperty.call(this, prop)) {
    const value = this[prop];
    delete this[prop];
    this[prop] = value;
  }
}
```

Called in `connectedCallback()`:

```javascript
connectedCallback() {
  this._upgradeProperty('exampleAttribute');
  // ...
}
```

**Why?** Frameworks may set properties on your element before its definition loads. This pattern preserves those early-set values.

### ✅ Don't Override Global Attributes

Always check if global attributes are already set before applying defaults:

```javascript
connectedCallback() {
  if (!this.hasAttribute('role')) {
    // Only set if not already defined
    // this.setAttribute('role', 'group');
  }
  if (!this.hasAttribute('tabindex')) {
    // this.setAttribute('tabindex', 0);
  }
}
```

**Why?** Developers using your element may need to override `role`, `tabindex`, etc. for accessibility. Always respect their choices.

## Events

### ✅ Dispatch Events for Internal State Changes

Dispatch events when your component's state changes internally:

```javascript
// Dispatch when component changes its own state
this.dispatchEvent(new CustomEvent('component-name:change', {
  detail: { value: newValue },
  bubbles: true,
  composed: true
}));
```

### ❌ Don't Dispatch Events for Host-Set Properties

**Don't** dispatch events when the host sets a property:

```javascript
// ❌ BAD - creates infinite loops
set myProperty(value) {
  this.setAttribute('my-property', value);
  this.dispatchEvent(new CustomEvent('change')); // DON'T DO THIS
}
```

**Why?** The host already knows it set the property. Dispatching an event can cause infinite loops with data binding systems.

## Rich Data (Objects/Arrays)

### ✅ Accept Rich Data as Properties Only

```javascript
// ✅ Good - rich data as property
set items(value) {
  this._items = value;
  this.render();
}

// ❌ Bad - trying to accept objects as attributes
set items(value) {
  this.setAttribute('items', JSON.stringify(value)); // Don't do this
}
```

**Why?** Serializing objects to strings is expensive and loses references. HTML attributes work best for primitive values.

## Implementation Notes

### Template Placeholders

This is a template repository. Before use:

1. Run `npm run setup` to replace placeholders
2. Or manually replace:
   - `COMPONENT-NAME` → your element name (e.g., `my-button`)
   - `ComponentNameElement` → your class name (e.g., `MyButtonElement`)
   - `COMPONENT_DESCRIPTION` → your description

### Testing

The test file demonstrates all the best practices:

- Shadow DOM creation
- Hidden attribute support
- Property/attribute reflection
- Lazy property upgrade

Run tests with:

```bash
npm test          # Watch mode
npm run test:run  # Single run
```

## Further Reading

- [Custom Element Best Practices](https://web.dev/articles/custom-elements-best-practices) - Google Web Fundamentals
- [Custom Elements Everywhere](https://custom-elements-everywhere.com/) - Framework compatibility
- [Open Web Components](https://open-wc.org/) - Tools and recommendations

## License

MIT - See [LICENSE](LICENSE)
