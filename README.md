# form-saver Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-saver.svg)](https://www.npmjs.com/package/@aarongustafson/form-saver) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-saver/ci.yml?branch=main)](https://github.com/aarongustafson/form-saver/actions)

A web component that stores (and restores) values within the form it wraps

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
  <!-- Your content here -->
</form-saver>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `example-attribute` | `string` | `""` | Description of the attribute |

## Events

The component fires custom events that you can listen to:

| Event | Description | Detail |
|-------|-------------|--------|
| `form-saver:event` | Fired when something happens | `{ data }` |

### Example Event Handling

```javascript
const element = document.querySelector('form-saver');

element.addEventListener('form-saver:event', (event) => {
  console.log('Event fired:', event.detail);
});
```

## CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--example-color` | `#000` | Example color property |

### Example Styling

```css
form-saver {
  --example-color: #ff0000;
}
```

## Browser Support

This component uses modern web standards:
- Custom Elements v1
- Shadow DOM v1
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
