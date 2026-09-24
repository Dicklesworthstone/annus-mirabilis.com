import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TwoCurves } from "../components/foundations/TwoCurves.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";
import {
  EXPONENT_CHOICES,
  PLANE_HALF_WIDTH,
  radiusFrom,
  SPREAD_CHOICES,
  twoCurves,
} from "../foundations/twoCurves.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The two-measurements construction (am-found-statistics-inference-pzqv): "The node's output for a
 * single measurement is a curve and never a point, and a request for a unique a returns the typed
 * underdetermined status"; "reducing the angle between the curves widens the reported region, and
 * the node's text says why."
 */

const close = (a: number, b: number) =>
  withinTolerance(a, b, { absolute: 1e-12, relative: 1e-12 }).ok;

describe("one measurement gives a curve, never a point", () => {
  test("diffusion alone: asking for the radius returns the typed underdetermined status", () => {
    const radius = radiusFrom({ second: false, exponent: 3, spread: 0.05 });
    expect(radius.status).toBe("underdetermined");
    if (radius.status !== "underdetermined") throw new TypeError("expected underdetermined");
    expect(radius.neededInformation.join(" ")).toContain("a different combination of a and N");
    expect(twoCurves({ second: false, exponent: 3, spread: 0.05 }).status).toBe("curve");
  });

  test("a second measurement of the same combination, k = 1, is no help", () => {
    expect(radiusFrom({ second: true, exponent: 1, spread: 0.05 }).status).toBe("underdetermined");
  });

  test("with k = 3 the radius is a value with an enclosure, exp(±2s/(k − 1))", () => {
    const radius = radiusFrom({ second: true, exponent: 3, spread: 0.05 });
    if (radius.status !== "value" || radius.uncertainty?.kind !== "enclosure")
      throw new TypeError("expected a value with an enclosure");
    expect(close(radius.uncertainty.lower, Math.exp(-0.05))).toBe(true);
    expect(close(radius.uncertainty.upper, Math.exp(0.05))).toBe(true);
  });
});

describe("the overlap is exactly where both bands are", () => {
  for (const k of EXPONENT_CHOICES.filter((k) => k > 1))
    for (const s of SPREAD_CHOICES)
      test(`k = ${k}, spread ${s}: every corner lies on an edge of each band`, () => {
        const outcome = twoCurves({ second: true, exponent: k, spread: s });
        if (outcome.status !== "region") throw new TypeError("expected a region");
        for (const c of outcome.corners) {
          expect(close(Math.abs(c.y + c.x), s)).toBe(true);
          expect(close(Math.abs(c.y + k * c.x), s)).toBe(true);
        }
        expect(close(Math.log(outcome.radiusFactor.high), (2 * s) / (k - 1))).toBe(true);
        expect(close(Math.log(outcome.numberFactor.high), (s * (k + 1)) / (k - 1))).toBe(true);
      });
});

describe("the nearer parallel the bands, the wider the region", () => {
  test("for every spread, each step of k from 3 down to 1.2 widens both ranges", () => {
    for (const s of SPREAD_CHOICES) {
      const widths = EXPONENT_CHOICES.filter((k) => k > 1).map((k) => {
        const o = twoCurves({ second: true, exponent: k, spread: s });
        if (o.status !== "region") throw new TypeError("expected a region");
        return [o.radiusFactor.high / o.radiusFactor.low, o.numberFactor.high / o.numberFactor.low];
      });
      for (let i = 1; i < widths.length; i++) {
        expect((widths[i] as number[])[0]).toBeGreaterThan(
          (widths[i - 1] as number[])[0] as number,
        );
        expect((widths[i] as number[])[1]).toBeGreaterThan(
          (widths[i - 1] as number[])[1] as number,
        );
      }
    }
  });

  test("a region that runs off the drawing says so", () => {
    const wide = twoCurves({ second: true, exponent: 1.2, spread: 0.1 });
    const narrow = twoCurves({ second: true, exponent: 3, spread: 0.02 });
    expect(wide.status === "region" && wide.clipped).toBe(true);
    expect(narrow.status === "region" && narrow.clipped).toBe(false);
    expect(PLANE_HALF_WIDTH).toBe(Math.log(1.5));
  });

  test("inputs outside the choices are refused, not drawn", () => {
    expect(twoCurves({ second: true, exponent: 0.5, spread: 0.05 }).status).toBe("refused");
    expect(twoCurves({ second: true, exponent: 3, spread: 0 }).status).toBe("refused");
  });
});

describe("the construction renders completely without JavaScript", () => {
  const html = renderToStaticMarkup(<TwoCurves />);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  test("the default state states the region in words, with the text equivalent", () => {
    expect(text).toContain(
      "The radius lies between 0.95 and 1.05 times the true radius, and N between 0.90 and 1.11 times the true N.",
    );
    expect(text).toContain("not a probability");
    expect(text).toContain("What it shows, in words");
    expect(html).toContain('role="img"');
  });

  test("the dissertation's inversion is one link away, and the route it names exists", () => {
    // am-found-statistics-inference-pzqv's lane follows "the link to the companion record's
    // inversion"; until 2026-09-24 the lesson had none. The preview runs inferMolecularDimensions.
    expect(html).toContain(
      '<a href="/lab/avogadro-lab/">molecular-dimensions companion preview</a>',
    );
    expect(existsSync(join(process.cwd(), "src/app/lab/avogadro-lab/page.tsx"))).toBe(true);
    expect(text).toContain("as printed in 1906 or as corrected in 1911");
  });

  test("its sentences pass the voice lint, and never name the typed status", () => {
    const blocks = [...html.matchAll(/<(p|legend|h\d)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) =>
      (m[2] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    expect(blocks.length).toBeGreaterThan(4);
    for (const block of blocks) {
      expect(block).not.toMatch(/underdetermined/i);
      const errors = checkVoice(block, { context: "prose" }).filter((f) => f.severity !== "info");
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    }
  });
});
