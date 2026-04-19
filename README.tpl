# COMPONENT-NAME Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/COMPONENT-NAME.svg)](https://www.npmjs.com/package/@aarongustafson/COMPONENT-NAME) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/COMPONENT-NAME/ci.yml?branch=main)](https://github.com/aarongustafson/COMPONENT-NAME/actions)

COMPONENT_DESCRIPTION

## Demo

[Live Demo](https://aarongustafson.github.io/COMPONENT-NAME/demo/) ([Source](./demo/index.html))

Additional demos:
- [ESM CDN Demo](https://aarongustafson.github.io/COMPONENT-NAME/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/COMPONENT-NAME/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/COMPONENT-NAME
```

## Usage

### Option 1: Auto-define the custom element (easiest)

Import the package to automatically define the `<COMPONENT-NAME>` custom element:

```javascript
import '@aarongustafson/COMPONENT-NAME';
```

Or use the define-only script in HTML:

```html
<script src="./node_modules/@aarongustafson/COMPONENT-NAME/define.js" type="module"></script>
```

### Option 2: Import the class and define manually

Import the class and define the custom element with your preferred tag name:

```javascript
import { ComponentNameElement } from '@aarongustafson/COMPONENT-NAME/COMPONENT-NAME.js';

customElements.define('my-custom-name', ComponentNameElement);
```

### Basic Example

```html
<COMPONENT-NAME>
  <!-- Your content here -->
</COMPONENT-NAME>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `example-attribute` | `string` | `""` | Description of the attribute |

## Events

The component fires custom events that you can listen to:

| Event | Description | Detail |
|-------|-------------|--------|
| `COMPONENT-NAME:event` | Fired when something happens | `{ data }` |

### Example Event Handling

```javascript
const element = document.querySelector('COMPONENT-NAME');

element.addEventListener('COMPONENT-NAME:event', (event) => {
  console.log('Event fired:', event.detail);
});
```

## CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--example-color` | `#000` | Example color property |

### Example Styling

```css
COMPONENT-NAME {
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
