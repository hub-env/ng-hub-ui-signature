# ng-hub-ui-signature

SVG-backed signature field for Angular forms. It records mouse, touch and pen input through Pointer Events — or arrow keys and Space, for signing without a pointer — stores a scalable SVG in the form model and can export the rendered canvas as PNG.

## Migrating from angular2-signaturepad

`angular2-signaturepad` last published in February 2022. **[Read the migration guide](./MIGRATION.md)** — it maps the full API, shows working code, and states plainly what does not carry over: signatures stored as PNG data URLs cannot be reloaded for editing, and a stored SVG only reloads faithfully into a field rendered at the same width.

## Install

```bash
npm install ng-hub-ui-signature ng-hub-ui-forms ng-hub-ui-utils
```

Then load the forms stylesheet once, in the application's global styles. The field's root element is
`class="hub-field hub-signature"` and the chrome around the canvas — the label row, the helper text,
the validation feedback and the `?` mark that opens it — is defined in `ng-hub-ui-forms`, not in the
signature's own sheet. Without this line the canvas looks right and everything around it does not:
helper text and errors fall back to unstyled body text, and the `?` mark, whose glyph and circle both
come from that sheet, is left as an empty button with nothing in it.

```scss
// styles.scss
@use 'ng-hub-ui-forms/styles';

// Only if you use formTextType="tooltip": the bubble is appended to <body>, out of reach of
// anything the sheet above declares.
@use 'ng-hub-ui-utils/styles/tooltip';
```

`@use 'ng-hub-ui-signature/styles'` replaces neither: that entry point forwards the theming mixin
described below and emits no chrome at all.

## Usage

```typescript
import { HubSignatureComponent } from 'ng-hub-ui-signature';

@Component({
	standalone: true,
	imports: [HubSignatureComponent],
	template: `<hub-signature formControlName="signature" label="Signature" />`
})
export class ContractFormComponent {}
```

The form control value is an SVG string. Use `toDataUrl('image/png')` for bitmap export, or `clear()`, `undo()` and `redo()` to control the field programmatically.

## Inputs

| Input | Type | Default | What it does |
| --- | --- | --- | --- |
| `label` | `string` | `''` | Visible label, and the accessible name of the surface. See [How the field is named](#how-the-field-is-named). |
| `labelType` | `HubLabelType` | `'stacked'` | `'horizontal'` puts the label in a first column beside the surface. `'floating'` falls back to stacked. |
| `formText` | `string` | `''` | Helper text. A projected `<ng-template hubFormText>` replaces it with markup. |
| `formTextType` | `'bottom' \| 'tooltip'` | `'bottom'` | Where the helper text goes: under the surface, or behind a `?` at the end of the label row. |
| `height` | `number` | `160` | Logical surface height in CSS pixels. Live: the bitmap and the stored `viewBox` follow it. |
| `strokeColor` | `string` | `'currentColor'` | Ink recorded in new strokes, resolved to a concrete colour before capture. |
| `strokeWidth` | `number` | `2` | Base width recorded in new strokes. |
| `readonly` | `boolean` | `false` | Keeps the signature readable and focusable, refuses new strokes. |
| `controls` | `boolean` | `true` | Shows the built-in clear / undo / redo row. |
| `ariaLabel` | `string` | `''` | Accessible name for a surface with **no** visible `[label]`; ignored when there is one. |
| `labels` | `Partial<HubSignatureLabels>` | `{}` | Per-field override of the translated action labels. |
| `classlist` | `string` | `''` | Extra classes on the host element, `<hub-signature>` itself — not on the canvas. |
| `formControlName` | `string` | — | Name of the control in the surrounding form group. `ReactiveFormsModule` still has to be imported. |
| `required` | `boolean \| null` | `null` | Two-way. Derived from the control's validators on a reactive binding, so set it by hand only elsewhere. |
| `disabled` | `boolean` | `false` | Two-way, and written by `setDisabledState()`. On a reactive field prefer `control.disable()`. |
| `showValid` | `boolean` | `false` | Opt-in success state; defaults to the global `provideHubForms({ showValid })`. |
| `validFeedback` | `string \| null` | `null` | Success message, shown only while `[showValid]` is on and the field is touched and valid. |
| `invalidFeedbackTemplateFn` | `((key: string, value: any) => string) \| null` | `null` | Per-field override of the error-message builder. |

`height`, `strokeColor` and `strokeWidth` describe the surface and the pen; the last six are
inherited from the `ng-hub-ui-forms` field contract, which is why they behave exactly as they do on
`hub-input`.

## Asking what the field holds

`toSvg()` is the form value, and for a long time it was also the only way to ask anything about the
field: whether it had been signed at all meant parsing the string for a path. Three additions answer
that directly.

```ts
@ViewChild(HubSignatureComponent) signature!: HubSignatureComponent;

// Validate without parsing the serialized value.
const signed = !this.signature.isEmpty();

// The geometry itself, which the SVG form value does not carry.
const strokes = this.signature.toStrokes(); // HubSignatureStroke[]
this.other.fromStrokes(strokes);            // repaints; reports no user change to Angular forms
```

`toStrokes()` / `fromStrokes()` are deliberately **not** named `toData` / `fromData`, the names
`angular2-signaturepad` uses. That library's `toData()` returns `Array<Array<{x, y, time}>>` and this
one returns `{ points: [{ x, y, pressure }], color, width }[]`. The same name with an incompatible
payload would let a migration compile and then fail silently wherever the value is typed `any`.

## Reacting while the user draws

| Output | Payload | Emitted |
| --- | --- | --- |
| `valueChange` | `string` | After a user-originated change, carrying the SVG |
| `drawStart` | `HubSignatureDrawEvent` | When a stroke begins |
| `drawEnd` | `HubSignatureDrawEvent` | When a stroke is finished and committed |

`drawStart` and `drawEnd` let a host react to drawing activity — pausing an autosave, arming a submit
button — without polling the value. They fire for user drawing only, so a programmatic write never
looks like one, and a stroke that was cancelled rather than finished emits no `drawEnd` at all.

`HubSignatureDrawEvent` is `PointerEvent | KeyboardEvent`, because a stroke can be written either
way. Narrow with `instanceof` when the input device matters.

## Signing with the keyboard

The field is operable without a pointer. With the surface focused:

| Keys | Effect |
| --- | --- |
| Arrow keys | Move the pen; hold Shift for a coarser step |
| Space or Enter | Lower the pen, and lower it again to lift and commit the stroke |
| Escape | Discard the stroke in progress |

The resulting stroke is an ordinary one: same `HubSignatureStroke`, same `toSvg()` output, same
reported value, same `drawStart` / `drawEnd`. It obeys `readonly` and `disabled` like the pointer
path, and the instructions are announced to assistive technology through `aria-describedby` —
translate them under `HUBUI.SIGNATURE.KEYBOARD_HINT`.

The canvas carries `role="application"` so screen readers hand it the arrow keys instead of using
them to navigate the document. Bear in mind that a keyboard signature is a polyline, not
handwriting; decide deliberately whether that satisfies what your signature is evidence of.

## How the field is named

`[label]` is the accessible name. The drawing surface is wired to it with `aria-labelledby`, so the
text a sighted user reads and the text a screen reader announces are the same node and cannot drift
apart. Translating `[label]` translates the announcement; there is nothing to bind twice. Clicking
the label focuses the surface.

```html
<hub-signature [label]="'CONSENT.SIGNATURE' | transloco" />
```

`[ariaLabel]` names a surface that has **no** visible label — a bare box in a layout that labels it
some other way. On a field that has a `[label]` it is not consulted at all, so don't bind it there.
Left empty it resolves like the action labels: `[labels]` / `provideHubSignature()`, then
`HUBUI.SIGNATURE.ARIA_LABEL`, then the English fallback `Signature`.

```html
<hub-signature [controls]="false" [ariaLabel]="'CONSENT.SIGNATURE' | transloco" />
```

`<label for>` is deliberately not used: `for` associates only with labelable elements — `button`,
`input`, `meter`, `output`, `progress`, `select`, `textarea` — and a `<canvas>` is none of them, so
the attribute would sit in the markup claiming an association the browser never makes.

## Localized actions

The component is translation-framework agnostic. Configure the shared Hub UI adapter once at application bootstrap; it supplies one dictionary to every compatible Hub UI library, including Signature. Use `labels` only for a one-field exception:

```ts
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { provideHubTranslationAdapter } from 'ng-hub-ui-utils';

bootstrapApplication(AppComponent, {
	providers: [
		provideHubTranslationAdapter(() => {
			const transloco = inject(TranslocoService);
			return {
				dictionary: transloco.selectTranslation('HUBUI'),
				namespace: 'HUBUI'
			};
		})
	]
});
```

Add `HUBUI.SIGNATURE.ACTION.CLEAR`, `HUBUI.SIGNATURE.ACTION.UNDO` and `HUBUI.SIGNATURE.ACTION.REDO` to the application's normal language files. The `HUBUI` root prevents collisions with application keys. The adapter updates every Signature field when the service emits a language change; `overrides` can deliberately map an individual action to a different reactive service key. See the Utils documentation for the complete Transloco and ngx-translate setup.

```ts
// One exceptional field can still override a global label.
<hub-signature [labels]="{ clear: 'Erase signature' }" />
```

## Theming

Every field surface is customizable with `--hub-signature-*` variables. The defaults inherit the field contract of `ng-hub-ui-forms` — the drawing surface reads the `--hub-input-*` control tokens, the label reads `--hub-label-*` and the disabled state reads `--hub-form-disabled-opacity` — so theming a form themes its signature field too, with no extra rules.

```scss
@use 'ng-hub-ui-signature/styles' as hub;

.contract-form {
	@include hub.hub-signature-theme($border-radius: 0.75rem);
}
```

Validation is part of that inheritance: the invalid and valid states colour the drawing surface
from `--hub-form-invalid-*` and `--hub-form-valid-*`, so a signature turns red beside the inputs
around it rather than printing a message under a canvas that still looks fine.

**Setting the variables on a wrapper does nothing.** The component declares all eleven slots on the
field element itself, and a custom property declared on an element always beats one inherited from
an ancestor — specificity does not come into it, because they are different elements. Target the
field, which is what the mixin does for you:

```scss
/* Does nothing: the field overrides this on itself. */
.contract-form {
	--hub-signature-bg: #0f172a;
}

/* Works — and is what @include hub-signature-theme() emits. */
.contract-form .hub-signature {
	--hub-signature-bg: #0f172a;
}
```

The same catch applies inside a component with emulated view encapsulation: Angular rewrites the
rule with that component's `_ngcontent` attribute, which the field's DOM does not carry. Theme from
a global stylesheet, or use `ViewEncapsulation.None`.
