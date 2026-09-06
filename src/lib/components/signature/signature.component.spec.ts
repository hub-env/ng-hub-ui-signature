import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HubFormTextDirective, HubLabelTypes, HubValidationErrorDirective, type HubLabelType } from 'ng-hub-ui-forms';
import { provideHubTranslationAdapter } from 'ng-hub-ui-utils';
import type { HubSignatureDrawEvent } from '../../models/signature.types';
import { HUB_SIGNATURE_CONFIG, type HubSignatureLabels } from '../../signature-config';
import { HubSignatureComponent } from './signature.component';

@Component({
	standalone: true,
	imports: [HubSignatureComponent],
	template: `<hub-signature
		[labels]="signatureLabels()"
		[label]="labelText()"
		[labelType]="labelPlacement()"
		[ariaLabel]="accessibleName()"
		[readonly]="readonlyMode()"
		[strokeColor]="ink()"
		[height]="surfaceHeight()"
		[showValid]="true"
		[validFeedback]="validMessage()"
		(drawStart)="starts.push($event)"
		(drawEnd)="ends.push($event)"
	/>`
})
class HostSignatureComponent {
	readonly signature = viewChild.required(HubSignatureComponent);
	readonly signatureLabels = signal<Partial<HubSignatureLabels>>({});
	readonly labelText = signal('');
	readonly labelPlacement = signal<HubLabelType>(HubLabelTypes.Stacked);
	readonly accessibleName = signal('');
	readonly readonlyMode = signal(false);
	readonly ink = signal('currentColor');
	readonly surfaceHeight = signal(160);
	readonly validMessage = signal<string | null>(null);
	readonly starts: HubSignatureDrawEvent[] = [];
	readonly ends: HubSignatureDrawEvent[] = [];
}

@Component({
	standalone: true,
	imports: [HubSignatureComponent],
	template: `<hub-signature [label]="labelText()" [formText]="hint()" formTextType="tooltip" />`
})
class TooltipHostSignatureComponent {
	readonly labelText = signal('');
	readonly hint = signal('Draw inside the frame with a finger, a stylus or the arrow keys.');
}

@Component({
	standalone: true,
	imports: [HubSignatureComponent, ReactiveFormsModule, HubFormTextDirective, HubValidationErrorDirective],
	template: `<hub-signature [formControl]="control" [formText]="hint()">
		<ng-template hubFormText><span class="projected-form-text">Sign as it appears on your ID</span></ng-template>
		<ng-template hubValidationError key="required">
			<span class="projected-error">Sign before continuing</span>
		</ng-template>
	</hub-signature>`
})
class ProjectedHostSignatureComponent {
	readonly control = new FormControl<string>('', Validators.required);
	readonly hint = signal('');
}

/** Minimal PointerEvent stand-in: jsdom has no pointer capture. */
function pointerEvent(id = 1): PointerEvent {
	return { pointerId: id, preventDefault: () => {}, clientX: 10, clientY: 10 } as unknown as PointerEvent;
}

/** Drives the real template binding rather than the handler, so the wiring is under test too. */
function keydown(canvas: HTMLCanvasElement, key: string, init: KeyboardEventInit = {}): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

/** Focuses the surface and returns it, which is where every keyboard interaction begins. */
function focusedCanvas(fixture: { nativeElement: HTMLElement }): HTMLCanvasElement {
	const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
	canvas.focus();
	return canvas;
}

describe('HubSignatureComponent', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({ imports: [HostSignatureComponent] });
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		// jsdom implements none of the pointer-capture methods.
		HTMLCanvasElement.prototype.setPointerCapture = () => {};
		HTMLCanvasElement.prototype.releasePointerCapture = () => {};
		HTMLCanvasElement.prototype.hasPointerCapture = () => true;
	});

	it('restores a form SVG value as drawable signature data', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		fixture.componentInstance
			.signature()
			.writeValue(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="M 12 16 L 42 34" fill="none" stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>'
			);

		expect(fixture.componentInstance.signature().toSvg()).toContain('d="M 12 16 L 42 34"');
	});

	it('does not report a model write as a user form change', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		const onChange = vi.fn();
		fixture.detectChanges();
		fixture.componentInstance.signature().registerOnChange(onChange);

		fixture.componentInstance
			.signature()
			.writeValue(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="M 12 16 L 42 34" fill="none" stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>'
			);

		expect(onChange).not.toHaveBeenCalled();
	});

	it('propagates undo and redo as the current SVG value', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		const onChange = vi.fn();
		fixture.detectChanges();
		fixture.componentInstance.signature().registerOnChange(onChange);
		fixture.componentInstance
			.signature()
			.writeValue(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="M 12 16 L 42 34" fill="none" stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>'
			);

		fixture.componentInstance.signature().undo();
		fixture.componentInstance.signature().redo();

		expect(onChange).toHaveBeenNthCalledWith(1, '');
		expect(onChange).toHaveBeenNthCalledWith(2, expect.stringContaining('d="M 12 16 L 42 34"'));
	});

	it('merges per-instance action labels over the default label set', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		fixture.componentInstance.signatureLabels.set({ clear: 'Borrar firma' });
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('button')[0].textContent.trim()).toBe('Borrar firma');
		expect(fixture.nativeElement.querySelectorAll('button')[1].textContent.trim()).toBe('Undo stroke');
	});

	it('uses application-wide action labels supplied through the configuration token', () => {
		TestBed.overrideProvider(HUB_SIGNATURE_CONFIG, {
			useValue: { labels: { clear: 'Borrar firma', undo: 'Deshacer trazo', redo: 'Rehacer trazo' } }
		});
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		expect(
			Array.from(fixture.nativeElement.querySelectorAll('button'), (button: HTMLButtonElement) =>
				button.textContent.trim()
			)
		).toEqual(['Borrar firma', 'Deshacer trazo', 'Rehacer trazo']);
	});

	it('updates buttons from a reactive translation source', () => {
		const clear = new BehaviorSubject('Clear signature');
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.signatureLabels.set({ clear });
		fixture.detectChanges();

		clear.next('Borrar firma');
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('button')[0].textContent.trim()).toBe('Borrar firma');
	});

	it('updates every field from the shared application translation adapter', () => {
		const translations = new BehaviorSubject<Record<string, unknown>>({
			HUBUI: { SIGNATURE: { ACTION: { CLEAR: 'Clear signature' } } }
		});
		TestBed.configureTestingModule({ providers: [provideHubTranslationAdapter(() => translations)] });
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		translations.next({ HUBUI: { SIGNATURE: { ACTION: { CLEAR: 'Borrar firma' } } } });
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('button')[0].textContent.trim()).toBe('Borrar firma');
	});

	it('reports emptiness so a form can validate the field', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();

		expect(signature.isEmpty()).toBe(true);

		signature.writeValue(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path d="M 12 16 L 42 34" fill="none" stroke="#123456" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>'
		);

		expect(signature.isEmpty()).toBe(false);
	});

	it('round-trips signature data through toStrokes and fromStrokes', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();

		signature.fromStrokes([
			{
				points: [
					{ x: 1, y: 2, pressure: 0.5 },
					{ x: 3, y: 4, pressure: 0.5 }
				],
				color: '#abcdef',
				width: 4
			}
		]);

		expect(signature.toStrokes()).toEqual([
			{
				points: [
					{ x: 1, y: 2, pressure: 0.5 },
					{ x: 3, y: 4, pressure: 0.5 }
				],
				color: '#abcdef',
				width: 4
			}
		]);
		expect(signature.isEmpty()).toBe(false);
	});

	it('does not report a fromStrokes write as a user form change', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		const onChange = vi.fn();
		fixture.detectChanges();
		fixture.componentInstance.signature().registerOnChange(onChange);

		fixture.componentInstance
			.signature()
			.fromStrokes([{ points: [{ x: 1, y: 2, pressure: 0.5 }], color: '#000', width: 2 }]);

		expect(onChange).not.toHaveBeenCalled();
	});

	it('emits drawStart and drawEnd around a stroke', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const host = fixture.componentInstance;
		host.signature().startStroke(pointerEvent());
		expect(host.starts).toHaveLength(1);
		expect(host.ends).toHaveLength(0);

		host.signature().finishStroke(pointerEvent());
		expect(host.ends).toHaveLength(1);
	});

	it('does not emit drawStart while readonly', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.readonlyMode.set(true);
		fixture.detectChanges();

		fixture.componentInstance.signature().startStroke(pointerEvent());

		expect(fixture.componentInstance.starts).toHaveLength(0);
	});

	it('draws a committed stroke from the keyboard alone', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = focusedCanvas(fixture);
		const signature = fixture.componentInstance.signature();

		keydown(canvas, ' ');
		keydown(canvas, 'ArrowRight');
		keydown(canvas, 'ArrowDown');
		keydown(canvas, ' ');

		const [stroke, ...rest] = signature.toStrokes();
		expect(rest).toHaveLength(0);
		expect(stroke.points).toHaveLength(3);
		// Same shape a pointer stroke produces: 0.5 is the pressure fallback of getPoint().
		expect(stroke.points.every((point) => point.pressure === 0.5)).toBe(true);
		expect(signature.toSvg()).toContain('<path d="M ');
		expect(signature.isEmpty()).toBe(false);
	});

	it('emits drawStart and drawEnd around a keyboard stroke', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = focusedCanvas(fixture);
		const host = fixture.componentInstance;

		keydown(canvas, 'Enter');
		expect(host.starts).toHaveLength(1);
		expect(host.starts[0]).toBeInstanceOf(KeyboardEvent);
		expect(host.ends).toHaveLength(0);

		keydown(canvas, 'Enter');
		expect(host.ends).toHaveLength(1);
		expect(host.ends[0]).toBeInstanceOf(KeyboardEvent);
	});

	it('refuses the keyboard drawing path while readonly', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.readonlyMode.set(true);
		fixture.detectChanges();
		const canvas = focusedCanvas(fixture);

		keydown(canvas, ' ');
		keydown(canvas, 'ArrowRight');
		keydown(canvas, ' ');

		expect(fixture.componentInstance.starts).toHaveLength(0);
		expect(fixture.componentInstance.signature().isEmpty()).toBe(true);
	});

	it('sizes the drawing surface from the height input on the first render', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		expect(canvas.style.height).toBe('160px');
		expect(canvas.height).toBe(160 * (globalThis.devicePixelRatio || 1));
	});

	it('resizes the drawing surface when the height input changes after the first render', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		fixture.componentInstance.surfaceHeight.set(240);
		fixture.detectChanges();

		expect(canvas.style.height).toBe('240px');
		expect(canvas.height).toBe(240 * (globalThis.devicePixelRatio || 1));
	});

	it('keeps the stored viewBox and the surface geometry in step across a height change', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
		const signature = fixture.componentInstance.signature();
		signature.fromStrokes([
			{
				points: [
					{ x: 10, y: 20, pressure: 0.5 },
					{ x: 40, y: 60, pressure: 0.5 }
				],
				color: '#123456',
				width: 2
			}
		]);

		fixture.componentInstance.surfaceHeight.set(240);
		fixture.detectChanges();

		// toSvg() reads height() live, so a surface left at the old pixel height would file
		// unchanged geometry under a taller viewBox — a document that no longer describes the
		// surface the ink was drawn on.
		expect(signature.toSvg()).toContain('viewBox="0 0 320 240"');
		expect(canvas.style.height).toBe('240px');
	});

	it('describes the keyboard interaction through aria-describedby', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		const describedBy = canvas.getAttribute('aria-describedby');
		const hint = fixture.nativeElement.querySelector(`[id="${describedBy}"]`) as HTMLElement | null;

		expect(describedBy).toBeTruthy();
		expect(hint?.textContent).toMatch(/arrow keys/i);
	});

	it('shows the keyboard pen once the surface is focused', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		focusedCanvas(fixture);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-signature__caret')).not.toBeNull();
	});

	it('discards the keyboard stroke in progress when Escape is pressed', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		const onChange = vi.fn();
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();
		signature.registerOnChange(onChange);
		const canvas = focusedCanvas(fixture);

		keydown(canvas, ' ');
		keydown(canvas, 'ArrowRight');
		keydown(canvas, 'Escape');

		// The stroke really began, so an empty field proves it was discarded and not merely never started.
		expect(fixture.componentInstance.starts).toHaveLength(1);
		expect(signature.isEmpty()).toBe(true);
		expect(fixture.componentInstance.ends).toHaveLength(0);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('discards the stroke in progress when the pointer is cancelled', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		const onChange = vi.fn();
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();
		signature.registerOnChange(onChange);
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		signature.startStroke(pointerEvent());
		canvas.dispatchEvent(new Event('pointercancel'));

		expect(signature.isEmpty()).toBe(true);
		expect(fixture.componentInstance.ends).toHaveLength(0);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('resolves the default currentColor ink before storing it', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();

		signature.startStroke(pointerEvent());
		signature.finishStroke(pointerEvent());

		expect(signature.toStrokes()[0].color).not.toBe('currentColor');
		expect(signature.toSvg()).not.toContain('currentColor');
	});

	it('stores an explicitly bound stroke colour verbatim', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.ink.set('#123456');
		fixture.detectChanges();
		const signature = fixture.componentInstance.signature();

		signature.startStroke(pointerEvent());
		signature.finishStroke(pointerEvent());

		expect(signature.toStrokes()[0].color).toBe('#123456');
	});

	it('names the drawing surface from the visible label', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelText.set('Account holder signature');
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		const labelledBy = canvas.getAttribute('aria-labelledby');
		const label = fixture.nativeElement.querySelector(`[id="${labelledBy}"]`) as HTMLElement | null;

		expect(labelledBy).toBeTruthy();
		expect(label?.textContent?.trim()).toContain('Account holder signature');
		// aria-labelledby outranks aria-label, so one beside it would be unreachable dead weight.
		expect(canvas.getAttribute('aria-label')).toBeNull();
	});

	it('falls back to the accessible label when no visible label is rendered', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		expect(canvas.getAttribute('aria-labelledby')).toBeNull();
		expect(canvas.getAttribute('aria-label')).toBe('Signature');
	});

	it('keeps the keyboard description separate from the accessible name', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelText.set('Signature');
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		const labelledBy = canvas.getAttribute('aria-labelledby');
		const describedBy = canvas.getAttribute('aria-describedby');

		// Name and description are different ARIA properties; each must resolve to its own node.
		expect(labelledBy).toBeTruthy();
		expect(describedBy).toBeTruthy();
		expect(labelledBy).not.toBe(describedBy);
		expect(fixture.nativeElement.querySelector(`[id="${labelledBy}"]`)?.textContent).toContain('Signature');
		expect(fixture.nativeElement.querySelector(`[id="${describedBy}"]`)?.textContent).toMatch(/arrow keys/i);
	});

	it('focuses the drawing surface when the visible label is clicked', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelText.set('Signature');
		fixture.detectChanges();
		const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

		(fixture.nativeElement.querySelector('label') as HTMLLabelElement).click();

		expect(document.activeElement).toBe(canvas);
	});

	it('translates the accessible name through the shared translation adapter', () => {
		const translations = new BehaviorSubject<Record<string, unknown>>({
			HUBUI: { SIGNATURE: { ARIA_LABEL: 'Signature' } }
		});
		TestBed.configureTestingModule({ providers: [provideHubTranslationAdapter(() => translations)] });
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.detectChanges();

		translations.next({ HUBUI: { SIGNATURE: { ARIA_LABEL: 'Firma' } } });
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-label')).toBe('Firma');
	});

	it('lets an explicitly bound ariaLabel outrank the dictionary', () => {
		const translations = new BehaviorSubject<Record<string, unknown>>({
			HUBUI: { SIGNATURE: { ARIA_LABEL: 'Firma' } }
		});
		TestBed.configureTestingModule({ providers: [provideHubTranslationAdapter(() => translations)] });
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.accessibleName.set('Contract signature');
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-label')).toBe('Contract signature');
	});

	it('keeps an explicit ariaLabel when a reactive label source emits into the same slot', () => {
		const stream = new BehaviorSubject('Firma');
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.accessibleName.set('Contract signature');
		fixture.componentInstance.signatureLabels.set({ ariaLabel: stream });
		fixture.detectChanges();

		stream.next('Firma del titular');
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-label')).toBe('Contract signature');
	});

	it('lays the label beside the field when the label type is horizontal', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelText.set('Signature');
		fixture.componentInstance.labelPlacement.set(HubLabelTypes.Horizontal);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-signature--horizontal')).not.toBeNull();
	});

	it('keeps the label stacked for a label type this field cannot honour', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelText.set('Signature');
		fixture.componentInstance.labelPlacement.set(HubLabelTypes.Floating);
		fixture.detectChanges();

		// A floating label needs a text-entry control to float over; the family's non-text
		// fields fall back to stacked rather than inventing a placement.
		expect(fixture.nativeElement.querySelector('.hub-signature--horizontal')).toBeNull();
	});

	it('does not lay out horizontally when there is no label to place', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.labelPlacement.set(HubLabelTypes.Horizontal);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-signature--horizontal')).toBeNull();
	});

	it('renders the success feedback once the field is touched and valid', () => {
		const fixture = TestBed.createComponent(HostSignatureComponent);
		fixture.componentInstance.validMessage.set('Signature captured');
		fixture.detectChanges();

		fixture.componentInstance.signature().handleBlur();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-field__feedback--valid')?.textContent.trim()).toBe(
			'Signature captured'
		);
	});

	it('keeps the helper-text mark on a bare surface with no visible label', () => {
		const fixture = TestBed.createComponent(TooltipHostSignatureComponent);
		fixture.detectChanges();

		const hint = fixture.nativeElement.querySelector('.hub-field__hint') as HTMLButtonElement | null;

		// The block below stands down in tooltip mode, so the mark is the only place the text is
		// left: a label-less field losing the mark loses its helper text entirely.
		expect(fixture.nativeElement.querySelector('label')).toBeNull();
		expect(hint).not.toBeNull();
		expect(hint?.getAttribute('aria-label')).toBe(fixture.componentInstance.hint());
		expect(fixture.nativeElement.querySelector('.hub-field__form-text')).toBeNull();
	});

	it('pairs the helper-text mark with the label when there is one', () => {
		const fixture = TestBed.createComponent(TooltipHostSignatureComponent);
		fixture.componentInstance.labelText.set('Account holder signature');
		fixture.detectChanges();

		const row = fixture.nativeElement.querySelector('.hub-field__label-row') as HTMLElement | null;

		expect(row?.querySelector('label')?.textContent?.trim()).toContain('Account holder signature');
		expect(row?.querySelector('.hub-field__hint')).not.toBeNull();
	});

	it('renders a projected hubFormText template as the helper text', () => {
		const fixture = TestBed.createComponent(ProjectedHostSignatureComponent);
		fixture.detectChanges();

		const formText = fixture.nativeElement.querySelector('.hub-field__form-text') as HTMLElement | null;

		expect(formText).not.toBeNull();
		expect(formText?.querySelector('.projected-form-text')?.textContent?.trim()).toBe('Sign as it appears on your ID');
	});

	it('lets a projected hubValidationError template replace the default message', () => {
		const fixture = TestBed.createComponent(ProjectedHostSignatureComponent);
		fixture.detectChanges();

		fixture.componentInstance.control.markAsTouched();
		fixture.detectChanges();

		const feedback = fixture.nativeElement.querySelector('.hub-field__feedback') as HTMLElement | null;

		expect(feedback?.querySelector('.projected-error')?.textContent?.trim()).toBe('Sign before continuing');
		expect(feedback?.textContent).not.toContain('This field is required.');
	});

	it('falls back to the default message for an error key with no projected template', () => {
		const fixture = TestBed.createComponent(ProjectedHostSignatureComponent);
		fixture.detectChanges();

		fixture.componentInstance.control.setErrors({ email: true });
		fixture.componentInstance.control.markAsTouched();
		fixture.detectChanges();

		const feedback = fixture.nativeElement.querySelector('.hub-field__feedback') as HTMLElement | null;

		expect(feedback?.querySelector('.projected-error')).toBeNull();
		expect(feedback?.textContent).toContain('Enter a valid email address.');
	});
});
