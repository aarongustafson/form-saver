# form-saver Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-saver.svg)](https://www.npmjs.com/package/@aarongustafson/form-saver)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-saver/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/form-saver/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/form-saver?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/form-saver)
[![License](https://img.shields.io/npm/l/@aarongustafson/form-saver)](https://github.com/aarongustafson/form-saver/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/form-saver)](https://github.com/aarongustafson/form-saver/blob/main/form-saver.d.ts)

`<form-saver>` saves drafts from the first form it wraps to `localStorage`
and restores them on a later visit. Without JavaScript, the native form remains
usable, but drafts aren’t saved or restored.

It’s designed for crash recovery and interrupted sessions:

- Debounces saves to `localStorage` as users type.
- Restores values when the page is loaded again.
- Clears the full draft on `pagehide` following a submit it observed as uncanceled.
- Optionally retains selected fields during that cleanup.
- Excludes password and file controls.

That submit/pagehide sequence does **not** confirm server acceptance. Drafts
are plaintext unless you supply a storage transformation, and any JavaScript
running on the same origin can read them. The retention checkbox controls
post-submit storage, not consent to autosave.

## Demo

[Live Demo](https://aarongustafson.github.io/form-saver/demo/) ([Source](./demo/index.html))

Additional demos:

- [Behavior Module Demo](https://aarongustafson.github.io/form-saver/demo/behavior.html) ([Source](./demo/behavior.html), [Module](./demo/writing-help.js)): writing help without storage hooks.
- [Encrypted Draft Demo](https://aarongustafson.github.io/form-saver/demo/encrypted.html) ([Source](./demo/encrypted.html), [Storage Module](./demo/draft-storage.js))
- [ESM CDN Demo](https://aarongustafson.github.io/form-saver/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/form-saver/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/form-saver
```

## Usage

### Option 1: Register automatically

Import the definition helper to register `<form-saver>`:

```javascript
import '@aarongustafson/form-saver/define.js';
```

Or use the define-only script in HTML:

```html
<script
  src="./node_modules/@aarongustafson/form-saver/define.js"
  type="module"
></script>
```

### Option 2: Import the class and define manually

The package’s main import and `form-saver.js` export the class without registering
it. Define the tag used in your HTML:

```javascript
import { FormSaverElement } from '@aarongustafson/form-saver';

customElements.define('form-saver', FormSaverElement);
```

You can use a different tag name if you update your markup to match.
`define.js` also exports `defineComponentName(tagName = 'form-saver')`.
Importing it calls that helper; it skips already registered tags and returns
`false` when a browser registry isn’t available, or `true` when one is.

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

Provide a working endpoint for `action`; `/contact` is an example, not a service
provided by this package. The component targets the first descendant `<form>`.
Without one, it doesn’t initialize.

## Autosave, Submission, and Retention

The component restores on connection and saves as people edit. It doesn’t
intercept submission, check the response, or reset live fields after submission.
When its submit listener sees an event that hasn’t been canceled, it saves the
current state and marks cleanup as pending. A later `pagehide` removes the full
draft and optionally writes retained fields. This can happen even if the server
rejects the submission; it isn’t proof that the message arrived.

If your application cancels submission, cancel it before the component’s
listener runs. Cancellation by a later listener won’t undo pending cleanup.
For an application-controlled submission, call `clearSavedData()` after your
application confirms acceptance. That method clears storage, not live fields.

### Retain Selected Fields After Submit

Use `retain` to keep specific field names (or ids when `name` is missing) after submit:

```html
<form-saver retain="name email">
  <form action="/contact" method="post">
    <label>Name <input name="name" autocomplete="name" /></label>
    <label
      >Email <input name="email" type="email" autocomplete="email"
    /></label>
    <label>Message <textarea name="message"></textarea></label>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

During post-submit pagehide cleanup, this stores `name` and `email`, but not
`message`. It doesn’t clear those fields in the current form.

### Let Users Control Retention

Add `retain-choice` to insert an initially unchecked, labeled checkbox.
It controls whether the selected fields are retained during post-submit cleanup.
It does **not** turn autosave on or off. If your application requires consent
before saving drafts, obtain that consent before enabling the component.

```html
<form-saver
  retain="name email"
  retain-choice
  retain-choice-label="Store my contact information for later"
>
  <form action="/contact" method="post">
    <label>Name <input name="name" autocomplete="name" /></label>
    <label
      >Email <input name="email" type="email" autocomplete="email"
    /></label>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

By default, the checkbox is inserted just before the first submit control.

Use `retain-choice-container` to append it inside a matching element in the
wrapped form. If no element matches, the component uses its default placement;
if there’s no submit control, it appends the checkbox to the form. Supply a valid
CSS selector—invalid syntax can interrupt initialization.
See the [placement example](https://aarongustafson.github.io/form-saver/demo/#retention-placement).
Changing the label, placement, or `retain-choice` rebuilds the control and resets
it to unchecked. Both `retain` and `retain-choice` must be present when the
control is rendered.

## Attributes

| Attribute                 | Type      | Default                                    | Description                                                                                             |
| ------------------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `retain`                  | `string`  | `""`                                       | Space-separated field names (or ids when name is missing) to retain during post-submit pagehide cleanup |
| `retain-choice`           | `boolean` | `false`                                    | Inject an opt-in retention checkbox                                                                     |
| `retain-choice-label`     | `string`  | `"Store my contact information for later"` | Plain-text label for the injected checkbox                                                              |
| `retain-choice-container` | `string`  | `""`                                       | CSS selector for a container element into which the checkbox is appended                                |
| `storage-key`             | `string`  | derived                                    | Optional storage key override                                                                           |
| `script`                  | `string`  | none                                       | Application behavior module; storage hooks are optional                                                 |

Default derived storage key format:

```txt
form-saver:{method}:{resolvedActionUrl}
```

Where `method` and `action` come from the wrapped form.

Forms with the same derived key on the same origin share a draft. Set
`storage-key` to keep unrelated forms separate; the demos use distinct authored
keys. Choose keys that separate users and form versions when your application
needs that distinction, and clear drafts according to your logout and retention
policy.

## Properties and Localization

The reflected properties are `retain`, `retainChoice`, `retainChoiceLabel`,
`retainChoiceContainer`, `storageKey`, and `script`. String getters return the
attribute value or `null` when absent; `retainChoice` returns a boolean.
String setters remove the attribute for `null`, `undefined`, or `""`.
The checkbox uses the default label when `retain-choice-label` is empty.

Set `retain-choice-label` to translate the generated checkbox or use your
application’s vocabulary. There’s no shared message configuration object.
Labels, instructions, buttons, and recovery messages in your form remain your
responsibility. The [translated example](https://aarongustafson.github.io/form-saver/demo/#translated-retention)
shows the checkbox and authored recovery text together.
`beforeSave` and `beforeRestore` are callback properties described below.

## Methods

| Method               | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `saveFormState()`    | Serializes and persists current form values                          |
| `restoreFormState()` | Applies saved values to current fields                               |
| `clearSavedData()`   | Removes saved values for the current form key                        |
| `loadModule(url)`    | Imports a resolved behavior module URL; override for a custom loader |

Calls to `saveFormState()` save immediately. Saves triggered by `input` and
`change` events use a short debounce to avoid serializing the complete form and
writing to `localStorage` for every keystroke. Pending changes are flushed on
`pagehide`, not merely when the tab becomes hidden.

With `script` or either storage hook configured, `saveFormState()` and
`restoreFormState()` return promises that settle after their work completes
or an error is reported. With neither scripts nor hooks, these methods remain
synchronous. New edits, saves, clearing, storage-key
changes, disconnection, and script changes invalidate stale async work.
Replacing a storage callback also invalidates pending work, except while the
current behavior initializer is still configuring the element.
Changing callbacks or the storage key also cancels older debounced autosaves.
An explicit restore cancels an older queued autosave; edits made after that
restore starts still take precedence.

The promises can resolve after failure; listen for `form-saver-error` if your
application needs to detect a failed save before navigating.
`clearSavedData()` cancels pending work, but doesn’t disable future autosaves
when people edit the form again.

## Behavior Modules

Use `script` to connect application behavior to the form. It can configure
storage hooks, add event listeners, or connect other UI without changing how
drafts are stored:

```html
<form-saver script="./writing-help.js">
  <form action="/contact" method="post">
    <label>Message <textarea name="message"></textarea></label>
    <button
      type="button"
      hidden
      data-toggle-help
      aria-controls="writing-tips"
      aria-expanded="true"
      data-show-label="Show writing tips"
      data-hide-label="Hide writing tips"
    >
      Hide writing tips
    </button>
    <p id="writing-tips">
      Describe what you tried and what you expected. Don’t include passwords or
      other sensitive details.
    </p>
    <button type="submit">Send</button>
  </form>
</form-saver>
```

Save the [complete writing-help module](./demo/writing-help.js) beside your page
to run this example. Without JavaScript, the tips remain visible.
The URL resolves against the element’s document base URI (including `<base>`),
not the component module’s URL. Only HTTP and HTTPS module URLs are accepted.
Use trusted modules: they execute with your page’s JavaScript privileges.
The component calls `loadModule(url)` to import the resolved URL.

A module may export `initialize(element, { signal })`. If present, this must be
a function. It runs once per connection for each element and may be async.
It can return a synchronous cleanup function or nothing—not a hooks object.
A module without an initializer is also supported.

The [writing-help demo](./demo/behavior.html) uses this pattern without either
storage hook. The component waits for initialization before restoring or saving
drafts, even when the script only adds behavior.
Do not await `saveFormState()` or `restoreFormState()` inside `initialize()`.
Those methods wait for initialization, so awaiting them there creates a circular
wait. Configure callbacks and connected behavior, then let initialization finish;
the component performs its initial restoration afterward.

On disconnection or a `script` change, the component invalidates pending work,
aborts `signal`, clears the storage callbacks, and calls cleanup. Cleanup errors
are reported with operation `cleanup`. If an async initializer returns cleanup
after it was superseded, that cleanup runs immediately. Use the signal for
listeners and requests, and check `signal.aborted` after awaits before installing
callbacks or changing UI. The component cannot cancel a module import or undo
arbitrary application side effects.
Save and restore requests made synchronously by the old module’s abort listeners
or cleanup are blocked during replacement; they do not run without the old
callbacks or carry over into the new module.
Changing `script` restarts only the behavior module. It preserves live fields,
the retention checkbox, and pending submission cleanup, and does not restore
stored values again. Call `restoreFormState()` explicitly if that is intended.

## Optional Storage Hooks

`beforeSave` and `beforeRestore` are nullable callback properties, not DOM events
or HTML attributes. Set either, both, or neither; an absent callback leaves its
step unchanged. Each callback runs with the element as `this`. You can configure
them directly in JavaScript without a `script` module, too. They are cleared on
disconnect or script reinitialization, so reconnecting integrations must install
them again. If a reconnected element cannot decode its saved payload, it reports
a read error and preserves the payload. Install the callbacks and explicitly
call `restoreFormState()` to retry. Assigning a non-function other than `null` or `undefined` throws a
`TypeError`; `undefined` resets the property to `null`.

For example, an encryption integration could configure both hooks:

```javascript
// draft-storage.js (application code)
export async function initialize(element, { signal }) {
  const key = await obtainSessionAuthorizedKey({ signal });
  if (signal.aborted) return;
  element.beforeSave = (state) => encryptDraft(state, key);
  element.beforeRestore = (payload) => decryptDraft(payload, key);
}
```

`obtainSessionAuthorizedKey`, `encryptDraft`, and `decryptDraft` are
application-defined functions, not package APIs. See the runnable
[AES-GCM module](./demo/draft-storage.js) for an example using a deliberately
public demo key. Web Crypto requires a secure context (HTTPS or localhost).

- `beforeSave(state)` receives the serialized state, with password and file
  controls excluded, and returns a JSON-value payload: `null`, strings,
  booleans, finite numbers, arrays of those values, or plain objects containing
  those values. Unsupported values such as `undefined`, sparse arrays,
  `ArrayBuffer`, typed arrays, dates, custom serialization, and circular
  references report an error before storage is replaced. Convert binary
  ciphertext to an array of numbers or an encoded string.
- `beforeRestore(payload)` receives the parsed stored payload **before**
  form-state validation and returns the original state shape:
  `{ fieldName: [{ type: 'text', value: 'example' }] }`. Checkbox/radio entries
  also contain `checked`; multiple-select entries contain `values`.
- Both hooks may return a value or a promise. Invalid hook results report an
  error rather than falling back to untransformed data. Restore results must
  contain arrays of control objects, with string `type` and `value` properties,
  boolean `checked` for checkboxes/radios, or a string array `values` instead of
  `value` for multiple selects. Password entries are removed after validation,
  and password controls are never populated. Sanitized drafts pass through
  `beforeSave` again if it is configured. If a restore callback returns state
  requiring sanitization but no save callback is available, restoration reports
  an error and preserves the original payload and fields rather than writing
  decoded values or deleting the draft.

A save-only callback can redact fields while preserving the form-state shape.
A restore-only callback can migrate compatible stored data. If a save callback
changes the storage format (for example, wrapping or encrypting it), configure
a matching restore callback. Incompatible payloads report a restoration error
and remain stored unchanged, even when no restore callback is configured.

Saves and restoration wait for initialization. If loading, initialization, or
a hook fails, `form-saver-error` reports it; the component does **not** retry
with plaintext. Failed decoding or validation of an application payload leaves
the stored payload and current fields untouched. Malformed stored JSON also reports a `read` error when a script or
hook is configured, without removing the stored payload. Existing plaintext
drafts are not automatically migrated: use a
new storage key or implement an explicit migration policy in your module.
Changing `script` restarts its behavior; removing it deliberately returns
future saves to plaintext storage without automatically reading or migrating
the old payload. Changing `storage-key` invalidates pending work but does
not automatically restore the new key; call `restoreFormState()` if needed.

The latest operation wins: delayed saves cannot overwrite a newer draft or
recreate one after `clearSavedData()`. Delayed restoration cannot overwrite
edits made while the module initializes or decrypts.

**Page lifecycle limitation:** browsers do not wait for promises during
`pagehide`. Autosave is best-effort; immediate navigation, closing a tab, or a
crash can lose the latest asynchronous save. When an application controls
navigation, await `saveFormState()` before leaving. During `pagehide` following
submission, the full draft is removed before any opted-in retained fields are
transformed again. That asynchronous retention write may not finish during navigation;
clearing takes priority over keeping the full draft.
Calling `clearSavedData()` explicitly also cancels pending post-submit retention,
so navigating away cannot recreate that cleared draft from retained fields.
Post-submit retention always uses the selected live fields, not the previously
stored envelope. If the application deliberately removes the encryption module
or callbacks before navigation, retained fields use the configuration then in
effect, including plaintext storage when no save transformation remains.

## Field Support

Supported controls include:

- `input` (except `type="password"`, `file`, `submit`, `button`, `reset`, and `image`)
- `textarea`
- `select` (single and multiple)

File and password fields are always excluded. Password values are neither saved
nor restored, even if their field names appear in `retain`.

## Privacy and Storage Errors

Without an encryption transformation, saved values are stored as plaintext in
`localStorage`, including when `script` only adds other behavior. Any JavaScript running
on the same origin can read them, so avoid wrapping forms that collect other
sensitive information that should not persist on the device. The component
defensively removes identifiable password entries from recognizable native
stored drafts, including drafts with null fields or null control entries. This
cleanup concerns existing storage, not newly collected password inputs.
It also runs when a behavior module supplies no restore callback. Recognizable
native drafts are scrubbed before remaining-field validation, so an invalid
control value cannot prevent removal of an identifiable stored password.
Invalid remaining fields report an error and are not applied to the form.
Incompatible application payloads are preserved rather than treated as native
drafts, including envelopes containing byte or string arrays; application
restore hooks remain responsible for decoding their format.

Encryption is only as useful as the application’s key and session management.
Do not persist a real encryption key alongside drafts. Authorize key access on
the server and revoke access on logout or session expiry. Another person can
still restore drafts if the prior session authorizes the key. Encryption does
not protect against malicious same-origin JavaScript and is not, on its own,
a guarantee of GDPR compliance. The existing `retain-choice` checkbox controls
post-submit retention, **not** permission to save drafts before submission.

If a browser blocks `localStorage`, its quota is exhausted, or another storage
operation fails, the component dispatches a bubbling, composed
`form-saver-error` event. Its `detail` contains:

```javascript
{
  operation: 'read' | 'write' | 'remove' | 'initialize' | 'cleanup' | 'beforeSave' | 'beforeRestore',
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

The component doesn’t emit saved or restored events or insert status messages.
Saving happens automatically as people edit the form, without an extra save
control, routine status message, or focus change. The demos provide empty
`role="status"` regions that show authored recovery text only when
`form-saver-error` occurs. The `data-error` string in the demo markup can be
translated; it isn’t a component attribute. The demo’s
[feedback module](./demo/feedback.js) assigns that string with `textContent` and
never copies field values into announcements. Load an error listener before
registration to catch initial restoration errors. The demo message stays visible
after an error; it doesn’t confirm a later save or restore.

Without JavaScript, or if the component or configured behavior module fails to
load, the native form remains usable, but drafts can’t be saved or restored.
Provide a working form endpoint
and visible instructions to keep a copy before leaving. The demo endpoints are
placeholders, not submission services. A storage error leaves the current form
values in place; authors should show visible recovery instructions with
`form-saver-error` instead of relying on a console message.

On disconnection, the component removes its form and page listeners, cancels
debounced saves, invalidates pending asynchronous work, and cleans up its behavior
module. It leaves live values and stored data in place. On reconnection it
initializes again and attempts restoration; reinstall directly assigned hooks
before retrying a transformed draft.

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
