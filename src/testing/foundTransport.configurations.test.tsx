import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigurationCounter } from "../components/foundations/ConfigurationCounter.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";
import {
  configurations,
  describeMagnitude,
  GRAM_MOLECULE,
  PARTICLE_CHOICES,
  SQUEEZES,
  type Squeeze,
  sci,
} from "../foundations/configurations.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the entropy-multiplicity lesson's construction, "a configuration
 * counter", with a textual equivalent. The counts are checked by listing, the lesson's printed
 * numbers are recomputed from the construction's own state, and a gram-molecule never turns into
 * 0 or Infinity.
 */

const [HALF, QUARTER, NINE_TENTHS] = SQUEEZES as [Squeeze, Squeeze, Squeeze];

describe("the counts", () => {
  test("four particles, half the box: 16 arrangements, one with all four inside, W = 1/16", () => {
    const state = configurations(4, HALF);
    expect(state.total).toEqual({ kind: "exact", value: 16 });
    expect(state.favourable).toEqual({ kind: "exact", value: 1 });
    expect(state.probability).toEqual({ kind: "exact", value: 1 / 16 });
    expect(state.listing?.length).toBe(16);
    expect(state.listing?.filter((a) => a.inside).map((a) => a.cells)).toEqual([[1, 1, 1, 1]]);
  });

  test("every listing holds each arrangement once, and counts the inside ones as keptⁿ", () => {
    const listed = [
      [4, HALF],
      [2, QUARTER],
      [1, NINE_TENTHS],
      [1, HALF],
    ] as const;
    for (const [n, squeeze] of listed) {
      const listing = configurations(n, squeeze).listing ?? [];
      expect(listing.length).toBe(squeeze.cells ** n);
      expect(new Set(listing.map((a) => a.cells.join())).size).toBe(listing.length);
      expect(listing.filter((a) => a.inside).length).toBe(squeeze.kept ** n);
    }
  });

  test("the chances multiply and their logarithms add: ln W is n times ln(v/v₀)", () => {
    for (const squeeze of SQUEEZES)
      for (const n of [1, 2, 4, 10]) {
        const state = configurations(n, squeeze);
        const one = configurations(1, squeeze);
        expect(withinTolerance(state.lnW, n * one.lnW, { relative: 1e-12 }).ok).toBe(true);
        if (state.probability.kind !== "exact" || one.probability.kind !== "exact")
          throw new TypeError("expected exact probabilities");
        expect(
          withinTolerance(state.probability.value, one.probability.value ** n, { relative: 1e-12 })
            .ok,
        ).toBe(true);
      }
  });

  test("the splits count the listing: 1, 4, 6, 4, 1 for four particles in half the box", () => {
    expect(configurations(4, HALF).splits?.map((s) => s.arrangements)).toEqual([1, 4, 6, 4, 1]);
    // In general C(n, k)·keptᵏ·(cells − kept)ⁿ⁻ᵏ, and the splits add up to every arrangement.
    const choose = (n: number, k: number): number =>
      k === 0 ? 1 : (choose(n, k - 1) * (n - k + 1)) / k;
    for (const [n, squeeze] of [
      [2, QUARTER],
      [1, NINE_TENTHS],
      [3, HALF],
    ] as const) {
      const splits = configurations(n, squeeze).splits ?? [];
      expect(splits.map((s) => s.inside)).toEqual(Array.from({ length: n + 1 }, (_, i) => n - i));
      for (const s of splits)
        expect(s.arrangements).toBe(
          choose(n, s.inside) *
            squeeze.kept ** s.inside *
            (squeeze.cells - squeeze.kept) ** (n - s.inside),
        );
      expect(splits.reduce((sum, s) => sum + s.arrangements, 0)).toBe(squeeze.cells ** n);
    }
  });

  test("more than 16 arrangements are not listed", () => {
    expect(configurations(10, HALF).listing).toBeNull();
    expect(configurations(GRAM_MOLECULE, NINE_TENTHS).listing).toBeNull();
    expect(configurations(10, HALF).splits).toBeNull();
  });

  test("100 particles in tenths have exactly 10¹⁰⁰ arrangements, said without 'about'", () => {
    expect(describeMagnitude(configurations(100, NINE_TENTHS).total)).toBe("10¹⁰⁰");
  });
});

describe("the lesson's numbers, from the construction's own state", () => {
  test("(½)¹⁰⁰ is about 8 × 10⁻³¹", () => {
    const state = configurations(100, HALF);
    if (state.probability.kind !== "exact") throw new TypeError("expected an exact probability");
    expect(roundsTo(state.probability.value, 8e-31, { significantFigures: 1 }).ok).toBe(true);
    expect(describeMagnitude(state.probability)).toBe("about 7.89 × 10⁻³¹");
  });

  test("a gram-molecule squeezed to half: ln W about −4.2 × 10²³, and R ln ½ about −5.76 J/K", () => {
    const state = configurations(GRAM_MOLECULE, HALF);
    expect(roundsTo(state.lnW, -4.2e23, { significantFigures: 2 }).ok).toBe(true);
    expect(roundsTo(state.entropyChange, -5.76, { significantFigures: 3 }).ok).toBe(true);
    // That it is exactly R ln ½, with the owner's constants, is checked in
    // foundTransport.configurationConstants.test.ts: a .tsx file may not import the owner.
  });
});

describe("a gram-molecule is never 0 or Infinity", () => {
  for (const squeeze of SQUEEZES)
    test(squeeze.name, () => {
      const state = configurations(GRAM_MOLECULE, squeeze);
      for (const m of [state.total, state.favourable, state.probability]) {
        if (m.kind === "exact") expect(m.value > 0 && Number.isFinite(m.value)).toBe(true);
        else expect(Number.isFinite(m.log10)).toBe(true);
        expect(describeMagnitude(m)).not.toMatch(/Infinity|NaN|^0$/);
      }
      expect(state.probability.kind).toBe("power");
      expect(Number.isFinite(state.entropyChange)).toBe(true);
    });

  test("half the box: W is 10 to the power −1.81 × 10²³", () => {
    expect(describeMagnitude(configurations(GRAM_MOLECULE, HALF).probability)).toBe(
      "10 to the power −1.81 × 10²³",
    );
  });

  test("a mantissa that rounds up carries into the power", () => {
    expect(describeMagnitude({ kind: "power", log10: Math.log10(9.998e30) })).toBe(
      "about 1.00 × 10³¹",
    );
  });
});

describe("the rendered construction", () => {
  const html = renderToStaticMarkup(<ConfigurationCounter />);
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");

  test("four particles in half the box by default: 16 cards, one of them all inside", () => {
    expect(html).toContain('data-foundation-construction="entropy-multiplicity"');
    expect(html.match(/class="config-card( config-card-inside)?"/g)?.length).toBe(16);
    expect(html.match(/config-card-inside/g)?.length).toBe(1);
    expect(html.match(/<tr>/g)?.length).toBe(1 + 5);
    expect(text).toContain("Of 16 equally likely arrangements, 1 put all 4 in the left half.");
    expect(text).toContain("= 0.0625");
  });

  test("every choice is a pressed-state button, and the result is announced", () => {
    expect(html.match(/aria-pressed=/g)?.length).toBe(PARTICLE_CHOICES.length + SQUEEZES.length);
    expect(html).toContain('role="status"');
  });

  test("the words in the text equivalent are the construction's own numbers", () => {
    expect(text).toContain("W = 1/16");
    expect(text).toContain(`about ${sci(configurations(1, HALF).lnW)}`);
    expect(text).toContain("about 8 × 10⁻³¹");
    const even = configurations(4, HALF).splits?.find((s) => s.inside === 2)?.arrangements;
    expect(text).toContain(`comes up in ${even} of the 16 arrangements`);
    expect(text).toContain(`about ${sci(configurations(GRAM_MOLECULE, HALF).entropyChange)}`);
  });

  test("the voice lint finds no error", () => {
    const errors = checkVoice(text, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
