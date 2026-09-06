# Functionalities of Signature Library

This table details the functionalities of the `ng-hub-ui-signature` library and indicates which ones are covered by interactive examples.

## Signature (`hub-signature`)

| Category              | Functionality                                                  | Example Covered |
| :-------------------- | :------------------------------------------------------------- | :-------------: |
| **Capture**           | Pointer input (mouse, touch, pen)                              |       [x]       |
|                       | Keyboard input (arrows carry the pen, Space/Enter, Escape)     |       [x]       |
|                       | Escape discards the stroke in progress                         |       [x]       |
|                       | `pointercancel` discards it too — not demoable in a page       |       [ ]       |
|                       | ~~Pressure-aware stroke width~~ — not supported, see below     |       n/a       |
|                       | `readonly` — preserves the signature, refuses new strokes      |       [x]       |
|                       | `disabled` — refuses strokes and disables the action row       |       [ ]       |
|                       | `height` — re-measures and repaints while bound                |       [x]       |
|                       | `strokeColor`, `strokeWidth` — the pen, stored on each stroke  |       [x]       |
|                       | `currentColor` resolved against the surface before capture     |       [ ]       |
| **History**           | `undo()` / `redo()`                                            |       [x]       |
|                       | `clear()`                                                      |       [x]       |
|                       | Built-in action bar (`controls`)                               |       [x]       |
| **Form integration**  | `ControlValueAccessor` (SVG string as the form value)          |       [x]       |
|                       | `formControlName` — the field inside a reactive form group     |       [x]       |
|                       | `writeValue()` repaints without reporting a user change        |       [ ]       |
|                       | `isEmpty()` — validate without parsing the serialized value    |       [x]       |
| **Reading the field** | `toSvg()` — the canonical form value                           |       [ ]       |
|                       | `toDataUrl(type?)` — bitmap export, PNG by default             |       [ ]       |
|                       | `toStrokes()` — the committed strokes as structured geometry   |       [x]       |
|                       | `fromStrokes()` — programmatic repaint from that geometry      |       [x]       |
| **Events**            | `(valueChange)` — the SVG after a user-originated change       |       [x]       |
|                       | `(drawStart)` / `(drawEnd)` — the drawing lifecycle            |       [x]       |
| **Validation**        | `showValid` — opt-in success state                             |       [x]       |
|                       | `validFeedback` — success message under the field              |       [x]       |
|                       | `required` derived from the control's validators               |       [x]       |
|                       | Invalid / valid border and ring on the drawing surface         |       [x]       |
|                       | `invalidFeedbackTemplateFn` — per-field error messages         |       [ ]       |
|                       | `hubValidationError` — the message for one error key           |       [x]       |
| **Labelling**         | `label`, `formText`                                            |       [x]       |
|                       | `formTextType="tooltip"` — the hint behind a question mark     |       [ ]       |
|                       | `hubFormText` — helper text projected as markup                |       [x]       |
|                       | `label` is the accessible name, via `aria-labelledby`          |       [x]       |
|                       | Clicking the label focuses the drawing surface                 |       [x]       |
|                       | `ariaLabel` — names a surface with no visible label            |       [x]       |
|                       | `aria-describedby` keyboard instructions                       |       [ ]       |
|                       | `labelType` — `stacked` and `horizontal`                       |       [x]       |
|                       | `classlist` on the host element                                |       [ ]       |
| **Localization**      | Shared Hub UI label adapter (Transloco, ngx-translate…)        |       [x]       |
|                       | `labels` — per-field override of the translated actions        |       [x]       |
|                       | `keyboardHint` — the translated keyboard instructions          |       [ ]       |
|                       | `ariaLabel` — the translated accessible name                   |       [ ]       |
| **Theming**           | The eleven `--hub-signature-*` slots                           |       [x]       |
|                       | `hub-signature-theme()` mixin                                  |       [x]       |
|                       | Inherits the `ng-hub-ui-forms` token family                    |       [x]       |

Examples live in the documentation site under `src/app/pages/examples/signature/`. Eleven of them:
basic, keyboard signing, reactive form, projected helper text and error message, draw events,
surface and pen, label placement, per-field naming, external translations, the theming mixin, and
the field inheriting a themed form.

**Pressure is captured and then discarded.** `getPoint()` reads `PointerEvent.pressure` onto every
point, and nothing ever reads it back: `redraw()` paints with the constant `stroke.width`,
`serializeHubSignature()` emits only `M`/`L` coordinates, and `parseHubSignature()` hardcodes `0.5`
on the way in. So pressure never reaches the form value, never survives a round trip and never
affects a pixel — it is visible only through `toStrokes()`, and only for strokes drawn in that same
session. The row above used to claim "pressure-aware stroke width" as an uncovered functionality;
it is not uncovered, it does not exist. Variable stroke width would be a feature, not an example.

The examples cover the paths a consumer takes, not every input: `classlist`, `disabled`,
`formTextType="tooltip"`, `toDataUrl()` and `invalidFeedbackTemplateFn` are exercised only in the
API tables.
