import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  crossings,
  FLUX_SECONDS,
  JARS,
  netChange,
  PARTICLE_ENDS,
  SHARES,
  WALK,
} from "../../foundations/bridgeFigures.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

/**
 * The five bridge figures (dispatch 401), held to the two obligations a picture carries here.
 *
 * constructionNoScript.test.tsx already requires the paragraph "What it shows, in words" of every
 * construction a reader OPERATES, because that paragraph is what a reader without JavaScript gets
 * instead of the controls. These five have no controls, so that test does not reach them, and a
 * figure that lost its words would have gone out silently: a drawing with no text alternative
 * fails exactly the reader the no-algebra route exists for. So it is required here instead.
 *
 * The second obligation is the one the dispatch called the whole product judgement: these lessons
 * must not be given algebra. A formula on a bridge page would make it worse at its only job, and
 * would also be invisible to a reader who came here because notation was the obstacle. The absence
 * is asserted rather than trusted.
 */

const BRIDGE_FIGURES = [
  // Not a bridge, and the list is no longer only bridges (dispatch 418): flux-continuity draws the
  // region and boundary its 22 formulas talk about. The obligations below are the same for it.
  "flux-continuity",
  "diffusion-equation",
  "random-walks",
  "gaussian-distributions",
  "distributions",
  "integration",
  "taylor-expansion",
  "bridge-a-graph",
  "bridge-sum-average",
  "bridge-negative-numbers-direction",
  "bridge-fractions-ratios",
  "bridge-scientific-notation-units",
] as const;

const rendered = BRIDGE_FIGURES.map((id) => ({
  id,
  html: renderToStaticMarkup(<FoundationConstruction foundationId={id} />),
}));

describe("the bridge lessons' figures", () => {
  test("every one draws something, and every drawing is either named or explicitly hidden", () => {
    // A figure's svg must carry role="img" and an authored aria-label. A DECORATIVE svg, such as
    // the colour swatch in a key, must carry neither and must be aria-hidden, or a screen reader
    // reads the key twice. An earlier version of this test required a name of every svg without
    // distinguishing the two, and the Gaussian figure's three swatches failed it correctly for the
    // wrong reason: the rule was right and the population was not. Both halves are now required,
    // which is stricter than what it replaced rather than looser.
    expect(rendered.length).toBe(BRIDGE_FIGURES.length);
    let drawings = 0;
    let decorative = 0;
    for (const { id, html } of rendered) {
      const svgs = html.match(/<svg\b[^>]*>/g) ?? [];
      expect(svgs.length, id).toBeGreaterThan(0);
      let namedHere = 0;
      for (const svg of svgs) {
        if (svg.includes('aria-hidden="true"')) {
          decorative += 1;
          // A hidden graphic must not also announce itself.
          expect(svg, `${id}: hidden svg carries a name`).not.toContain("aria-label");
          expect(svg, `${id}: hidden svg claims a role`).not.toContain('role="img"');
          continue;
        }
        expect(svg, id).toContain('role="img"');
        const label = svg.match(/aria-label="([^"]*)"/)?.[1] ?? "";
        // Long enough to describe a picture rather than name it: the shortest here is the jars.
        expect(label.length, `${id}: ${svg}`).toBeGreaterThan(80);
        namedHere += 1;
        drawings += 1;
      }
      // Every lesson keeps at least one named figure, so nothing can go dark behind aria-hidden.
      expect(namedHere, `${id}: no named figure`).toBeGreaterThan(0);
    }
    // Nineteen named drawings across twelve lessons; bridge-a-graph draws both of the graphs its
    // prose names, flux-continuity one panel per second, diffusion-equation the profile and then
    // the same dye later, and random-walks the four walks and then the square-root growth.
    expect(drawings).toBe(19);
    // And the decorative swatches are a real population, so the branch above is not dead code.
    expect(decorative).toBeGreaterThan(0);
  });

  test("every one states its reading in words, under a heading", () => {
    for (const { id, html } of rendered) {
      expect(html, id).toContain("construction-text-equivalent");
      expect(html, id).toContain("What it shows, in words");
    }
  });

  test("none of them is operated, so none needs the no-JavaScript notice", () => {
    for (const { id, html } of rendered) {
      expect(html.match(/<(?:button|input|select|textarea)\b/), id).toBe(null);
      expect(html.includes("JavaScript is off"), id).toBe(false);
    }
  });

  test("none of them gives the no-algebra route algebra", () => {
    for (const { id, html } of rendered) {
      expect(html.includes("katex"), id).toBe(false);
      expect(html.includes("<math"), id).toBe(false);
      // A raw dollar-delimited expression would mean unrendered LaTeX reached a reader.
      expect(/\$[^$]+\$/.test(html), id).toBe(false);
    }
  });

  test("each figure prints the numbers its lesson's prose states", () => {
    const find = (id: string) => rendered.find((r) => r.id === id)?.html ?? "";
    const jars = find("bridge-sum-average");
    // The jars, their total and their average: the arithmetic a reader is invited to count.
    expect(jars).toContain(JARS.join(" + "));
    expect(jars).toContain("8");
    const graph = find("bridge-a-graph");
    const last = WALK[WALK.length - 1] as (typeof WALK)[number];
    expect(graph).toContain(String(last.metres));
    expect(graph).toContain(String(last.seconds));
    expect(graph).toContain(PARTICLE_ENDS.join(", "));
    const shares = find("bridge-fractions-ratios");
    for (const row of SHARES) expect(shares).toContain(`${row.moved} of ${row.group}`);
    const places = find("bridge-scientific-notation-units");
    for (const symbol of ["cm", "mm", "μm"]) expect(places).toContain(symbol);
    expect(places).toContain("10⁻¹²");
    const ruler = find("bridge-negative-numbers-direction");
    expect(ruler).toContain("start");
    expect(ruler).toContain("+3");
    // The flux figure prints both crossings and the net it derives from them, never a typed net.
    const flux = find("flux-continuity");
    for (const second of FLUX_SECONDS) {
      expect(flux).toContain(`${second.entered} in`);
      expect(flux).toContain(`${second.left} out`);
      expect(flux).toContain(`${crossings(second)} crossed`);
    }
    expect(flux).toContain(`+${netChange(FLUX_SECONDS[0] as (typeof FLUX_SECONDS)[number])}`);
  });
});
