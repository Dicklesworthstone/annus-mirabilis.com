import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ACCOUNT,
  DISPLACEMENTS,
  meanSquare,
  outcomes,
  rootMeanSquare,
  TOKENS,
} from "../../foundations/bridgeFigures.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { CONSTRUCTIONS_WITH_CONTROLS } from "./constructionIds.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

/**
 * The three bridge figures of dispatch 409, held to what bridgeFigures.test.tsx holds %0's five to,
 * plus the one obligation these three carry that those five do not: each of them draws ARITHMETIC a
 * reader is invited to check, so the drawing's numbers are asserted against the arithmetic rather
 * than against a copy of themselves.
 *
 * That is the difference between this file and a tautology. A test that read `single` out of the
 * module and looked for `single` in the markup would pass for any four displacements, including a
 * set whose mean square is not the number the lesson's paragraph prints. So the expected values
 * here are recomputed from the raw displacements and the raw account, and the drawn geometry is
 * checked against them too: the figure's outer side is asserted to be twice its cell side BECAUSE
 * the two root mean squares are in that ratio, which is the claim the picture makes by being to
 * scale.
 *
 * Every comparison of two computed reals goes through withinTolerance (src/units/tolerance.ts) with
 * both an absolute and a relative bound, never a hand-rolled ratio: a relative-only spec is invalid
 * at a true zero and an absolute-only one is invalid across orders of magnitude, and the module
 * refuses both rather than silently reading as disagreement.
 */

const FIGURES = [
  "bridge-equals-sign-relationship",
  "bridge-probability-notation",
  "bridge-squaring-square-roots",
] as const;

const TOLERANCE = { absolute: 1e-9, relative: 1e-9 } as const;
const rendered = new Map(
  FIGURES.map((id) => [id, renderToStaticMarkup(<FoundationConstruction foundationId={id} />)]),
);
const html = (id: (typeof FIGURES)[number]) => rendered.get(id) ?? "";

describe("the three bridge figures draw arithmetic a reader can check", () => {
  test("every one draws something, named for a screen reader, and none is operated", () => {
    expect(rendered.size).toBe(FIGURES.length);
    let drawings = 0;
    for (const id of FIGURES) {
      const markup = html(id);
      const svgs = markup.match(/<svg\b[^>]*>/g) ?? [];
      // One drawing each: each of the three lessons makes one claim that a picture can settle.
      expect(svgs.length, id).toBe(1);
      drawings += svgs.length;
      for (const svg of svgs) {
        expect(svg, id).toContain('role="img"');
        const label = svg.match(/aria-label="([^"]*)"/)?.[1] ?? "";
        expect(label.length, `${id}: ${svg}`).toBeGreaterThan(80);
      }
      expect(markup, id).toContain("construction-text-equivalent");
      expect(markup, id).toContain("What it shows, in words");
      expect(markup.match(/<(?:button|input|select|textarea)\b/), id).toBe(null);
      expect(CONSTRUCTIONS_WITH_CONTROLS.includes(id), id).toBe(false);
    }
    expect(drawings).toBe(3);
  });

  test("none of them gives the no-algebra route algebra", () => {
    for (const id of FIGURES) {
      expect(html(id).includes("katex"), id).toBe(false);
      expect(html(id).includes("<math"), id).toBe(false);
      expect(/\$[^$]+\$/.test(html(id)), id).toBe(false);
    }
  });

  test("the account's two sides are one length, recomputed rather than restated", () => {
    // The drawing puts both rows at one scale, so a record whose parts did not add to the whole
    // would draw a lower bar that overran the upper one and still print a balance underneath.
    const verdict = withinTolerance(ACCOUNT.kept + ACCOUNT.sent, ACCOUNT.before, TOLERANCE);
    expect(verdict.ok, `${ACCOUNT.kept} + ${ACCOUNT.sent} against ${ACCOUNT.before}`).toBe(true);
    const markup = html("bridge-equals-sign-relationship");
    for (const value of [ACCOUNT.before, ACCOUNT.kept, ACCOUNT.sent])
      expect(markup, String(value)).toContain(String(value));
    // The subtraction the lesson rearranges to, drawn as the one stretch beyond the cut. The
    // component writes &minus; and React serialises it as U+2212, so the assertion reads the
    // character a reader gets rather than the entity the source spells it with.
    expect(markup).toContain(`${ACCOUNT.before} − ${ACCOUNT.kept}`);
  });

  test("the four outcomes are generated, and exactly one of them is the favoured one", () => {
    const all = outcomes(TOKENS);
    expect(all.length).toBe(2 ** TOKENS);
    const bothLeft = all.filter((o) => o.every((half) => half === "left"));
    expect(bothLeft.length).toBe(1);
    // Non-vacuity, on purpose: a generator returning one outcome per token would also give four
    // for two tokens, so the distinct pairs are counted rather than the rows.
    expect(new Set(all.map((o) => o.join("-"))).size).toBe(all.length);
    expect(all.every((o) => o.length === TOKENS)).toBe(true);
    // Four tokens, the lesson's own second step: 16 outcomes and still exactly one all-left.
    expect(outcomes(4).length).toBe(16);
    expect(outcomes(4).filter((o) => o.every((h) => h === "left")).length).toBe(1);
    const markup = html("bridge-probability-notation");
    expect(markup).toContain(`one of the ${all.length}`);
    // One box per outcome, each with one divider between its halves.
    expect((markup.match(/class="bridge-bar-whole"/g) ?? []).length).toBe(all.length);
    expect((markup.match(/class="bridge-grid"/g) ?? []).length).toBe(all.length);
    // Two tokens in every box, and one wash and one triangle in the whole figure.
    expect((markup.match(/class="bridge-dot-moved"/g) ?? []).length).toBe(all.length * TOKENS);
    expect((markup.match(/class="bridge-bar-share"/g) ?? []).length).toBe(1);
    expect((markup.match(/class="bridge-marker"/g) ?? []).length).toBe(1);
  });

  test("four cells of the mean square fill the mean square of twice the displacement", () => {
    const single = meanSquare(DISPLACEMENTS);
    const doubled = meanSquare(DISPLACEMENTS.map((d) => d * 2));
    // The claim, recomputed from the displacements: doubling every one quadruples the mean square.
    expect(withinTolerance(doubled, 4 * single, TOLERANCE).ok, `${doubled} against ${single}`).toBe(
      true,
    );
    // And doubles the root, which is the same statement about lengths and the reason for the cells.
    const side = rootMeanSquare(DISPLACEMENTS);
    const outer = rootMeanSquare(DISPLACEMENTS.map((d) => d * 2));
    expect(withinTolerance(outer, 2 * side, TOLERANCE).ok, `${outer} against ${side}`).toBe(true);
    const markup = html("bridge-squaring-square-roots");
    // Four cells, each labelled with the mean square, and the total said once.
    expect((markup.match(new RegExp(`>${single}</text>`, "g")) ?? []).length).toBe(4);
    expect(markup).toContain(`four cells, so ${doubled} in all`);
    expect(markup).toContain(`side ${outer.toFixed(3)}`);
    expect((markup.match(new RegExp(`>${side.toFixed(3)}</text>`, "g")) ?? []).length).toBe(2);
    // The geometry is to scale: the drawn outer side is exactly two drawn cell sides, which is
    // what lets a reader read the ratio off the picture instead of taking it from the caption.
    const square = markup.match(/class="bridge-bar-whole"[^>]*width="(\d+(?:\.\d+)?)"/)?.[1];
    const shaded = markup.match(/class="bridge-bar-share"[^>]*width="(\d+(?:\.\d+)?)"/)?.[1];
    expect(square, "the outer square's drawn width").toBeDefined();
    expect(shaded, "the shaded cell's drawn width").toBeDefined();
    expect(withinTolerance(Number(square), 2 * Number(shaded), TOLERANCE).ok).toBe(true);
  });

  test("a displacement set with a different mean square would move all three of these", () => {
    // The positive control for the assertions above: they are computed, so a changed example moves
    // them. If this went green with the same numbers as the lesson, the checks above would be
    // restating the module to itself.
    const wider = DISPLACEMENTS.map((d) => d * 3);
    expect(withinTolerance(meanSquare(wider), 9 * meanSquare(DISPLACEMENTS), TOLERANCE).ok).toBe(
      true,
    );
    expect(meanSquare(wider)).not.toBe(meanSquare(DISPLACEMENTS));
    expect(rootMeanSquare(wider)).not.toBe(rootMeanSquare(DISPLACEMENTS));
  });
});
