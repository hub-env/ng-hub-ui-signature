import { TestBed } from '@angular/core/testing';
import { HubSignatureComponent } from './components/signature/signature.component';

/** One `selector { … }` rule of the stylesheet as the build injects it into the document. */
interface StyleRule {
	selector: string;
	body: string;
}

/** A keyframe step (`0%`, `from`, `to`) — a rule, but not one that selects an element. */
const KEYFRAME_STEP = /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/;

/**
 * The rules the component actually ships, read back from the document rather than from the
 * `.scss` source. What decides whether encapsulation holds is the CSS that reaches the page,
 * after the build has compiled it and the shim has rewritten the selectors — the source says
 * nothing about either.
 */
function shippedRules(): StyleRule[] {
	const css = Array.from(document.querySelectorAll('style'))
		.map((style) => style.textContent ?? '')
		.filter((text) => text.includes('hub-signature'))
		.join('\n')
		.replace(/\/\*[\s\S]*?\*\//g, '');

	const rules: StyleRule[] = [];
	// Nested at-rules are stepped over rather than parsed: their wrapper never matches this
	// pattern, and the rules inside them do.
	for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = match[1].trim();
		if (!KEYFRAME_STEP.test(selector)) {
			rules.push({ selector, body: match[2] });
		}
	}
	return rules;
}

describe('hub-signature stylesheet', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [HubSignatureComponent] }).compileComponents();
		TestBed.createComponent(HubSignatureComponent).detectChanges();
	});

	/**
	 * The field's whole DOM — the `.hub-signature` root div included — is the component's own
	 * view, so nothing here ever needed to leave encapsulation. Every selector it emits is
	 * stamped with its content marker and matches nothing outside.
	 */
	it('emits no rule that escapes into the application cascade', () => {
		const escaped = shippedRules()
			.map((rule) => rule.selector)
			.filter((selector) => !selector.includes('_ngcontent-') && !selector.includes('_nghost-'));

		expect(escaped).toEqual([]);
	});

	/**
	 * Consumers theme the field by writing `--hub-signature-*` against `.hub-signature`, from a
	 * global sheet or through `hub-signature-theme()`. The scoping attribute goes INSIDE the
	 * `:where()`, so these defaults keep specificity zero and any such rule still outranks
	 * them — which is the only reason the mixin works at all.
	 */
	it('keeps its token defaults at zero specificity', () => {
		const declaring = shippedRules().filter((rule) => /--hub-signature-[a-z-]+\s*:/.test(rule.body));

		expect(declaring.length).toBe(1);
		expect(declaring[0].selector).toMatch(/^:where\(\.hub-signature\[_ngcontent-[^\]]+\]\)$/);
	});

	/**
	 * The rules a consumer's own sheet has to be able to reach are on elements the component
	 * renders itself, so scoping them changes who can write them, not who they land on. This
	 * is the sanity check that the field is still dressed at all after the change.
	 */
	it('still dresses the drawing surface it renders', () => {
		const canvas = shippedRules().filter((rule) => rule.selector.includes('.hub-signature__canvas'));

		expect(canvas.length).toBeGreaterThan(0);
		for (const rule of canvas) {
			expect(rule.selector).toContain('_ngcontent-');
		}
	});
});
