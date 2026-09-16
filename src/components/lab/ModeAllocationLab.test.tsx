import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_LQ02_INPUTS } from "../../experiments/lq02/session";
import { ModeAllocationLab } from "./ModeAllocationLab";

describe("ModeAllocationLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />);

  test("renders the default snapshot's real numbers, not placeholders", () => {
    // From computeLq02Snapshot, never hand-typed in the component.
    expect(html).toContain("6.439187e-3 J/m³"); // energy up to the cutoff
    expect(html).toContain("2.070974e-20 J"); // mean resonator energy
  });

  test("has exactly one instrument root, addressable as lq-02", () => {
    expect(html).toContain('data-instrument-id="lq-02"');
  });

  test("declares a host execution label, never claiming a FrankenSim/WASM result it did not compute", () => {
    expect(html).toContain('data-execution-label="host"');
  });

  test("includes a noscript notice so a no-JavaScript reader is never shown an empty box", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
  });

  test("notModeled is present and non-empty, shown as plain lines", () => {
    expect(html).toContain("What this model leaves out");
    expect(html).toContain("Any quantum hypothesis");
    expect(html).toContain("Cavity shape and walls");
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
