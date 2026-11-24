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
import {
  INITIAL_RAMP_PARTITION,
  REFERENCE_RAMP_PARTITION,
} from "../../foundations/integrationStrips.ts";
import { CONSTRUCTIONS_WITH_CONTROLS } from "./constructionIds.ts";
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
  "derivatives",
  "frames-events",
  "mean-variance-rms",
  "error-and-inference",
  "bridge-a-graph",
  "bridge-sum-average",
  "bridge-negative-numbers-direction",
  "bridge-fractions-ratios",
  "bridge-scientific-notation-units",
] as const;

type BridgeLesson = (typeof BRIDGE_FIGURES)[number];

/**
 * Preserve the figures each lesson explains, rather than a global census that can be satisfied
 * by losing one drawing and adding an unrelated one elsewhere. The descriptions identify the
 * scientific subject, not generated React ids, coordinates or whole mutable captions. New figures
 * may be added, while each of these required subjects must still appear once in its own lesson.
 */
const REQUIRED_FIGURES: Readonly<Record<BridgeLesson, Readonly<Record<string, RegExp>>>> = {
  "flux-continuity": {
    "first-second-crossings": /^In one second, .* particles cross the left boundary/,
    "next-second-crossings": /^In the next second, .* particles cross the left boundary/,
  },
  "diffusion-equation": {
    "peak-and-dip": /^A wavy profile of dye along a tube,/,
    "spreading-bell": /^Two bell-shaped profiles of the same dye drawn over one another\./,
    "closed-tube-profile": /^Dye density along a closed tube,/,
  },
  "random-walks": {
    "four-two-step-walks": /^Four two-step walks drawn one above another/,
    "rms-growth": /^A graph with steps from 0 to .* The independent-step curve/,
  },
  "gaussian-distributions": {
    "reference-and-chosen-bells": /^Two centered bell curves on fixed axes/,
  },
  distributions: {
    "observation-histogram": /^A histogram of .* entered observations in/,
    "same-bin-two-units": /^Selected bin .* shown as one rectangle under two rulers\./,
  },
  integration: {
    "reference-strips": new RegExp(
      `^The same density rises .* These ${REFERENCE_RAMP_PARTITION.count} rectangles take the height`,
    ),
    "chosen-strips": new RegExp(
      `^The same density rises .* These ${INITIAL_RAMP_PARTITION.count} rectangles take the height`,
    ),
  },
  "taylor-expansion": {
    "strips-and-corner": /^A square of side .* with a thin strip added/,
    "three-expansion-steps": /^Three grown squares side by side at one scale,/,
  },
  derivatives: {
    "secants-and-tangent": /^A curve of position against time, rising more and more steeply\./,
    "shrinking-intervals": /^Four points plotted against the interval they were averaged over,/,
  },
  "frames-events": {
    "synchronous-clocks":
      /^Two clocks drawn as vertical lines .* the two clocks are synchronous by the rule\.$/,
    "fast-clock":
      /^Two clocks drawn as vertical lines .* clock B is .* seconds fast and setting it back/,
  },
  "mean-variance-rms": {
    "entered-observations": /^\d+ entered observations, each on its own row,/,
    "four-summary-lengths": /^Four lengths compared on one micrometre scale\./,
  },
  "error-and-inference": {
    "equal-area-different-shapes": /^Three rectangles side by side at one scale,/,
  },
  "bridge-a-graph": {
    "distance-against-time": /^A graph with time in seconds along the bottom/,
    "particle-end-positions": /^Four bars, each one particle tall,/,
  },
  "bridge-sum-average": {
    "same-total-shared-evenly": /^Two groups of four jars\./,
  },
  "bridge-negative-numbers-direction": {
    "signed-directions-and-return": /^A ruler numbered from minus four to plus four/,
  },
  "bridge-fractions-ratios": {
    "equivalent-shares": /^Two rows of dots with a bar under each\./,
  },
  "bridge-scientific-notation-units": {
    "length-and-area-powers": /^Two rulers of powers of ten, drawn at the same scale\./,
  },
};

function namedFigures(html: string) {
  return (html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? []).flatMap((markup) => {
    const opening = markup.slice(0, markup.indexOf(">") + 1);
    if (opening.includes('aria-hidden="true"') || !opening.includes('role="img"')) return [];
    return [{ markup, label: opening.match(/aria-label="([^"]*)"/)?.[1] ?? "" }];
  });
}

function figureIdentityProblems(id: BridgeLesson, html: string): readonly string[] {
  const named = namedFigures(html);
  const claimed = new Map<number, string>();
  const problems: string[] = [];
  for (const [identity, description] of Object.entries(REQUIRED_FIGURES[id])) {
    const matches = named.flatMap((figure, index) =>
      description.test(figure.label) ? [index] : [],
    );
    const index = matches[0];
    if (matches.length !== 1 || index === undefined) {
      problems.push(`${identity}: found ${matches.length} named figures`);
    } else if (claimed.has(index)) {
      problems.push(`${identity}: shares a drawing with ${claimed.get(index)}`);
    } else {
      claimed.set(index, identity);
    }
  }
  return problems;
}

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
      }
      // Every lesson keeps at least one named figure, so nothing can go dark behind aria-hidden.
      expect(namedHere, `${id}: no named figure`).toBeGreaterThan(0);
    }
    // And the decorative swatches are a real population, so the branch above is not dead code.
    expect(decorative).toBeGreaterThan(0);
  });

  test("each lesson retains the named scientific figures its explanation depends on", () => {
    for (const { id, html } of rendered) {
      expect(
        Object.keys(REQUIRED_FIGURES[id]).length,
        `${id}: no required subjects`,
      ).toBeGreaterThan(0);
      expect(figureIdentityProblems(id, html), id).toEqual([]);
    }
  });

  test("the identity guard rejects a replaced figure even when the old global count would pass", () => {
    const html = rendered.find((entry) => entry.id === "diffusion-equation")?.html ?? "";
    const figures = namedFigures(html);
    const bell = figures.find((figure) =>
      REQUIRED_FIGURES["diffusion-equation"]["spreading-bell"]?.test(figure.label),
    );
    const peak = figures.find((figure) =>
      REQUIRED_FIGURES["diffusion-equation"]["peak-and-dip"]?.test(figure.label),
    );
    expect(bell).toBeDefined();
    expect(peak).toBeDefined();
    const replaced = html.replace(bell?.markup ?? "", peak?.markup ?? "");
    expect(namedFigures(replaced).length).toBe(figures.length);
    expect(figureIdentityProblems("diffusion-equation", replaced)).toEqual([
      "peak-and-dip: found 2 named figures",
      "spreading-bell: found 0 named figures",
    ]);
  });

  test("an extra subject cannot hide a missing required one, and adding a figure alone is allowed", () => {
    const html = rendered.find((entry) => entry.id === "diffusion-equation")?.html ?? "";
    const bell = namedFigures(html).find((figure) =>
      REQUIRED_FIGURES["diffusion-equation"]["spreading-bell"]?.test(figure.label),
    );
    expect(bell).toBeDefined();
    const extra =
      '<svg role="img" aria-label="A different illustrative subject that does not describe any of the required dye profiles."><path d="M 0 0 L 1 1" /></svg>';
    expect(figureIdentityProblems("diffusion-equation", html + extra)).toEqual([]);
    const replaced = html.replace(bell?.markup ?? "", extra);
    expect(namedFigures(replaced).length).toBe(namedFigures(html).length);
    expect(figureIdentityProblems("diffusion-equation", replaced)).toEqual([
      "spreading-bell: found 0 named figures",
    ]);
    const hidden = html.replace(
      bell?.markup ?? "",
      (bell?.markup ?? "").replace('role="img"', 'aria-hidden="true"'),
    );
    expect(figureIdentityProblems("diffusion-equation", hidden)).toEqual([
      "spreading-bell: found 0 named figures",
    ]);
  });

  test("every one states its reading in words, under a heading", () => {
    for (const { id, html } of rendered) {
      expect(html, id).toContain("construction-text-equivalent");
      expect(html, id).toContain("What it shows, in words");
    }
  });

  test("no figure is operated, and a lesson that has an operated construction still says so", () => {
    // This asserted that NO lesson here renders a control, which was true while every one of these
    // lessons had only the figure I wrote. It stopped being true at foundation:derivatives, whose
    // nudge readout has buttons and was already in CONSTRUCTIONS_WITH_CONTROLS before the curve was
    // drawn beside it. The rule was right and the population was not: what must hold is that MY
    // FIGURES add no control, not that the lesson has none.
    let operated = 0;
    for (const { id, html } of rendered) {
      // Every drawing is inert: no control inside any svg, whatever else the lesson carries.
      for (const svg of html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? [])
        expect(
          svg.match(/<(?:button|input|select|textarea)\b/),
          `${id}: control inside a figure`,
        ).toBe(null);
      if (
        CONSTRUCTIONS_WITH_CONTROLS.includes(id as (typeof CONSTRUCTIONS_WITH_CONTROLS)[number])
      ) {
        operated += 1;
        // Its own notice is still there, so a reader without JavaScript is told the rest is inert.
        expect(html.includes("JavaScript is off"), id).toBe(true);
        continue;
      }
      expect(html.match(/<(?:button|input|select|textarea)\b/), id).toBe(null);
      expect(html.includes("JavaScript is off"), id).toBe(false);
    }
    // Both groups populated, so neither branch is dead: derivatives is operated, the rest are not.
    expect(operated).toBeGreaterThan(0);
    expect(operated).toBeLessThan(rendered.length);
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
