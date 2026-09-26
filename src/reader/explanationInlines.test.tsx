/**
 * An explanation's inline formulas (explanationInlines.ts, InlineMathText with a scope), through the
 * real resolver, concordance and registry. Mass-energy's § 0 is the case: the smallest paper, and
 * the first to be coloured (dispatch 273).
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import { isRegisteredQuantityId } from "../content/quantities/registry.ts";
import { modernInlineEntries } from "../equations/printed/modernScope.ts";
import { explanationInline, isRegisteredForPage } from "./explanationInlines.ts";
import { InlineMathText } from "./InlineMathText.tsx";

const SCOPE = { paper: "mass-energy", section: "s0", where: "arg-me-test full" } as const;

describe("an explanation's inline formulas", () => {
  test("a formula that resolves is drawn with its terms marked", () => {
    const marked = explanationInline("v/c", SCOPE);
    expect(marked?.coloured).toBe(true);
    expect(marked?.html).toContain('data-quantity-id="frameSpeed"');
    expect(marked?.html).toContain('data-quantity-id="speedOfLight"');
  });

  test("one that does not resolve renders plain while its paper is not enforced", () => {
    // μ is relativity's electron mass; mass-energy's concordance has no reading of it in § 0.
    expect(explanationInline("\\mu", SCOPE, [])).toBeUndefined();
  });

  test("in an enforced paper the same formula fails, naming its passage and glyph", () => {
    expect(() => explanationInline("\\mu", SCOPE, ["mass-energy"])).toThrow(
      /inline-terms-refused: .*arg-me-test full.*"\\mu"/,
    );
  });

  test("InlineMathText with a scope marks a coloured formula's span, and without one is unchanged", () => {
    const text = "the ratio \\(v/c\\) and \\(\\mu\\)";
    const scoped = renderToStaticMarkup(<InlineMathText text={text} scope={SCOPE} />);
    // Marked as the faces' inline formulas are, so the page's island finds it (InlineTermLighting).
    expect(scoped).toContain(
      '<span class="inline-math" data-inline-terms="" data-paper="mass-energy">',
    );
    expect(scoped.match(/data-paper=/g)?.length).toBe(1);
    expect(scoped).toContain('data-quantity-id="speedOfLight"');
    const plain = renderToStaticMarkup(<InlineMathText text={text} />);
    expect(plain).not.toContain("data-paper");
    expect(plain).not.toContain("data-quantity-id");
  });

  test("the page's registration check gives the registry's answer for every id the contexts bind", () => {
    const ids = new Set<string>();
    for (const paper of ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"])
      for (const entry of modernInlineEntries(paper, loadConcordanceForPaper(paper)))
        if ("quantityId" in entry.binding) ids.add(entry.binding.quantityId);
    expect(ids.size).toBeGreaterThan(0);
    const disagree = [...ids].filter(
      (id) => isRegisteredForPage(id) !== isRegisteredQuantityId(id),
    );
    expect(disagree).toEqual([]);
  });

  test("a paper not yet read against its passages stays plain, even where a formula resolves", () => {
    // eV ≥ hν in light quanta § 8: V there is the accelerating potential, the concordance's V is the
    // volume. It resolves, so only the paper list keeps it from being coloured as a volume.
    const lq = { paper: "light-quanta", section: "s8", where: "arg-lq-test steps" } as const;
    expect(explanationInline("eV\\ge h\\nu", lq)).toBeUndefined();
    expect(explanationInline("eV\\ge h\\nu", lq, [], ["light-quanta"])?.html).toContain(
      'data-quantity-id="volume"',
    );
  });

  test("malformed mathematics still fails with a scope", () => {
    expect(() =>
      renderToStaticMarkup(<InlineMathText text="bad \\(\\frac{1}\\)" scope={SCOPE} />),
    ).toThrow();
  });
});
