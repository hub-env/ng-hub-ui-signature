# Changelog

## [22.8.0] - 2026-09-08

### Changed

- **The field keeps its stylesheet to itself.** `<hub-signature>` shipped with
  `ViewEncapsulation.None`, which publishes every rule it emits into the application's global
  cascade, where it competes with rules the library never sees and cannot be removed by anyone who
  did not know it was there. None of the four reasons `CODING_RULES.md` allows for it applied: every
  selector in the sheet names `.hub-signature`, and that is the component's **own root element**,
  drawn by its own template — not the host, not projected content — so emulated encapsulation
  reaches all of it. Not one selector had to move. What you write to theme the field does not move
  either: `.hub-signature` is still on an element your global stylesheet matches, so both a
  hand-written rule and `hub-signature-theme()` land exactly where they did. `BREAKING_CHANGES.md`
  records the one case that does change.

### Added

- **`ng-hub-ui-ds` is declared as an optional peer dependency** (`>=22.0.0`). The token defaults
  climb `--hub-input-*` and `--hub-label-*` first and the `--hub-sys-*` / `--hub-ref-*` ladder after
  that, and nothing in the manifest said so — so a consumer reading the package on npm could not
  tell that installing the token package is what gives the field the family palette and its dark
  mode. It stays optional: every token ends in a literal fallback.

## [22.7.0] - 2026-09-06

### Added

- **Projected `hubFormText` and `hubValidationError` templates are rendered.** Both queries
  live on `HubFieldControl`, so a `<ng-template hubFormText>` or a
  `<ng-template hubValidationError key="required">` placed inside `<hub-signature>` compiled,
  was matched and was collected — and then read by nothing: the field printed the plain
  `formText()` string and the default message for every error key. A projected template that
  compiles and silently draws nothing is the worst shape a gap can take, and it is the third
  time this field has taken it, after `[validFeedback]` in 22.3.0 and `formTextType` in 22.6.0.

  The helper block now renders the template when one is projected and falls back to the string
  otherwise, and each validation error resolves its own template before reaching the default
  message — the same two `ngTemplateOutlet` pairs the rest of the family uses, so a consumer
  who wrote the markup for `hub-input` can move it to `hub-signature` unchanged. Both
  directives are public exports of `ng-hub-ui-forms`, which is exactly why they were reached
  for here.

### Changed

- **`FUNCTIONALITIES.md` answers to the examples that exist.** `strokeColor`, `labelType`,
  `ariaLabel`, the per-field `labels` override and `(valueChange)` were all marked as having no
  example while three of them were already exercised or are now; `formTextType`, `showValid` and
  `disabled` had no row at all. The table is the map of what is demonstrated, so a stale mark
  there sends a consumer looking for a demo that is there — or trusting one that is not.
  The two projected templates this release renders have rows of their own, both covered by the
  example added for them.

### Fixed

- **`MIGRATION.md` no longer warns about a defect fixed in 22.6.1.** The guide still told a reader
  to prove server-side rendering in a spike before scheduling the migration, or to defer the field
  behind `@defer (on viewport)`, because `writeValue()` reached the canvas with no platform guard.
  `redraw()` has returned early outside the browser since 22.6.1. A warning that outlives its
  defect costs more than a missing one: it sends someone to budget for work that is already done,
  and it makes every other warning in the file cheaper to ignore. The section and the migration
  checklist now state the version the guard arrived in, for readers pinned below it.

- **The touched-state section no longer contradicts the one three screens above it.** It closed
  with "the message renders as text only; there is still no border change", which 22.5.0 made
  false — the drawing surface takes the danger border and ring with the message. The same file
  documents that change under its own heading, so the guide disagreed with itself.

- **`classlist` lands on the host, and both documents now say so.** `FUNCTIONALITIES.md` and the
  library page described it as classes applied to the drawing surface; the component binds
  `host: { '[class]': 'classlist()' }`. A consumer writing a rule against a class they believed
  was on the canvas got a selector matching nothing, with no error to explain it.

- **`README.md` and `README.es.md` document the inputs.** Neither mentioned `height`,
  `strokeWidth`, `labelType`, `formText`, `showValid`, `validFeedback` or `classlist`, so a reader
  who never opened the documentation site could not discover half the public surface — the file
  read as a feature tour rather than a reference. Both now carry an input table, the inherited
  `ng-hub-ui-forms` half included.

- **`README.es.md` carries the migration section its English counterpart leads with.** The Spanish
  file went straight from the description to installation, so a Spanish-speaking reader arriving
  from `angular2-signaturepad` was never told the guide exists — and it is the document that says
  which stored signatures cannot be loaded back at all.

- **The declared peer ranges now name versions the component actually builds against.** They
  read `ng-hub-ui-forms >=22.0.0` and `ng-hub-ui-utils >=22.8.0`, and neither floor was ever
  true. `showsFormTextTooltip()`, `formText()` and the `.hub-field__label-row` styling the
  label row is drawn with all arrived with forms 22.31.0 — the release that also moved
  `formText` onto `HubFieldControl`, which is why 22.6.0 could delete the component's own
  declaration. `HubTooltipDirective` arrived with utils 22.9.0; against 22.8.x the import
  resolves to nothing and the directive sits `undefined` in the `imports` array.

  The ranges being wide did not make them permissive, it made them silent. forms 22.31.0 is
  days old, so an existing consumer adding this field keeps the forms version it already has,
  npm sees the range satisfied and upgrades nothing, and the application fails to compile on a
  base class member that is simply not there. The floors are now `>=22.31.0` and `>=22.9.0`,
  which is what the rest of the family already does — `ng-hub-ui-forms` states its real utils
  floor rather than the oldest major.

- **The helper-text mark survives a field with no visible label.** `formTextType="tooltip"`
  hangs the helper text behind a question mark at the end of the label row, and the whole row
  was nested inside the `@if (label() || required())` guard. A bare surface — which
  `MIGRATION.md` documents as a supported configuration, and which `[ariaLabel]` exists to
  name — therefore drew no mark, while the block below had already stood down because tooltip
  mode was on. The helper text was accepted, resolved, and rendered nowhere at all, so the only
  way out was to give the field a visible label it was deliberately built without.

  The row is now rendered because the hint is due, not because the label is, and the label
  moves into it only when there is one. That is the rule `hub-input` and `hub-segmented`
  already state in their own templates; the divergence here was accidental, not a decision a
  canvas needed.

- **`[height]` resizes the surface it already reported.** `canvas.height`, `canvas.style.height`
  and the repaint were written in one place only — `resizeCanvas()`, called once from
  `afterNextRender()` — while `toSvg()` read `height()` live. Changing the input therefore moved
  the `viewBox` of every value saved from that moment on and moved nothing on screen: ink drawn on
  a 160-tall surface was filed as a 240-tall document, so it no longer filled the frame it declared
  — it sat in the top two thirds, and a viewer forcing it back into the old box squeezed it. The
  binding looked reactive because it is a signal input, and the only way to keep the archive honest
  was to treat it as fixed or to call `resizeCanvas()` by hand after every change.

  An effect now watches `height()` and re-runs `resizeCanvas()`, which is the call the guide used
  to ask the consumer to make. Strokes are still never rescaled — they keep the coordinates they
  were captured with, and the taller surface simply leaves more room beneath them — so change the
  height while the field is empty whenever the ink has to keep its place inside the box.

- **The README states the stylesheet setup step.** Install said
  `npm install ng-hub-ui-signature ng-hub-ui-forms` and stopped there, while everything around the
  canvas — the label row, the helper text, the validation feedback, the `?` mark that opens it — is
  drawn by `ng-hub-ui-forms`, whose sheet nothing told you to load. A reader following the README
  alone got a correct canvas surrounded by unstyled body text and an empty button where the mark
  should be, with no error anywhere to explain it. The warning existed only in `MIGRATION.md`, which
  a new consumer has no reason to open, and the documentation site hides the gap because it loads
  both sheets globally. Both READMEs now carry the `@use` lines — the forms sheet, plus the utils
  tooltip sheet for `formTextType="tooltip"`, whose bubble is appended to `<body>` out of that
  sheet's reach — and `ng-hub-ui-utils` joins the install line it was already a peer of.

- **`BREAKING_CHANGES.md` covers 22.5.0 and 22.6.0.** The newest section was 22.4.0 while the
  library was on 22.6.1, and both releases in between asked the consumer to do something: 22.5.0 to
  delete the invalid-state override the migration guide used to recommend, which now collides with
  the component's own rule at equal specificity and can stop applying in a production build while
  still working in the dev server; 22.6.0 to raise the `ng-hub-ui-forms` floor to 22.31.0, without
  which the application no longer compiles. In a family whose major tracks Angular, that file is the
  only warning a breaking change can give, and it said nothing.

## [22.6.1] - 2026-09-03

### Fixed

- **Server-side rendering no longer throws.** `writeValue()` repaints the canvas, and it runs
  whenever a reactive form binds a value — including during prerendering, where the server DOM
  shim *throws* `NotYetImplemented` from `canvas.getContext('2d')` instead of returning null, so
  the existing null check never got the chance to run. Measured on the documentation site, this
  produced 16 errors per full prerender. `redraw()` now returns early outside the browser.

    Nothing is lost by skipping it: the canvas has no pixels on the server, and the existing
  `afterNextRender` hook already repaints as soon as it does. No API, type or style changes.

## [22.6.0] - 2026-09-02

### Added

- **`formTextType="tooltip"` works here too.** `ng-hub-ui-forms` 22.31.0 moved `formText` and
  `formTextType` onto `HubFieldControl`, the base class this component extends, so the input
  arrived here for free — and did nothing, because the template rendered the helper block
  unconditionally and drew no question mark. The compiler accepted `formTextType="tooltip"` on a
  `<hub-signature>` and the page ignored it, which is the worst shape a gap can take.

  The mark now sits in a `.hub-field__label-row` beside the label rather than inside it. That is
  not decoration: clicking this label focuses the drawing surface, so a button nested in it would
  open the tooltip and put the pen in the reader's hand at once.

### Fixed

- **The component compiles against `ng-hub-ui-forms` 22.31.0.** It declared its own `formText`,
  which the base class now declares too, and TypeScript refuses the redeclaration without an
  `override` modifier (TS4114). The local declaration is deleted rather than annotated — the base
  one is identical, and two declarations of one input is how they drift.

## [22.5.0] - 2026-09-01

### Fixed

- **`[labelType]` is read.** It was declared, compiled, type-checked and never looked at: the template toggled only `--readonly`, `--disabled`, `--invalid` and `--valid`, so a team migrating a horizontal form bound the input, saw a stacked label, and went hunting through `ng-hub-ui-forms` for a bug that was not there. `horizontal` now places the label in a first grid column beside the drawing surface — capped and ellipsized at `--hub-form-label-horizontal-max-width` — with the action row, helper text and validation feedback stacked in the second, which is the shape the sibling fields produce.

  The layout lives in this component's own stylesheet under `.hub-signature--horizontal` rather than borrowing `.hub-field--horizontal` from the forms sheet. That grid places `> .hub-field__label` and `> .hub-field__body`, neither of which this template has, and both sheets would then set `gap` on the same element at identical specificity — a race decided by stylesheet injection order, which is not stable between the dev server and a production build. The same `--hub-form-*` tokens are honoured, so the result lines up with the fields around it.

  **`floating` still falls back to `stacked`, deliberately.** A floating label reuses the space an empty text control's value would occupy and is driven by `:placeholder-shown`; a canvas has neither, and a label parked inside the box would sit on top of the ink the moment anyone signed. The family's other non-text fields — `hub-slider`, `hub-segmented`, `hub-otp-input` — take the same position while still accepting the shared `HubLabelType`.

- **The validation state shows on the drawing surface.** `.hub-signature--invalid` and `.hub-signature--valid` were bound on the root and styled by nothing, so a required-but-empty signature printed an error message under a canvas that looked exactly like a valid one. Every other field of the family turns red; this one did not, and on a long form the message scrolls out of view leaving a submit button that refuses to work for no visible reason. The canvas now takes the danger border and ring when touched and invalid, and the success pair when `[showValid]` is on and the field is touched and valid.

  The colours come from the shared `--hub-form-invalid-*` / `--hub-form-valid-*` contract rather than new `--hub-signature-*` slots, because that is where the family keeps validation — `_field.scss` styles `.hub-field__control--invalid` from exactly these tokens, and a signature-only slot would fragment a decision that belongs to the form.

  **If you wrote the workaround the migration guide used to recommend, delete it.** Your rule and the component's now have identical specificity, so which wins is decided by injection order: a customised colour can silently stop applying in a production build while still working in the dev server. Set `--hub-form-invalid-border-color` instead.

### Added

- **A live theming demo on the library page**, exercising all eleven `--hub-signature-*` slots through `hub-signature-theme()`. The mixin had shipped since 22.0.0 with nothing to look at, so its six newest parameters could only be read about.

  Building it surfaced a trap now documented in `MIGRATION.md`: **setting the tokens on a wrapper element does nothing.** The component declares all eleven slots on the field element itself through `:where(.hub-signature)`, and a value declared on an element always beats one inherited from an ancestor — specificity never enters into it, because they are different elements. This is precisely why the mixin emits `<your scope> :where(.hub-signature)` rather than relying on inheritance, and it also means a rule written inside a component with emulated view encapsulation never matches, since Angular rewrites it with an `_ngcontent` attribute the field's DOM does not carry.

## [22.4.0] - 2026-09-01

### Fixed

- **The visible label now names the drawing surface.** The template rendered `<label for>` pointing at the canvas, and `for` associates only with labelable elements — `button`, `input`, `meter`, `output`, `progress`, `select`, `textarea`. A `<canvas>` is none of them, so the attribute was inert: no association existed, clicking the label did nothing, and the accessible name came entirely from `[ariaLabel]`. The surface is now named with `aria-labelledby`, the only mechanism that works on a non-labelable element and the only one unaffected by `role="application"`.

  The `for` attribute is gone rather than left beside the new wiring, because an attribute that claims an association the browser never makes is worse than no attribute at all. Clicking the label focuses the surface instead, which is the half of the label contract that was actually missing.

  `aria-labelledby` and `aria-label` are now mutually exclusive on the canvas. They are not additive: `aria-labelledby` outranks `aria-label` outright in the accessible-name computation, so emitting both would leave one of them permanently unreachable and mislead anyone reading the DOM. A field with a `[label]` carries only `aria-labelledby`; a field without one carries only `aria-label`. The required asterisk stays `aria-hidden` and out of the computed name.

- **`[ariaLabel]` goes through the translation dictionary.** It was an `input<string>('Signature')` with a hardcoded English literal and no `HUBUI.SIGNATURE.*` key behind it, so an application that localized every button through the shared adapter still had its drawing surface announce itself in English. It now resolves like every other piece of text the component owns: the explicit input first, then `[labels]` / `provideHubSignature()`, then `HUBUI.SIGNATURE.ARIA_LABEL`, then the English fallback.

  Its default changed from `'Signature'` to `''` so that "not set" is distinguishable from "set to the old default"; the resolved name is still `Signature` when nothing else supplies one.

### Changed

- **The accessible name comes from `[label]` when there is one, and `[ariaLabel]` is the fallback for a bare surface.** This is the part that actually closes WCAG 2.5.3 (Label in Name): translating `[ariaLabel]` would merely have made it *possible* to keep the visible label and the announced name in agreement, still requiring every consumer to pass the same string twice on every field and to remember it forever. Deriving the name from the label makes disagreement impossible — they are the same node. `[ariaLabel]` is now consulted only where there is genuinely nothing to point at: a surface with no visible label, in a layout that labels it some other way.

  **Binding `[ariaLabel]` on a field that also has a `[label]` no longer does anything.** Remove those bindings rather than leaving a setting that looks live and is not.

- **`HubSignatureLabels` and `HubSignatureResolvedLabels` gained a required `ariaLabel` member.** Everything the library accepts takes a `Partial<…>`, so overrides are unaffected; only a fully annotated label object has to change. **Breaking**; see `BREAKING_CHANGES.md`.

## [22.3.0] - 2026-09-01

### Added

- **A keyboard path to sign.** The canvas has carried `tabindex="0"` since 22.0.0 and bound nothing but pointer events, so the field was focusable and unusable: a required control no keyboard-only user could satisfy, under a package description promising an accessible signature field. Arrow keys now carry a visible pen across the surface — Shift for a coarser step — Space or Enter lower and lift it, and Escape abandons the stroke in progress. It is not a second class of stroke: the keyboard goes through the same internal begin/commit pair the pointer does, so it yields the same `HubSignatureStroke`, the same `toSvg()` output and the same reported value.

  The interaction is modal — put the pen down, move, lift — rather than hold-a-key-to-draw, because key repeat is throttled by the operating system (points would be sampled at a rate the library does not control) and holding one key while pressing another is beyond many of the motor abilities this path exists to serve.

  The surface now carries `role="application"`, and that is load-bearing rather than decorative. A canvas with `tabindex` is not a form control, so NVDA and JAWS stay in browse mode over it and consume the arrow keys for document navigation; without the role the whole path would work in code and never reach the people it is for. How to sign is announced through `aria-describedby` from the new `keyboardHint` label, so the instructions travel through the same dictionary as the action buttons, under `HUBUI.SIGNATURE.KEYBOARD_HINT`.

- **`[validFeedback]` is rendered.** The input has existed on `HubFieldControl` all along, so it compiled and type-checked on `<hub-signature>` and then did nothing at all. It now renders the same `.hub-field__feedback--valid` block as every other field of the family, under the same `showsValid` condition. An input that is accepted and ignored is worse than one that does not exist: it sends someone hunting through `ng-hub-ui-forms` for a bug that is not there.

- **`hub-signature-theme()` reaches all eleven tokens.** It accepted five parameters against the eleven `--hub-signature-*` custom properties the component declares, so border width, focus shadow, font size, label colour, label font size and action gap could only be written by hand. The six missing parameters are appended after the original five rather than slotted in where they belong by meaning, so that existing positional includes keep resolving to the same tokens. An argument-less include still emits nothing — every declaration is guarded — but it now says so with a `@warn` instead of leaving a developer to debug a build that is behaving as designed.

### Fixed

- **`pointercancel` no longer commits the partial stroke.** It was wired to the same handler as `pointerup`, so a cancelled pointer — an OS gesture taking over, a scroll claiming the pointer, palm rejection on a tablet — was treated as a deliberate pen-up: the half-drawn stroke was pushed onto the history, reported to the form and announced through `(drawEnd)`. `pointercancel` means the interaction did not happen, so the stroke is now discarded: no value change, no `(drawEnd)`. Losing focus mid-stroke takes the same path, because a stroke you can no longer reach cannot be finished.

- **The default `currentColor` ink is resolved before it is captured.** `[strokeColor]` defaults to `'currentColor'` and that string was used twice without ever being resolved. The canvas 2D context cannot parse CSS-context keywords, so the assignment was dropped and the ink fell back to black whatever the colour around the field; worse, the same literal was written verbatim into the persisted SVG, leaving an archived signature with no fixed colour at all — invisible ink in a dark-themed viewer, an unexpected colour in a PDF whose preview looked right. The colour is now resolved against the surface with `getComputedStyle()` when the stroke opens, so what is stored is what the signer saw. An explicitly bound colour is stored untouched. This is also what finally makes `hub-signature-theme($color: …)` reach the ink, as its own documentation has claimed since 22.0.0.

### Changed

- **`(drawStart)` and `(drawEnd)` now emit `HubSignatureDrawEvent`**, a `PointerEvent | KeyboardEvent` union exported from the public API. Drawing is no longer pointer-exclusive, and a payload typed `PointerEvent` would encode exactly the assumption this release removes. **Breaking**; see `BREAKING_CHANGES.md`.

- **`HubSignatureLabels` and `HubSignatureResolvedLabels` gained a required `keyboardHint` member.** Every input and provider that accepts them takes a `Partial<…>`, so overriding a subset of labels is unaffected; only code that builds a complete label object has to add the key. **Breaking**; see `BREAKING_CHANGES.md`.

## [22.2.0] - 2026-09-01

### Added

- **`isEmpty()`**, so a form can validate the field without parsing the serialized value. Previously the only way to know whether anything had been drawn was to inspect the SVG string.
- **`toStrokes()` / `fromStrokes()`**, exposing the committed strokes as structured `HubSignatureStroke[]`. `toSvg()` remains the canonical form value — this is for callers that need the geometry itself, such as replaying a signature or migrating from a library that stored point groups. `fromStrokes()` is a programmatic write: like `writeValue()`, it repaints without reporting a user change to Angular forms.

  They are deliberately not called `toData` / `fromData`, the names angular2-signaturepad uses: that library's `toData()` returns `Array<Array<{x, y, time}>>` and this one returns `{points: [{x, y, pressure}], color, width}[]`. Same name with an incompatible payload would let a migration compile and then fail silently wherever the value is typed `any`.
- **`(drawStart)` and `(drawEnd)` outputs**, emitted around a user stroke. They fill the gap left by libraries that exposed `onBeginEvent` / `onEndEvent`, and let a host react to drawing activity — enabling a submit button, pausing an autosave — without polling the value.

### Changed

- **The `hub-signature-theme()` mixin now documents itself where the tooling can read it.** Its header was written as a `/** … */` block, and the documentation generator only parses `//` headers delimited by `scss-docs-start` / `scss-docs-end` markers — so the mixin was skipped outright and the library's page showed no theming section at all, despite the mixin having shipped since 22.0.0. The header is now in the format the generator reads, and the eleven `--hub-signature-*` slots it covers appear on the site. Comment-only: the mixin's parameters, defaults and emitted declarations are byte-identical.

## [22.1.1] - 2026-08-17

### Fixed

- **The published package declared no licence.** An absent `license` field is not neutral — a registry reports it as unlicensed, which legally reads as all rights reserved, the most restrictive state possible rather than the most open. The intent was always MIT; it is now stated in `package.json` and carried in a `LICENSE` file that ships with the package.

## [22.1.0] - 2026-08-14

### Fixed

- **The field now really inherits the `ng-hub-ui-forms` contract.** The `--hub-signature-*` slots defaulted to a `--hub-field-*` family that no library declares and the token spec never documented, so they always fell through to their `sys`/`ref` fallbacks: a form themed with `--hub-input-bg` left its signature field untouched, contrary to what the README promised. The slots now read the canonical tokens of the `.hub-field__*` shell — `--hub-input-*` for the drawing surface, `--hub-label-*` for the label and `--hub-form-disabled-opacity` for the disabled state. Apps that were setting `--hub-field-*` to reach this component must switch to those names; apps theming through `--hub-signature-*` or `hub-signature-theme()` are unaffected.

### Added

- The eleven `--hub-signature-*` tokens are documented in the design-system token spec, so they now appear in the library reference table.

## [22.0.0] - 2026-08-14

### Added

- `HubSignatureComponent`, an SVG-backed freehand signature field with Pointer Events, ControlValueAccessor integration, undo, redo, clear and PNG export.
- Form-field visual tokens and `hub-signature-theme()` Sass mixin aligned with `ng-hub-ui-forms`.
- Localizable action labels under the collision-safe `HUBUI.SIGNATURE.ACTION.*` namespace, supplied through the shared `provideHubTranslationAdapter()` provider from `ng-hub-ui-utils` and optionally mapped with explicit reactive overrides.
