---
description: Shared demo ownership, local extension points, and regression prevention.
applyTo: 'demo/**,test/demo-*.test.js,test/browser/**,scripts/check-demo-shared.js'
---

Read [the demo editing guide](../../demo/README.md) and its managed-file list.
Edit shared files only in web-component-starter, never in a consumer copy.
Keep local examples, translated labels/messages, and customization styles in
locally owned files. A global shell regression needs a starter fix and shared
regression test, not a local override or weakened assertion.

Do not fork the common tests, change integrity metadata by hand, or modify
runtime behavior or publishing automation to make a demo migration pass.

## Routine shared updates

Workspace `demos:sync` always runs full starter validation, including browser
tests. Consumer sync runs lint, unit, and declared type checks by default;
`--browser` also runs local consumer browser suites. Unrequested browser checks
are reported skipped, not passed. Verify PR browser CI before merging routine
updates; keep those workflows and all integrity/provenance guards intact.
Initial migrations and changes to component behavior still need full local
browser validation. Do not use the faster sync mode to hide a failing test.

## Shared test fixtures

Load styles in the actual page order and opt fixtures into the page mode they
exercise (`data-demo-page="full"` for full-page styles). Select the direct code
and live columns, not every `pre` inside a pair: a live example can contain its
own code blocks. Wait for the measured no-overflow condition after adaptive
updates instead of assuming rendering is synchronous or adding a fixed delay.
Check the declared grid layout so intentionally stacked examples stay covered
without component-name exceptions in the shared suite.

Use `readDemoStyles('basic.html')` when a fixture exercises an embedded page
rather than the main showcase. Full code-only integration pages still need
overflow checks; apply code/live geometry assertions only to actual pairs.
Keep generic form defaults in the shell's `demo-controls` cascade layer so
they don't override layered light-DOM component styles. Preserve measured
control-target requirements instead of adding local pixel overrides.

Keep the opaque Canvas backplate beneath normal fields' translucent Field
gradient so a colored label cannot reduce their contrast. Forced colors need
a solid Field background without the gradient. Test colored ancestors as well
as the default Canvas surface when changing shared form-control colors.
