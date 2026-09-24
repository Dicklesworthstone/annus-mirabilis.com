import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_BM02_INPUTS } from "../../experiments/bm02/session";
import { OsmoticPartitionLab } from "./OsmoticPartitionLab";

describe("OsmoticPartitionLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<OsmoticPartitionLab example={DEFAULT_BM02_INPUTS} />);

  test("renders the default snapshot's real numbers, not placeholders", () => {
    // These come from computeBm02Snapshot, never hand-typed in the component. Same
    // digits as toExponential(6), drawn as a power of ten with a spoken name (Sci.tsx).
    expect(html).toContain(
      'aria-label="4.047373 times 10 to the power minus 6">4.047373\u202f×\u202f10<sup>−6</sup></span> Pa',
    ); // osmotic pressure
    expect(html).toContain(
      'aria-label="4.047373 times 10 to the power minus 14">4.047373\u202f×\u202f10<sup>−14</sup></span> N',
    ); // partition force
  });

  test("no number reaches the reader in toExponential's serialization", () => {
    expect(html).not.toMatch(/\d\.\d+e[-+]\d/);
  });

  test("has exactly one instrument root, addressable as bm-02", () => {
    expect(html).toContain('data-instrument-id="bm-02"');
  });

  test("labels the build's worked example static, and never claims a host or FrankenSim/WASM result", () => {
    expect(html).toContain('data-execution-label="static"');
    expect(html).toContain('<span class="badge">Static worked example</span>');
    expect(html).not.toContain('data-execution-label="host"');
    expect(html).not.toContain('data-execution-label="frankensim"');
  });

  test("includes a noscript notice so a no-JavaScript reader is never shown an empty box", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
  });

  test("notModeled is present and non-empty, shown as plain lines", () => {
    expect(html).toContain("What this model leaves out");
    expect(html).toContain("Particle interactions and excluded volume");
    expect(html).toContain("Molecular collisions with the wall");
  });

  test("every input is a typed text field, not a slider: the accessible equivalent is the default interface", () => {
    expect(html).not.toContain('type="range"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('inputMode="decimal"');
  });

  test("the model toggle names both models, including the classical expectation, without calling it refuted", () => {
    expect(html).toContain("Molecular-kinetic");
    expect(html).toContain("Classical expectation for suspended bodies");
  });

  test("the chamber illustration is labeled as an illustration, not a simulation", () => {
    expect(html).toContain("Illustration only");
  });

  test("show-the-code names the real owner module, not this component", () => {
    expect(html).toContain("src/physics/reference/diffusion/routeA.ts");
    expect(html).toContain("src/experiments/bm02/session.ts");
  });

  test("the predict prompt appears before the reader sees a computed answer bias", () => {
    expect(html).toContain("Predict before you calculate");
  });

  test("renders no script tags itself: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("OsmoticPartitionLab: dilute-domain refusal rendering", () => {
  test("an out-of-domain particle count renders the boundary, not a silent clamp", () => {
    const html = renderToStaticMarkup(
      <OsmoticPartitionLab
        example={{ ...DEFAULT_BM02_INPUTS, Np: 19_099, V_um3: 1_000_000, a_um: 0.5 }}
      />,
    );
    expect(html).toContain("Not modeled here");
    expect(html).toContain("admissible boundary is at most");
    expect(html).toContain("19,098");
  });
});

describe("OsmoticPartitionLab: classical-model rendering", () => {
  test("the classical model renders the fair-hearing note with the deciding evidence named", () => {
    const html = renderToStaticMarkup(
      <OsmoticPartitionLab
        example={{
          ...DEFAULT_BM02_INPUTS,
          model: "classical-thermodynamics-suspended-bodies",
        }}
      />,
    );
    expect(html).toContain("not a value this instrument calls refuted");
    expect(html).toContain("Perrin");
  });
});
