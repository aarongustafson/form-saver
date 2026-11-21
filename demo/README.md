# Editing demos

The demo shell and its common tests come from
[web-component-starter](https://github.com/aarongustafson/web-component-starter).
Each component keeps its own examples and behavior.

## Where to make a change

| Change                                                               | Edit here                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Global colors, fonts, spacing, notes, code panels, or focus behavior | The starter’s `demo/demo-shell.css` and shared regression tests        |
| Optional highlighting, Copy controls, or common failure handling     | The starter’s `demo/code-examples.js` and shared enhancement tests     |
| One component’s visual examples                                      | Local `demo/styles.css`, scoped to the example                         |
| Example markup, translations, or behavior                            | Local demo HTML and example modules                                    |
| Which pages are full demos, embedded examples, or fixtures           | Local `demo/pages.json`                                                |
| Component-only regression                                            | A local test file, separate from the shared tests                      |
| Runtime API or component styling                                     | The component’s source, runtime stylesheet, declarations, and API docs |

For example, fix shared note spacing in the starter, then propagate that fix.
Put a pill-style tab example in the tab component’s local styles and tests.
Do not copy global body, header, or code-panel rules into local CSS to hide a
shared regression.

Generic form defaults live in the shell’s `demo-controls` cascade layer, below
component styles loaded afterward. Keep them there: unlayered form rules can
override a component's own layers, changing its layout or reducing control
targets. Fix a shared cascade conflict in the starter, not with local pixel
overrides or weaker tests.

Inline code is reading content, not a button. Its default colors use `Canvas`
and `CanvasText`; some platforms' dark `ButtonFace`/`ButtonText` pairing is not
readable enough for prose. Keep native controls separate from this treatment.

## Managed files: do not patch consumer copies

The exact allowlist is [shared-files.json](shared-files.json). It includes this
guide, scoped demo instructions, the shell, the optional enhancement loader,
and shared unit/browser tests and fixtures.

Edit these files only in the starter. Preserve identical copies in consumers.
Do not fork a shared test, skip assertions, or change integrity metadata to
silence a failure. Inspect unexpected differences and fix them at the owner.
Root agent instructions and contributor notes are local entry points; do not
replace unrelated guidance when updating their links.

The generated `demo/shared-integrity.json` records content hashes, not an
upstream commit or a promise to follow “latest.” `npm run demo:check` verifies
the allowlist and every managed file without a sibling checkout or network.
CI runs this through the existing lint command. Do not edit the generated
snapshot in consumers.

In the canonical starter only, after editing and validating shared source,
run `node scripts/check-demo-shared.js --record` and rerun checks. That records
the new source content; it is not an updater and cannot fetch or publish files.

In the private workspace, `npm run demos:sync -- <component> --dry-run`
previews routine updates; `--check` compares shared files and provenance.
With no flag, the command requires a clean, committed starter, runs its full
checks including browser tests, and updates clean enrolled consumers on feature
branches. Consumers run lint, unit, and declared type checks by default.
Use `--browser` to run their browser suites locally too. Otherwise their
receipts explicitly mark local browser checks skipped; verify the PR's browser
CI before merging. Read-only modes cannot be combined with `--browser`.
The command never commits, pushes, or installs dependencies.

The generated `demo/shared-source.json` records the source commit and the
integrity snapshot’s hash. Do not edit it to bypass drift protection. Initial
adoption still requires reviewed local extraction and exact allowlist copies;
routine sync refuses unmigrated demos and changed managed-file membership.
Failures retain inspectable changes rather than promising a rollback.
When a source record is present, `demo:check` also verifies its format and
snapshot digest without using the workspace or network.

The standalone updater remains deferred. Outside the workspace, propose shared
changes in the public starter repository; local example work does not require
the private workspace. Do not use a directory-wide template overwrite.

## Page structure and localization

Full demo pages load `demo-shell.css` first, an optional component runtime
stylesheet next, and local `styles.css` last. Set `data-demo-page="full"` on
the body. Embedded examples and fixtures keep their own layout; classify every
nonignored HTML page in `pages.json`.

Keep the skip link, named/focusable code blocks, code/live pairs, and author
footer. Keep code readable without JavaScript and component registration
independent of optional code enhancement.

The shared no-JavaScript check looks for useful fallback across the live
examples, not just the first one. Do not add filler text or rearrange examples
to satisfy it. Source-only custom elements are not native image fallbacks;
authored images need meaningful `alt` text and must remain visible.
Hidden or transparent text/images and script/style source do not count as
fallback content. Code/live pairs may stay in one column on wide screens when
the example needs that space; the shared checks follow the computed grid.

Preserve the browser’s native focus ring, including on Copy controls. Leave
space for the ring around focused controls; do not clip it to a rounded panel.
Keep scrolling on the code block itself, not on its surrounding panel.

Native popovers, modal dialogs, and fullscreen content are drawn above the
surrounding page. The shared focus check stops at that boundary; clipping
inside the opened content still matters. Fix shared focus checks in the starter,
not by removing working component overflow styles or weakening a local test.

Author the live-example label in each `.demo` element’s `data-demo-label`.
The enhancement status element supplies `data-loading-message`,
`data-failure-message`, and `data-theme-failure-message`. Translate these
alongside the page, its code-panel labels, and its visible content; the shared
loader does not supply English UI defaults.
Shared failure checks compare the displayed status with these authored
messages, so translating them does not require changing the tests.

Preserve semantic `mark` elements around component tags and API configuration
inside displayed code. Keep inline API names in plain `code`, without `mark`
wrappers. The optional highlighter removes markup only after its required modules
load. Failure must retain readable, selectable authored code.

## Demo content

A demo introduces the component and shows what changes when someone uses it.
Keep the page focused on working examples, not how the demo was built.

- Start with the simplest useful example, then introduce more involved
  configurations in a clear order. Explain each option just before it appears.
- Say what someone can try and how it changes the experience. Include only the
  context needed to understand the example or recover from a failure.
- Write clear, conversational prose for someone with basic HTML, CSS, and
  JavaScript knowledge. Use accurate terms, explain unfamiliar ones, and avoid
  jargon.
- Link to the README for the full API, CSS custom properties, and parts.
  Don’t repeat those reference lists on the demo page.
- Use one descriptive heading for a single example. For instance, don’t nest
  “Custom Key Attribute” under “Custom Variable Name” when both introduce the
  same example. Group related examples only when a group heading helps readers.
- Avoid redundant section wrappers or adjacent separators with no content
  between them. Keep meaningful headings, reading order, and code/live pairs.
- Keep instructions needed for keyboard use, loading, failure, and
  no-JavaScript behavior. Concise doesn’t mean leaving someone without a next
  step.

The existing demos need a separate content audit after the shared-style and
template migration. Capture content problems during conversion rather than
mixing a broad rewrite into the structural work.

## Validate

Run the component’s existing lint, unit, and browser commands:

```sh
npm run lint
npm run test:run
npm run test:browser
```

In the workspace, use `npm run components:check -- <component> --browser`.
Let the existing test runner manage its server; stop a conflicting managed
preview through the workspace server manager first.
For managed static previews, use `/demo/` under the returned base URL rather
than `/demo/index.html`; a clean-URL redirect can otherwise break relative
asset paths.

Check actual pages as well as shared fixtures. Preserve native keyboard focus,
light/dark and increased-contrast behavior, code scrolling, narrow-screen
reflow, print, and loading/error/no-JavaScript states. Do not rely on automated
checks alone to establish accessibility.
