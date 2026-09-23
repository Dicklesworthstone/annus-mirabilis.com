import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ChargeCurrentPage from "../app/lab/sr-12/page.tsx";
import { ChargeCurrentLab } from "../components/lab/sr12/ChargeCurrentLab.tsx";
import { ChargeCurrentPlot } from "../components/lab/sr12/ChargeCurrentPlot.tsx";
import { createSr12Session, type PreparedSr12Example } from "../experiments/sr12/session.ts";
import rawExample from "../generated/sr12-example.json";
import { containsHeading } from "./headingText.ts";

/**
 * Heading assertions here compare case-insensitively AND are scoped to heading elements
 * (am-edit-voice-lint-trmf). They asserted the exact Title Case of a heading in order to
 * check that the SECTION IS PRESENT, so they broke when the de-slop pass moved these pages
 * to the site's sentence case while every section they protect was still rendering.
 *
 * containsHeading is the shared helper, not a local lowercase: text outside an h1-h6 cannot
 * satisfy it. That matters because the first repair of this kind WAS a local lowercase, and
 * it let an aria-label two elements away stand in for a heading that had been deleted.
 */

const example = rawExample as unknown as PreparedSr12Example;
// The speed of light in m/s, named here as ChargeCurrentLab names it: a .tsx module may not import
// src/physics/reference (the import-boundary gate).
const C_SI = 299_792_458;

describe("SR-12 Lab View & Route (am-sr-12-charge-current-bgq0)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<ChargeCurrentPage />);
    expect(html).toContain("Charge density is frame-dependent");
    expect(html).toContain("total charge is invariant");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain('data-instrument-id="sr-12"');
    expect(containsHeading(html, "A neutral wire carrying a current")).toBe(true);
    expect(html).toContain("Unit-system modernization");
    expect(html).toContain("Gaussian 1905 (§9)");
  });

  test("ChargeCurrentLab renders with worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<ChargeCurrentLab example={example} />);
    expect(html).toContain('data-instrument-id="sr-12"');
    expect(html).toContain("Neutral conductor (0.6c)");
    expect(html).toContain("Convection current (0.5c to 0.6c)");
    expect(html).toContain("Moving sphere (0.6c)");
    expect(html).toContain("Gaussian pulse continuity (0.5c)");
    expect(html).toContain("Current loop (0.6c)");
    expect(html).toContain("Four-current invariant");
    expect(html).toContain("Predict: is a neutral wire still neutral in a moving frame?");
  });

  // The table's OutputReading tested vectors for Float64Array, which the store never publishes, so
  // both current densities printed the word "value".
  test("the current-density vectors are printed as components", () => {
    const html = renderToStaticMarkup(<ChargeCurrentLab example={example} />);
    expect(html).not.toMatch(/data-quantity-id="[^"]+">value</);
    expect(html).toContain('data-quantity-id="currentDensityStationary">(1, 0, 0)<');
    expect(html).toContain('data-quantity-id="currentDensityMoving">(1.25, 0, 0)<');
  });

  // The drawing once put round(12γ) ions against round(12/γ) electrons in the moving frame, a net
  // POSITIVE wire printed beside the model's negative ρ′ and against the lab's own reveal. Its
  // J′ₓ also tested vectors for Float64Array, which the store never publishes, so it always
  // printed its fallback of 1 A/m². Both rows now follow the snapshot.
  test("the moving-frame wire is drawn with the sign of the model's ρ′, and shows its J′ₓ", () => {
    for (const [boost, more] of [
      [0.6, "electrons"],
      [-0.6, "ions"],
    ] as const) {
      const session = createSr12Session(`test-sr12-wire-${boost}`, example);
      session.apply({
        mode: "neutral-conductor",
        chargeDensity: 0,
        currentDensityX: 1,
        boost: boost * C_SI,
      });
      const snap = session.getSnapshot().accepted;
      if (!snap) throw new Error("expected an accepted snapshot");
      const out = (q: string) => snap.outputs.find((o) => o.quantityId === q);
      const rhoPrime = out("chargeDensityMoving");
      if (rhoPrime?.status !== "value" || typeof rhoPrime.value !== "number") {
        throw new Error("expected a numeric ρ′");
      }
      expect(Math.sign(rhoPrime.value)).toBe(more === "electrons" ? -1 : 1);
      const html = renderToStaticMarkup(
        <ChargeCurrentPlot
          rhoStationary={out("chargeDensityStationary")}
          rhoMoving={rhoPrime}
          jStationary={out("currentDensityStationary")}
          jMoving={out("currentDensityMoving")}
          lorentzFactor={out("lorentzFactor")}
          boostFraction={boost}
          mode="neutral-conductor"
        />,
      );
      const counts = /Wire in k: (\d+) positive ions and (\d+) electrons/.exec(html);
      if (!counts) throw new Error("expected the moving-frame wire's description");
      const ions = Number(counts[1]);
      const electrons = Number(counts[2]);
      if (more === "electrons") expect(electrons).toBeGreaterThan(ions);
      else expect(ions).toBeGreaterThan(electrons);
      // J′ with a lowered x (c5ac3b9c); no self-hosted face has ₓ.
      expect(html).toContain("J′<sub>x</sub> = 1.25 A/m²");
      expect(html).not.toContain("ₓ");
    }
  });
});
