# form-saver Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-saver.svg)](https://www.npmjs.com/package/@aarongustafson/form-saver) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-saver/ci.yml?branch=main)](https://github.com/aarongustafson/form-saver/actions)

A web component that stores (and restores) values within the first form it wraps.

It is designed for crash recovery and interrupted sessions:
- Saves form field values to `localStorage` as users type.
- Restores values when the page is loaded again.
- Clears saved values after a successful submit flow.
- Optionally retains selected fields after submit.

## Demo

[Live Demo](https://aarongustafson.github.io/form-saver/demo/) ([Source](./demo/index.html))

Additional demos:
- [ESM CDN Demo](https://aarongustafson.github.io/form-saver/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/form-saver/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/form-saver
```

## Usage

### Option 1: Auto-define the custom element (easiest)

Import the package to automatically define the `<form-saver>` custom element:

```javascript
import '@aarongustafson/form-saver';
```

Or use the define-only script in HTML:

```html
<script src="./node_modules/@aarongustafson/form-saver/define.js" type="module"></script>
```

### Option 2: Import the class and define manually

Import the class and define the custom element with your preferred tag name:

```javascript
import { FormSaverElement } from '@aarongustafson/form-saver/form-saver.js';

customElements.define('my-custom-name', FormSaverElement);
```

### Basic Example

```html
<form-saver>
  <form action="/contact" method="post">
    <label>
      Name
      <input name="name" autocomplete="name" />
    </label>
    <label>
      Email
      <input name="email" type="email" autocomplete="email" />
    </label>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

The component targets the first descendant `<form>`.

### Retain Selected Fields After Submit

Use `retain` to keep specific field names (or ids when `name` is missing) after submit:

```html
<form-saver retain="name email">
  <form action="/contact" method="post">
    <input name="name" />
    <input name="email" type="email" />
    <textarea name="message"></textarea>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

In this example, `message` is cleared after submit while `name` and `email` remain.

### Let Users Control Retention

To inject an opt-in checkbox, add `retain-choice`.

```html
<form-saver
  retain="name email"
  retain-choice
  retain-choice-label="Store my contact information for later"
>
  <form action="/contact" method="post">
    <input name="name" />
    <input name="email" type="email" />
    <button type="submit">Send</button>
  </form>
</form-saver>
```

By default, the checkbox is inserted just before the first submit control.

You can control placement with `retain-choice-container`, which accepts a CSS selector. The matched element is used as a container — the checkbox is appended inside it:

```html
<form-saver
  retain="name email"
  retain-choice
  retain-choice-container=".retain-slot"
>
  <form action="/contact" method="post">
    <input name="name" />
    <input name="email" type="email" />
    <div class="retain-slot"></div>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `retain` | `string` | `""` | Space-separated field names (or ids when name is missing) to retain after successful submit |
| `retain-choice` | `boolean` | `false` | Inject an opt-in retention checkbox |
| `retain-choice-label` | `string` | `"Store my contact information for later"` | Plain-text label for the injected checkbox |
| `retain-choice-container` | `string` | `""` | CSS selector for a container element into which the checkbox is appended |
| `storage-key` | `string` | derived | Optional storage key override |

Default derived storage key format:

```txt
form-saver:{method}:{resolvedActionUrl}
```

Where `method` and `action` come from the wrapped form.

## Methods

| Method | Description |
|--------|-------------|
| `saveFormState()` | Serializes and persists current form values |
| `restoreFormState()` | Applies saved values to current fields |
| `clearSavedData()` | Removes saved values for the current form key |

## Field Support

Supported controls include:
- `input` (except `type="file"`, `submit`, `button`, `reset`, and `image`)
- `textarea`
- `select` (single and multiple)

File fields are intentionally excluded.

## Browser Support

This component uses modern web standards:
- Custom Elements v1
- Light DOM (no shadow root)
- ES Modules

For older browsers, you may need polyfills.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# View demo
open demo/index.html
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
