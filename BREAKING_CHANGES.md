# Breaking Changes

This file documents breaking changes and migration steps for `ng-hub-ui-signature`.

> The major version of this library tracks the Angular major it targets, not semver's verdict on
> compatibility. A breaking change therefore ships as a **minor**, and this file is the only warning
> you get — read it before upgrading within a major line.

## [22.8.0]

### The stylesheet no longer reaches outside the field

**What changed.** `<hub-signature>` dropped `ViewEncapsulation.None`. Every rule it emits now
carries the component's own marker attribute, so `.hub-signature__canvas` ships as
`.hub-signature__canvas[_ngcontent-…]`. Not one selector in the sheet had to be rewritten: they all
name elements the component's own template draws.

**Why.** An unencapsulated stylesheet is published into the application's global cascade, where it
competes with rules the library never sees and cannot be removed by anyone who did not know it was
there. `CODING_RULES.md` allows four reasons for that and this field had none of them.

**What you have to do.** Nothing, unless you have a rule of your own aimed at the field's internals.
Two cases change, and neither reports itself:

- A rule that reached an inner element by adding a single class — `.contract-panel
  .hub-signature__canvas { … }` — now ties with the library at (0,2,0) instead of beating it at
  (0,2,0) against (0,1,0), and loses on source order, because component styles are injected after
  the stylesheet your application ships. Add another level, or move the change into the tokens.
- Markup of your own carrying the library's class names is no longer painted by them.

Theming through the tokens is unaffected, which is the route `MIGRATION.md` has always pointed at:
`.hub-signature` is the field's root element, your global stylesheet matches it as it always did,
and `hub-signature-theme()` emits exactly that selector.

**If you do nothing.** The field renders as it always has. Only a stylesheet of yours that reached
into its internals is affected, and it fails by having no effect — nothing warns, so check any rule
you wrote against a `.hub-signature__*` class.

## [22.6.0]

### `ng-hub-ui-forms` must be at least 22.31.0

**What changed.** The component stopped declaring its own `formText` and inherits it from
`HubFieldControl`, which only carries it since `ng-hub-ui-forms` 22.31.0. The helper-text mark
added in the same release reads `formTextType` and `showsFormTextTooltip()` off that same base
class, and the `.hub-field__label-row` it sits in is drawn by that package's stylesheet.

**Why.** TypeScript refuses the redeclaration without an `override` modifier (TS4114), and
annotating it would have kept a second declaration of one input — which is how two declarations
drift apart. The member belongs to the base class.

**What you have to do.** Raise `ng-hub-ui-forms` to `>= 22.31.0` in the same step you take this
package to 22.6.0. npm will not do it for you: the peer range published with 22.6.0 still read
`>= 22.0.0`, so the version already installed satisfies it and nothing is upgraded. Read the
installed forms version yourself; a quiet install is not evidence that the two match.

**If you do nothing.** The build fails on a base-class member that is not there — `Property
'formText' does not exist on type 'HubSignatureComponent'`, or a template type-check error on
`formTextType`. It fails loudly, at build time; nothing ships broken.

## [22.5.0]

### A hand-written invalid-state rule for the canvas now collides with the component's own

**What changed.** The drawing surface takes the error and success colours from the package:
`.hub-signature--invalid .hub-signature__canvas` sets the border from
`--hub-form-invalid-border-color`, with the matching focus ring, and `--valid` does the same from
the success tokens. Up to 22.4.0 both classes were bound on the root and styled by nothing, and
`MIGRATION.md` told you to write that rule yourself.

**Why.** Every other field of the family colours its control when the form rejects it. A
required-but-empty signature printed a message under a canvas that looked exactly like a valid one,
and on a long form that message scrolls out of sight, leaving a submit button that refuses to work
for no visible reason.

**What you have to do.** Delete the workaround and set the token instead — the component reads it,
and a token inherits down to the field:

```scss
/* Before — the exact selector the component now ships, at identical specificity (0,2,0) */
.hub-signature--invalid .hub-signature__canvas {
	border-color: #b91c1c;
}

/* After */
.contract-form {
	--hub-form-invalid-border-color: #b91c1c;
}
```

**If you do nothing.** Nothing errors, and that is the problem. Two rules matching the same element
at the same specificity are decided by document order, which here means stylesheet injection order
— not stable between the dev server and a production build. If your colours happened to match the
tokens you will never notice; if you customised them, the override can work in development and
silently stop applying in production.

## [22.4.0]

### `[ariaLabel]` is ignored on a field that has a `[label]`

**What changed.** The drawing surface is now named by `aria-labelledby` pointing at the visible
label. `aria-labelledby` outranks `aria-label` in the accessible-name computation, so the component
emits one or the other, never both: with a `[label]` you get `aria-labelledby` and no `aria-label`
at all, and `[ariaLabel]` is not consulted.

**Why.** The visible label and the accessible name could disagree, and routinely did — a Spanish
form showing "Firma del titular" announced "Signature". That is a WCAG 2.5.3 (Label in Name)
failure. Making the label *be* the name removes the possibility rather than asking every consumer
to keep two strings in sync forever.

**What you have to do.** Delete `[ariaLabel]` from every field that also has a `[label]`. Nothing
breaks if you leave it — the binding is simply inert — but it reads as a live setting and is not.

```html
<!-- Before -->
<hub-signature [label]="'CONSENT.SIGNATURE' | transloco" [ariaLabel]="'CONSENT.SIGNATURE' | transloco" />

<!-- After: the label is the accessible name -->
<hub-signature [label]="'CONSENT.SIGNATURE' | transloco" />
```

Keep `[ariaLabel]` only on a surface with no visible label. There it is now translatable, resolving
through `[labels]` / `provideHubSignature()`, then `HUBUI.SIGNATURE.ARIA_LABEL`, then the English
fallback.

**If you do nothing.** Names get *better*, not worse: a field whose `[label]` was translated and
whose `[ariaLabel]` was not now announces the translated text. The only cost is a dead binding left
in your templates.

### `[ariaLabel]` defaults to `''` instead of `'Signature'`

**What changed.** The input's default is the empty string, which is how the component tells "not
set" from "set to the old default" before falling through to the dictionary.

**Why.** With a hardcoded `'Signature'` default there was no way to distinguish a caller who wanted
that exact literal from one who had never touched the input, so the translation chain could never
run.

**What you have to do.** Nothing, unless you read `signature.ariaLabel()` off a component instance
and expected `'Signature'` back. The *rendered* name is unchanged: with nothing else supplying one,
the fallback is still `Signature`.

**If you do nothing.** No visible change. The type is still `string`.

### `HubSignatureLabels` gained a required `ariaLabel`

**What changed.** `HubSignatureLabels` and `HubSignatureResolvedLabels` now declare a fifth member,
`ariaLabel`, holding the accessible name used when no visible label exists.

**Why.** Same reason `keyboardHint` was added in 22.3.0: the text is user-facing, so it belongs in
the localizable surface rather than hardcoded in the template. Its key is
`HUBUI.SIGNATURE.ARIA_LABEL`.

**What you have to do.** Nothing for overrides — `provideHubSignature({ labels: … })` and the
`[labels]` input both take `Partial<HubSignatureLabels>`. Only code annotating a complete object
breaks; type it as a partial, which is what the library consumes.

**If you do nothing.** Overrides keep working. A fully annotated label object fails to compile.

## [22.3.0]

### `(drawStart)` and `(drawEnd)` emit `HubSignatureDrawEvent`, not `PointerEvent`

**What changed.** Both outputs are now typed `output<HubSignatureDrawEvent>`, where:

```ts
export type HubSignatureDrawEvent = PointerEvent | KeyboardEvent;
```

**Why.** This release adds a keyboard path to sign, and it emits the same two outputs — a stroke is
a stroke however it was written. A payload typed `PointerEvent` would have left two bad options:
lie about the event, or emit nothing on the keyboard path and leave hosts unable to tell that a
signature was being drawn at all. The type now says what the outputs actually carry.

The union was chosen over a wrapper object (`{ source, originalEvent }`) deliberately: the wrapper
would be a larger break for the same information, and `instanceof` is the idiomatic way to ask.

**What you have to do.** Nothing, if your handler ignores its argument or takes `any` — which
covers most uses, since these outputs are usually consumed as "drawing started" / "drawing
finished" notifications. If you typed the parameter, widen it:

```ts
// Before
drawComplete(event: PointerEvent): void { … }

// After
drawComplete(event: HubSignatureDrawEvent): void { … }
```

If you read pointer-specific members, narrow first:

```ts
import type { HubSignatureDrawEvent } from 'ng-hub-ui-signature';

drawStart(event: HubSignatureDrawEvent): void {
  if (event instanceof PointerEvent) {
    console.log(event.pointerType); // 'mouse' | 'pen' | 'touch'
  }
}
```

**If you do nothing.** The compiler catches it: a template binding to a handler declaring
`PointerEvent` fails type-check under `strictTemplates`. There is no silent-failure path here.

### `(drawEnd)` no longer fires on `pointercancel`

**What changed.** A cancelled pointer used to be treated as a pen-up: the partial stroke was
committed, the form value updated and `(drawEnd)` emitted. It is now discarded, and neither
`(drawEnd)` nor `(valueChange)` fires. Losing focus mid-stroke behaves the same way.

**Why.** `pointercancel` means the interaction did not happen — an OS gesture took over, a scroll
claimed the pointer, palm rejection fired on a tablet. Committing it saved marks the user never
intended to make, and satisfied a `Validators.required` signature gate with them.

**What you have to do.** Nothing, unless you relied on `(drawEnd)` as a "the pointer went away"
signal rather than as "a stroke was committed". If you counted strokes by counting `drawEnd`
emissions, the count is now correct where it used to over-count.

**If you do nothing.** Nothing breaks at compile time. A tablet flow that quietly accumulated
palm-contact strokes stops doing so.

### `HubSignatureLabels` gained a required `keyboardHint`

**What changed.** `HubSignatureLabels` and `HubSignatureResolvedLabels` now declare a fourth
member, `keyboardHint`, holding the instructions read out to assistive technology.

**Why.** The keyboard interaction has to be announced, and that text is user-facing, so it belongs
in the same localizable surface as the action buttons rather than hardcoded in the template. Its
dictionary key is `HUBUI.SIGNATURE.KEYBOARD_HINT`.

**What you have to do.** Nothing for overrides: `provideHubSignature({ labels: … })` and the
`[labels]` input both take `Partial<HubSignatureLabels>`, so passing a subset still compiles. Only
code that annotates a complete object breaks:

```ts
// Before — now missing a member
const labels: HubSignatureLabels = { clear: '…', undo: '…', redo: '…' };

// After — either add the key, or type it as a partial, which is what the library consumes
const labels: Partial<HubSignatureLabels> = { clear: '…', undo: '…', redo: '…' };
```

Applications that localize through `provideHubTranslationAdapter()` should add
`HUBUI.SIGNATURE.KEYBOARD_HINT` to every language file. Omitting it is safe — the English default
is used — but then a keyboard user is told how to sign in the wrong language.

**If you do nothing.** Overrides keep working. A fully-annotated label object fails to compile.

## [22.0.0]

Initial release. No breaking changes.

The major version starts at `22` to match the rest of the `ng-hub-ui` family, whose
major always tracks the targeted Angular major — it does not imply twenty-one earlier
releases of this library.
