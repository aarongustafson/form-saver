# Agent instructions

Read [the demo editing guide](demo/README.md) before changing demos or their tests.

- Shared demo assets and tests come from
  [web-component-starter](https://github.com/aarongustafson/web-component-starter).
  In a component repository, do not edit those copies or bypass their drift checks.
- Fix shared layout, colors, focus, code enhancement, and common test behavior
  in the starter, then propagate the validated files. Do not mask shared defects
  with component-local overrides.
- Keep component examples, translations, runtime code/styles, and
  component-specific regression tests local. Preserve progressive enhancement,
  native keyboard behavior, and authored content.
- Work on a feature branch. Write a focused failing regression test first, then
  implement and run the applicable lint, unit, and browser checks. Do not weaken
  shared tests or edit provenance to obtain a pass.
- Do not change versions, publishing automation, tags, or releases without
  explicit direction.

When working in a checkout that includes `SETUP.md`, follow that guide for
template setup changes. Generated components retain this file and the
demo guide, but do not retain the one-time setup material.
