import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RapidityAdder } from "../components/foundations/RapidityAdder.tsx";
import { addSpeeds, addTypedSpeeds } from "../foundations/rapidityAdder.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The rapidity adder of foundation:hyperbolic-functions-rapidity (am-found-linear-geometry-7w15):
 * summed rapidities must give §5's composition, computed independently, at every pair of speeds.
 */

const close = (actual: number, reference: number) =>
  expect(withinTolerance(actual, reference, { absolute: 1e-12, relative: 1e-12 }).ok).toBe(true);

describe("adding rapidities is §5's composition", () => {
  test("tanh of the summed rapidities equals (v + w)/(1 + vw) across the range, both signs", () => {
    const speeds = [-0.99, -0.6, -0.1, 0, 0.3, 0.6, 0.9, 0.99];
    let checked = 0;
    for (const v of speeds) {
      for (const w of speeds) {
        const sum = addSpeeds(v, w);
        close(sum.combined, sum.composition);
        expect(Math.abs(sum.combined)).toBeLessThan(1);
        checked += 1;
      }
    }
    expect(checked).toBe(64);
  });

  test("0.6c and 0.6c: rapidities ln 2 each, sum ln 4, speed 15/17, Galilean 1.2", () => {
    const sum = addSpeeds(0.6, 0.6);
    close(sum.firstRapidity, Math.LN2);
    close(sum.rapiditySum, Math.log(4));
    close(sum.combined, 15 / 17);
    close(sum.galilean, 1.2);
  });

  test("adversarial: the Galilean sum passes c where the composed speed does not", () => {
    const sum = addSpeeds(0.9, 0.9);
    expect(sum.galilean).toBeGreaterThan(1);
    expect(sum.combined).toBeLessThan(1);
  });
});

describe("what a reader types", () => {
  test("each speed is read like the matrices construction reads one, and a bad one is named", () => {
    const ok = addTypedSpeeds("0,6", "−0.6");
    expect(ok.status).toBe("added");
    if (ok.status === "added") close(ok.sum.combined, 0);
    const bad = addTypedSpeeds("0.6", "1");
    expect(bad.status === "refused" && bad.message).toContain("Second speed:");
    const worse = addTypedSpeeds("abc", "0.6");
    expect(worse.status === "refused" && worse.message).toContain("First speed:");
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(RapidityAdder));
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

  test("its first render, before any script runs, adds 0.6c to 0.6c", () => {
    expect(html).toContain('data-foundation-construction="hyperbolic-functions-rapidity"');
    expect(text).toContain("Rapidities: 0.6931 + 0.6931 = 1.3863.");
    expect(text).toContain("tanh(1.3863) = 0.8824: together the speeds make 0.8824c.");
    expect(text).toContain("gives 0.8824 as well");
    expect(text).toContain("would give 1.2000c, at or beyond the speed of light.");
  });

  test("each speed has typed entry beside its slider", () => {
    expect((html.match(/type="range"/g) ?? []).length).toBe(2);
    expect((html.match(/inputMode="decimal"/g) ?? []).length).toBe(2);
  });
});
