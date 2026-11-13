# form-saver Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-saver.svg)](https://www.npmjs.com/package/@aarongustafson/form-saver) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-saver/ci.yml?branch=main)](https://github.com/aarongustafson/form-saver/actions)

A web component that stores (and restores) values within the first form it wraps.

It is designed for crash recovery and interrupted sessions:

- Debounces saves to `localStorage` as users type.
- Restores values when the page is loaded again.
- Clears saved values after a successful submit flow.
- Optionally retains selected fields after submit.
- Never saves or restores password fields.

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
<script
  src="./node_modules/@aarongustafson/form-saver/define.js"
  type="module"
></script>
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

| Attribute                 | Type      | Default                                    | Description                                                                                 |
| ------------------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `retain`                  | `string`  | `""`                                       | Space-separated field names (or ids when name is missing) to retain after successful submit |
| `retain-choice`           | `boolean` | `false`                                    | Inject an opt-in retention checkbox                                                         |
| `retain-choice-label`     | `string`  | `"Store my contact information for later"` | Plain-text label for the injected checkbox                                                  |
| `retain-choice-container` | `string`  | `""`                                       | CSS selector for a container element into which the checkbox is appended                    |
| `storage-key`             | `string`  | derived                                    | Optional storage key override                                                               |

Default derived storage key format:

```txt
form-saver:{method}:{resolvedActionUrl}
```

Where `method` and `action` come from the wrapped form.

## Methods

| Method               | Description                                   |
| -------------------- | --------------------------------------------- |
| `saveFormState()`    | Serializes and persists current form values   |
| `restoreFormState()` | Applies saved values to current fields        |
| `clearSavedData()`   | Removes saved values for the current form key |

Calls to `saveFormState()` save immediately. Saves triggered by `input` and
`change` events use a short debounce to avoid serializing the complete form and
writing to `localStorage` for every keystroke. Pending changes are flushed when
the page is hidden.

## Field Support

Supported controls include:

- `input` (except `type="password"`, `file`, `submit`, `button`, `reset`, and `image`)
- `textarea`
- `select` (single and multiple)

File and password fields are always excluded. Password values are neither saved
nor restored, even if their field names appear in `retain`.

## Privacy and Storage Errors

Saved values are stored as plain text in `localStorage`. Any JavaScript running
on the same origin can read them, so avoid wrapping forms that collect other
sensitive information that should not persist on the device. The component
automatically removes identifiable password entries written by earlier
versions when it reads saved state.

If a browser blocks `localStorage`, its quota is exhausted, or another storage
operation fails, the component dispatches a bubbling, composed
`form-saver-error` event. Its `detail` contains:

```javascript
{
  operation: 'read' | 'write' | 'remove',
  error: Error
}
```

For example:

```javascript
document
  .querySelector('form-saver')
  .addEventListener('form-saver-error', ({ detail }) => {
    console.error(
      `Could not ${detail.operation} saved form data`,
      detail.error,
    );
  });
```

## Styling, Feedback, and Recovery

The component adds no palette or focus styles. Its light-DOM form keeps native
labels, validation, keyboard navigation, and submission behavior. Keep the
foreground and background together when styling text fields, buttons, and
reading panels. Don’t use color alone to explain saved, restored, or failed
storage.

The demos use `CanvasText`/`Canvas` for instructions and feedback,
`FieldText`/`Field` for fields and code blocks, and
`ButtonText`/`ButtonFace` for buttons and inline code. Translucent control and
code surfaces have a Canvas backplate. Browser focus indicators remain intact.
Forced colors keep automatic adjustment; increased contrast keeps full-strength
supporting text. These pairs passed the 19 distinct recorded study palettes;
they aren’t a guarantee for every platform or author override.

The component doesn’t emit saved or restored events or insert status messages.
The demos provide authored `role="status"` text and a “Save draft now” button
that calls `saveFormState()`. A synchronous `form-saver-error` prevents a false
success message. On reload, a stored-draft notice asks the user to review the
fields; it doesn’t claim that every stored value is valid or applied. The
`data-ready`, `data-restored`, `data-saved`, and `data-error` strings in the demo
markup can be translated. They aren’t component attributes. The feedback never
moves focus or copies field values into announcements.

Without JavaScript, or if a module fails to load, the native form remains usable,
but the component can’t save or restore drafts. Provide a working form endpoint
and visible instructions to keep a copy before leaving. The demo endpoints are
placeholders, not submission services. A storage error leaves the current form
values in place; authors should show visible recovery instructions with
`form-saver-error` instead of relying on a console message.

The retention checkbox controls which fields survive submission, **not** whether
drafts are saved before submission. The demos use invented details and distinct
storage keys so their drafts don’t overwrite one another.

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

# Run browser checks (one worker)
npx playwright install chromium firefox webkit
npm run test:browser -- --workers=1

# Lint code
npm run lint

# Format code
npm run format

# Serve the demo without caching
node scripts/serve.js
# Open http://127.0.0.1:4192/demo/index.html
```

Browser checks cover light/dark reading surfaces, the recorded study palettes
with alpha compositing, keyboard focus, draft restoration, localized storage
failure feedback, native validation, canceled submission, reset, retention
opt-in, password/file exclusion, disconnect cleanup, narrow layouts, enlarged
text, and unavailable modules/JavaScript. CDN tests substitute the local module
so they don’t depend on network availability or verify the CDN’s current build.
Forced-color emulation is not OS high-contrast testing. Screen-reader output,
real OS palette repainting, and browser zoom still need manual review; these
checks don’t establish accessibility conformance. The browser suite records the
known Ubuntu WebKit dark `ButtonText`/`ButtonFace` contrast limitation as a narrow
expected failure; it doesn’t lower the contrast threshold or change the native
pair on other platforms. Engines without forced-color adjustment support skip
that emulation check.

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
