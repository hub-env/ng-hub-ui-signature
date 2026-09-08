import {
	afterNextRender,
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	numberAttribute,
	output,
	PLATFORM_ID,
	signal,
	untracked,
	viewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { HubTooltipDirective } from 'ng-hub-ui-utils';
import { HubLabelType, HubLabelTypes } from 'ng-hub-ui-forms';
import { HubFieldControl } from 'ng-hub-ui-forms';
import { HubTranslationService } from 'ng-hub-ui-utils';
import { HubSignatureDrawEvent, HubSignaturePoint, HubSignatureStroke } from '../../models/signature.types';
import { parseHubSignature } from '../../utils/parse-signature-svg';
import { serializeHubSignature } from '../../utils/signature-svg';
import {
	defaultHubSignatureLabels,
	HUB_SIGNATURE_CONFIG,
	HubSignatureLabel,
	HubSignatureLabelSource,
	HubSignatureLabels,
	HubSignatureResolvedLabels
} from '../../signature-config';

/** Where each arrow key carries the keyboard pen. */
const CARET_DIRECTIONS: Record<string, { x: number; y: number }> = {
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 }
};

/** Pen travel per arrow press, in logical pixels. */
const CARET_STEP = 4;

/** Travel while Shift is held, so crossing the surface does not take fifty presses. */
const CARET_COARSE_STEP = 20;

/** Pressure reported for points no device sampled, matching the fallback of `getPoint()`. */
const SYNTHETIC_PRESSURE = 0.5;

/** Keeps the keyboard pen inside the drawing surface. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Freehand-signature form field whose value is a portable SVG document.
 * Drawing coordinates are retained independently from canvas pixels so DPR and
 * responsive resizes never alter the signed stroke geometry.
 */
@Component({
	selector: 'hub-signature',
	standalone: true,
	imports: [NgTemplateOutlet, KeyValuePipe, HubTooltipDirective],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './signature.component.html',
	styleUrl: './signature.component.scss',
	host: { '[class]': 'classlist()', '[class.hub-signature-host]': 'true' }
})
export class HubSignatureComponent extends HubFieldControl {
	protected readonly _labelTypes = HubLabelTypes;
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly config = inject(HUB_SIGNATURE_CONFIG);
	private readonly translationSvc = inject(HubTranslationService, { optional: true });
	private readonly translationSnapshot = this.translationSvc
		? toSignal(this.translationSvc.translationObserver, { initialValue: {} })
		: signal<Record<string, unknown>>({});
	private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
	private readonly strokes = signal<HubSignatureStroke[]>([]);
	private readonly redoStrokes = signal<HubSignatureStroke[]>([]);
	private readonly drawingStroke = signal<HubSignatureStroke | null>(null);
	private readonly logicalWidth = signal(320);

	/** Whether the surface exists yet, so the height effect stays quiet until there is one to resize. */
	private readonly canvasRendered = signal(false);

	/** Keyboard pen position in logical coordinates; null until the surface is first focused. */
	private readonly caret = signal<{ x: number; y: number } | null>(null);

	/** Links the surface to its keyboard instructions through `aria-describedby`. */
	protected readonly keyboardHintId = `${this.id}-keyboard`;

	/** Links the surface to its visible label through `aria-labelledby`. */
	protected readonly labelId = `${this.id}-label`;

	/**
	 * Pen marker placement, as percentages of the surface.
	 *
	 * Drawn as a DOM element rather than onto the canvas on purpose: the bitmap is what
	 * `toDataUrl()` exports, and a cursor has no business ending up in an exported signature.
	 */
	protected readonly caretMarker = computed(() => {
		const caret = this.caret();
		return caret && { left: (caret.x / this.logicalWidth()) * 100, top: (caret.y / this.height()) * 100 };
	});

	/** Whether a stroke is being written, which the pen marker reflects. */
	protected readonly penDown = computed(() => this.drawingStroke() !== null);

	/** Label text rendered with the same contract as the other form fields. */
	readonly label = input<string>('');

	/**
	 * Label placement, from the shared forms vocabulary: `stacked` or `horizontal`.
	 *
	 * `floating` falls back to `stacked`, as it does on the family's other non-text fields.
	 * A floating label reuses the space an empty text control's value would occupy, driven by
	 * `:placeholder-shown` — a canvas has neither, and a label parked inside the box would sit
	 * on top of the ink the moment anyone signed.
	 */
	readonly labelType = input<HubLabelType>(this._labelTypes.Stacked);

	/** Logical drawing height in CSS pixels. */
	readonly height = input(160, { transform: numberAttribute });

	/** Stroke colour saved into each SVG path. */
	readonly strokeColor = input<string>('currentColor');

	/** Base stroke width in CSS pixels. */
	readonly strokeWidth = input(2, { transform: numberAttribute });

	/** Prevents drawing while preserving focusable, readable content. */
	readonly readonly = input(false, { transform: booleanAttribute });

	/** Shows the built-in clear / undo / redo action row. */
	readonly controls = input(true, { transform: booleanAttribute });

	/**
	 * Accessible name for a surface with no visible {@link label}.
	 *
	 * A field that has a visible label takes its name from that label, so the two cannot
	 * disagree and this input is not consulted. Left empty it resolves like every other piece of
	 * text the component owns: through `[labels]`, then the application dictionary under
	 * `HUBUI.SIGNATURE.ARIA_LABEL`, then the English fallback.
	 */
	readonly ariaLabel = input<string>('');

	/** Per-instance overrides for the built-in action labels. */
	readonly labels = input<Partial<HubSignatureLabels>>({});

	/** Resolved action text, updated when a reactive translation source emits a new value. */
	protected readonly actionLabels = signal<HubSignatureResolvedLabels>({ ...defaultHubSignatureLabels });

	/** Extra CSS classes applied to the host. */
	readonly classlist = input<string>('');

	/** Emits the canonical SVG after a user-originated change. */
	readonly valueChange = output<string>();

	/** Emits when the user starts a stroke, before any point is committed. */
	readonly drawStart = output<HubSignatureDrawEvent>();

	/** Emits when the user ends a stroke and it has been committed; a cancelled stroke never emits. */
	readonly drawEnd = output<HubSignatureDrawEvent>();

	constructor() {
		super();
		effect((onCleanup) => {
			this.translationSnapshot();
			const labels = { ...this.config.labels, ...this.labels() };
			// The dedicated input is the per-field shortcut into the same slot, so it replaces
			// whatever the shared configuration holds — including a reactive source, which would
			// otherwise overwrite the explicit value the moment it emitted.
			if (this.ariaLabel()) labels.ariaLabel = this.ariaLabel();
			this.actionLabels.set({
				clear: this.getStaticLabel(labels.clear, 'HUBUI.SIGNATURE.ACTION.CLEAR', defaultHubSignatureLabels.clear),
				undo: this.getStaticLabel(labels.undo, 'HUBUI.SIGNATURE.ACTION.UNDO', defaultHubSignatureLabels.undo),
				redo: this.getStaticLabel(labels.redo, 'HUBUI.SIGNATURE.ACTION.REDO', defaultHubSignatureLabels.redo),
				keyboardHint: this.getStaticLabel(
					labels.keyboardHint,
					'HUBUI.SIGNATURE.KEYBOARD_HINT',
					defaultHubSignatureLabels.keyboardHint
				),
				ariaLabel: this.getStaticLabel(
					labels.ariaLabel,
					'HUBUI.SIGNATURE.ARIA_LABEL',
					defaultHubSignatureLabels.ariaLabel
				)
			});

			const subscriptions = (
				Object.entries(labels) as [keyof HubSignatureResolvedLabels, HubSignatureLabel | undefined][]
			)
				.filter(([, value]) => value !== undefined && this.isLabelSource(value))
				.map(([key, source]) =>
					(source as HubSignatureLabelSource).subscribe((value) => {
						this.actionLabels.update((current) => ({ ...current, [key]: value }));
					})
				);
			onCleanup(() => subscriptions.forEach((subscription) => subscription.unsubscribe()));
		});
		// The bitmap geometry lives in JavaScript, so nothing repaints the surface when [height]
		// changes: without this the canvas keeps its old pixels while toSvg() already reports the
		// new viewBox, and the stored signature comes back stretched. The flag is read untracked
		// because the first paint belongs to afterNextRender below, not to this effect.
		effect(() => {
			this.height();
			if (untracked(this.canvasRendered)) this.resizeCanvas();
		});
		afterNextRender(() => {
			this.canvasRendered.set(true);
			this.resizeCanvas();
		});
	}

	/** Returns a fallback while a reactive label source waits for its first translation. */
	private getStaticLabel(label: HubSignatureLabel | undefined, key: string, fallback: string): string {
		if (typeof label === 'string') return label;
		const translation = this.translationSvc?.getTranslation(key);
		return typeof translation === 'string' && translation.length > 0 ? translation : fallback;
	}

	/** Identifies translation streams structurally to avoid a dependency on a specific i18n package. */
	private isLabelSource(label: HubSignatureLabel | undefined): label is HubSignatureLabelSource {
		return label !== undefined && typeof label !== 'string' && typeof label.subscribe === 'function';
	}

	/** Restores form state without reporting it as a user change. */
	writeValue(value: string | null): void {
		this.strokes.set(value ? parseHubSignature(value) : []);
		this.redoStrokes.set([]);
		this.redraw();
	}

	/** Starts a stroke for an active pointer. */
	startStroke(event: PointerEvent): void {
		if (this.disabled() || this.readonly()) return;
		event.preventDefault();
		this.canvas().nativeElement.setPointerCapture(event.pointerId);
		this.beginStroke(this.getPoint(event), event);
	}

	/** Extends the active stroke and paints an immediate visual preview. */
	moveStroke(event: PointerEvent): void {
		const stroke = this.drawingStroke();
		if (!stroke) return;
		event.preventDefault();
		this.drawingStroke.set({ ...stroke, points: [...stroke.points, this.getPoint(event)] });
		this.redraw();
	}

	/** Commits the active stroke when the pointer is lifted. */
	finishStroke(event: PointerEvent): void {
		if (!this.drawingStroke()) return;
		this.releaseCapture(event);
		this.commitStroke(event);
	}

	/**
	 * Throws away the stroke in progress without reporting it.
	 *
	 * `pointercancel` means the interaction did not happen — an OS gesture took over, a scroll
	 * claimed the pointer, palm rejection fired — so treating it as a pen-up would commit a
	 * partial mark to the form value that the user never intended to make. Also the path taken
	 * when the keyboard user presses Escape, or focus leaves the surface mid-stroke.
	 *
	 * @param event - The originating pointer event, when the cancellation came from a pointer.
	 */
	cancelStroke(event?: PointerEvent): void {
		if (!this.drawingStroke()) return;
		if (event) this.releaseCapture(event);
		this.drawingStroke.set(null);
		this.redraw();
	}

	/**
	 * Drives the keyboard drawing path.
	 *
	 * Arrows carry the pen, Space and Enter lower and lift it, Escape abandons the stroke.
	 * The gesture is deliberately modal rather than "hold a key to draw": a key repeat is
	 * throttled by the operating system, so a held-key design would sample points at an
	 * unpredictable rate, and holding one key while pressing another is beyond many of the
	 * motor abilities this path exists to serve.
	 *
	 * Chords carrying a modifier other than Shift are left to the browser so application and
	 * assistive-technology shortcuts keep working over the field.
	 *
	 * @param event - The originating keyboard event.
	 */
	protected handleKeydown(event: KeyboardEvent): void {
		if (this.disabled() || this.readonly() || event.altKey || event.ctrlKey || event.metaKey) return;

		if (CARET_DIRECTIONS[event.key]) {
			event.preventDefault();
			this.moveCaret(event);
			return;
		}

		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (this.drawingStroke()) {
				this.commitStroke(event);
				return;
			}
			const pen = this.penPosition();
			this.caret.set(pen);
			this.beginStroke({ ...pen, pressure: SYNTHETIC_PRESSURE }, event);
			return;
		}

		if (event.key === 'Escape') {
			// Only claim the key when there is something to abandon; a dialog above may want it.
			if (!this.drawingStroke()) return;
			event.preventDefault();
			this.cancelStroke();
		}
	}

	/**
	 * Gives the drawing surface focus, which is what clicking a label is supposed to do.
	 *
	 * `<label for>` cannot deliver it: `for` associates only with labelable elements and a
	 * `<canvas>` is not one, so the attribute would sit in the markup doing nothing.
	 */
	protected focusSurface(): void {
		this.canvas().nativeElement.focus();
	}

	/** Parks the pen in the middle of the surface so a keyboard user can see where drawing starts. */
	protected showCaret(): void {
		if (this.disabled() || this.readonly()) return;
		this.caret.set(this.penPosition());
	}

	/** Removes every stroke and propagates the empty form value. */
	clear(): void {
		if (!this.strokes().length) return;
		this.strokes.set([]);
		this.redoStrokes.set([]);
		this.redraw();
		this.notifyValueChange();
	}

	/** Reverts the most recently committed stroke. */
	undo(): void {
		const strokes = this.strokes();
		const stroke = strokes.at(-1);
		if (!stroke) return;
		this.strokes.set(strokes.slice(0, -1));
		this.redoStrokes.update((entries) => [...entries, stroke]);
		this.redraw();
		this.notifyValueChange();
	}

	/** Reapplies the most recently undone stroke. */
	redo(): void {
		const entries = this.redoStrokes();
		const stroke = entries.at(-1);
		if (!stroke) return;
		this.redoStrokes.set(entries.slice(0, -1));
		this.strokes.update((strokes) => [...strokes, stroke]);
		this.redraw();
		this.notifyValueChange();
	}

	/**
	 * Reports whether the field holds no signature, so a form can validate it
	 * without parsing the serialized value.
	 *
	 * @returns Whether no stroke has been committed.
	 */
	isEmpty(): boolean {
		return this.strokes().length === 0;
	}

	/**
	 * Returns the committed strokes as structured data.
	 *
	 * Prefer {@link toSvg} to persist a signature: it is the canonical form value
	 * and survives a change of internal representation. This exists for callers
	 * that need the geometry itself — replaying a signature, or migrating from a
	 * library that stored point groups.
	 *
	 * Deliberately NOT named `toData`, which is what angular2-signaturepad calls
	 * its equivalent: that one returns `Array<Array<{x, y, time}>>` while this
	 * returns `{points: [{x, y, pressure}], color, width}[]`. Reusing the name
	 * would let a migration compile and fail silently wherever the value is
	 * typed `any`.
	 *
	 * @returns A copy of the committed strokes.
	 */
	toStrokes(): HubSignatureStroke[] {
		return this.strokes().map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) }));
	}

	/**
	 * Replaces the signature with structured stroke data.
	 *
	 * Treated as a programmatic write, like {@link writeValue}: it repaints and
	 * clears the redo stack but never reports a user change to Angular forms.
	 *
	 * @param strokes Strokes to draw.
	 */
	fromStrokes(strokes: readonly HubSignatureStroke[]): void {
		this.strokes.set(strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })));
		this.redoStrokes.set([]);
		this.redraw();
	}

	/** Returns a lossless, scalable serialization suitable for form persistence. */
	toSvg(): string {
		return serializeHubSignature(this.strokes(), this.logicalWidth(), this.height());
	}

	/** Exports the current canvas bitmap in a browser-supported image format. */
	toDataUrl(type = 'image/png'): string {
		return this.canvas().nativeElement.toDataURL(type);
	}

	/** Adjusts the device-pixel canvas without changing logical pointer geometry. */
	resizeCanvas(): void {
		const canvas = this.canvas().nativeElement;
		const rect = canvas.getBoundingClientRect();
		this.logicalWidth.set(Math.max(1, Math.round(rect.width || this.logicalWidth())));
		const scale = globalThis.devicePixelRatio || 1;
		canvas.width = this.logicalWidth() * scale;
		canvas.height = this.height() * scale;
		canvas.style.height = `${this.height()}px`;
		this.redraw();
	}

	/**
	 * Opens a stroke, whatever produced the first point.
	 *
	 * Pointer and keyboard share this so a signed stroke carries no trace of the device that
	 * wrote it: same `HubSignatureStroke`, same serialization, same reported value.
	 *
	 * @param point - First point of the stroke, in logical coordinates.
	 * @param event - The interaction that opened it, forwarded to `drawStart`.
	 */
	private beginStroke(point: HubSignaturePoint, event: HubSignatureDrawEvent): void {
		this.drawingStroke.set({ points: [point], color: this.resolveStrokeColor(), width: this.strokeWidth() });
		this.redraw();
		this.drawStart.emit(event);
	}

	/**
	 * Commits the stroke in progress and reports the new value.
	 *
	 * A single-point stroke is padded rather than dropped, so a deliberate dot still leaves a
	 * mark — which also means a stray tap counts as a signature. Validate beyond `required` if
	 * the field is a legal gate.
	 *
	 * @param event - The interaction that closed it, forwarded to `drawEnd`.
	 */
	private commitStroke(event: HubSignatureDrawEvent): void {
		const stroke = this.drawingStroke()!;
		this.drawingStroke.set(null);
		if (stroke.points.length === 1) {
			stroke.points.push({ ...stroke.points[0], x: stroke.points[0].x + 0.01 });
		}
		this.strokes.update((strokes) => [...strokes, stroke]);
		this.redoStrokes.set([]);
		this.notifyValueChange();
		this.drawEnd.emit(event);
	}

	/** Current pen position, defaulting to the centre of the surface. */
	private penPosition(): { x: number; y: number } {
		return this.caret() ?? { x: this.logicalWidth() / 2, y: this.height() / 2 };
	}

	/**
	 * Moves the pen, extending the stroke when it is down so travel and drawing are one gesture.
	 *
	 * @param event - The arrow keypress; Shift selects the coarse step.
	 */
	private moveCaret(event: KeyboardEvent): void {
		const direction = CARET_DIRECTIONS[event.key];
		const step = event.shiftKey ? CARET_COARSE_STEP : CARET_STEP;
		const from = this.penPosition();
		const to = {
			x: clamp(from.x + direction.x * step, 0, this.logicalWidth()),
			y: clamp(from.y + direction.y * step, 0, this.height())
		};
		this.caret.set(to);

		const stroke = this.drawingStroke();
		if (!stroke) return;
		this.drawingStroke.set({ ...stroke, points: [...stroke.points, { ...to, pressure: SYNTHETIC_PRESSURE }] });
		this.redraw();
	}

	/**
	 * Resolves the ink actually used, so `currentColor` never reaches the canvas or the archive.
	 *
	 * The 2D context cannot parse CSS-context keywords — the assignment is dropped and the ink
	 * falls back to black — and the same string is written verbatim into the stored SVG, leaving
	 * an archived signature with no fixed colour at all. Resolving it here is also what makes
	 * `hub-signature-theme($color: …)` reach the ink, as its documentation claims.
	 *
	 * @returns A concrete colour to store on the stroke.
	 */
	private resolveStrokeColor(): string {
		const color = this.strokeColor();
		if (color.trim().toLowerCase() !== 'currentcolor') return color;
		return getComputedStyle(this.canvas().nativeElement).color || '#000000';
	}

	/** Releases pointer capture only when this element still holds it, as cancellation may have. */
	private releaseCapture(event: PointerEvent): void {
		const canvas = this.canvas().nativeElement;
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	}

	/** Emits only user changes; model writes must never re-enter Angular forms. */
	private notifyValueChange(): void {
		const value = this.strokes().length ? this.toSvg() : '';
		this.onChange(value);
		this.onTouched();
		this.valueChange.emit(value);
	}

	/** Maps page coordinates onto the canvas logical coordinate system. */
	private getPoint(event: PointerEvent): HubSignaturePoint {
		const rect = this.canvas().nativeElement.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * this.logicalWidth()) / Math.max(1, rect.width),
			y: ((event.clientY - rect.top) * this.height()) / Math.max(1, rect.height),
			pressure: event.pressure || 0.5
		};
	}

	/**
	 * Replays retained geometry so rendering is independent from interaction history.
	 *
	 * Painting is skipped outside the browser. `writeValue()` calls this whenever a form binds a
	 * value, which happens during server-side rendering, and the server DOM shim *throws* from
	 * `getContext` rather than returning null — so the null check below never gets the chance to
	 * run. Nothing is lost by skipping: the canvas has no pixels on the server, and
	 * `afterNextRender` repaints as soon as it does.
	 */
	private redraw(): void {
		if (!this.isBrowser) return;
		const canvas = this.canvas()?.nativeElement;
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const scale = globalThis.devicePixelRatio || 1;
		context.setTransform(scale, 0, 0, scale, 0, 0);
		context.clearRect(0, 0, this.logicalWidth(), this.height());
		[...this.strokes(), ...(this.drawingStroke() ? [this.drawingStroke()!] : [])].forEach((stroke) => {
			context.beginPath();
			context.strokeStyle = stroke.color;
			context.lineWidth = stroke.width;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			stroke.points.forEach((point, index) =>
				index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)
			);
			context.stroke();
		});
	}
}
