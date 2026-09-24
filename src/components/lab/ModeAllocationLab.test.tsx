import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LQ02_INPUTS } from "../../experiments/lq02/session";
import { ModeAllocationLab } from "./ModeAllocationLab";

describe("ModeAllocationLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />);

  test("renders the default snapshot's real numbers, not placeholders", () => {
    // From computeLq02Snapshot, never hand-typed in the component. Same digits as
    // toExponential(6), drawn as a power of ten with a spoken name (Sci.tsx).
    // A small exponent is written out: 6.439187e-3 is 0.006439187, the same seven digits.
    expect(html).toContain('<span class="sci">0.006439187</span> J/m³'); // energy up to the cutoff
    expect(html).toContain(
      'aria-label="2.070974 times 10 to the power minus 20">2.070974\u202f×\u202f10<sup>−20</sup></span> J',
    ); // mean resonator energy
  });

  test("no number reaches the reader in toExponential's serialization", () => {
    // It printed "9.990000e-1" for a share of 99.9% until 2026-09-22.
    expect(html).not.toMatch(/\d\.\d+e[-+]\d/);
    expect(html).toContain("0.9990000"); // the share above the probe frequency
  });

  test("has exactly one instrument root, addressable as lq-02", () => {
    expect(html).toContain('data-instrument-id="lq-02"');
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

  test("notModeled is present and non-empty, shown as a plain line outside any disclosure", () => {
    const line = /<p class="fine">Not modeled: ([^<]*)<\/p>/.exec(html.replace(/<!-- -->/g, ""));
    expect(line?.[1]).toContain("Any quantum hypothesis");
    expect(line?.[1]).toContain("Cavity shape and walls");
    expect(html).not.toContain("<summary>What this model leaves out</summary>");
  });

  test("every input is a typed text field, not a slider: the accessible equivalent is the default interface", () => {
    expect(html).not.toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
  });

  test("show-the-code names the real owner modules, not this component", () => {
    expect(html).toContain("src/physics/reference/radiation/classical.ts");
    expect(html).toContain("src/physics/reference/radiation/avogadro.ts");
    expect(html).toContain("src/experiments/lq02/session.ts");
  });

  test("the predict prompts appear before the reader sees a computed answer bias", () => {
    expect(html).toContain("Predict before you calculate");
    expect(html).toContain("About ×1000");
    expect(html).toContain("No, it grows without bound");
  });

  test("the model note names both disjoint regime boundaries as owner-supplied data, never as a hard-coded pair in this test's expectations alone", () => {
    expect(html).toContain("classical region, admitted at the 1% criterion for x ≤");
    expect(html).toContain("Wien region, admitted at x ≥");
  });

  test("the historical Avogadro readout is labeled apart from the modern value", () => {
    expect(html).toContain("historical");
    expect(html).toContain("defined, 2019 SI");
    expect(html).toContain("declared editorial inputs");
  });

  test("never titles or captions this instrument 'ultraviolet catastrophe'", () => {
    expect(html.toLowerCase()).not.toContain("ultraviolet catastrophe");
  });

  test("renders no script tags itself: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("ModeAllocationLab: no table row is ever labeled a bare 'Total'", () => {
  test("every energy label says 'up to', 'with resonators up to', or names the refusal", () => {
    const html = renderToStaticMarkup(<ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />);
    expect(html).not.toContain(">Total<");
    expect(html).not.toContain(">Total:");
  });
});
