import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LQ03_DEFAULTS, LQ03_NOT_MODELED } from "../../../experiments/lq03/definition.ts";
import { evaluateLq03 } from "../../../experiments/lq03/session.ts";
import { exponentialParts } from "../../../units/scientific.ts";
import { SpectrumComparison } from "./SpectrumLab.tsx";

/** What <Sci value digits /> draws: toExponential's digits as a raised power of ten. */
function drawn(value: number, digits: number): string {
  const parts = exponentialParts(value, digits);
  return parts.kind === "plain"
    ? parts.text
    : `${parts.mantissa}\u202f×\u202f10<sup>${parts.exponent}</sup>`;
}

describe("SpectrumLab: server-rendered markup shows real numbers without JavaScript (am-lq-03-spectrum-08vz)", () => {
  test("the default example renders real Planck/Wien/classical densities, not an empty box", () => {
    const example = {
      parameters: LQ03_DEFAULTS,
      evaluation: evaluateLq03(LQ03_DEFAULTS),
      sourceDigest: "src/physics/reference/radiation.ts",
    };
    const html = renderToStaticMarkup(<SpectrumComparison example={example} />);

    expect(html).toContain('data-instrument-id="lq-03"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("Ideal model, host calculation");

    // A real computed number reaches the markup, not a placeholder.
    const planck = evaluateLq03(LQ03_DEFAULTS).planck.frequency;
    if (planck.status === "value" && planck.linearRepresentable) {
      expect(html).toContain(drawn(planck.value, 6));
    }

    // notModeled is present as a plain line (BoldHarbor's requirement 4).
    expect(html).toContain("Not modeled:");
    for (const item of LQ03_NOT_MODELED) {
      expect(html).toContain(item);
    }

    // The noscript fallback exists (works without JavaScript).
    expect(html).toContain("<noscript");
    expect(html).toContain("complete worked example calculated when the site was built");

    // The action-contract equivalent is present as plain text, not hidden behind a canvas.
    expect(html).toContain("without dragging, color, or a canvas");
  });

  test("the peak mismatch (c/lambda_peak != nu_peak) is stated explicitly, not silently substituted", () => {
    const example = {
      parameters: LQ03_DEFAULTS,
      evaluation: evaluateLq03(LQ03_DEFAULTS),
      sourceDigest: "src/physics/reference/radiation.ts",
    };
    const html = renderToStaticMarkup(<SpectrumComparison example={example} />);
    expect(html).toContain("NOT the frequency-density peak");
    expect(html).toContain("different numbers on purpose");
  });

  test("a density outside double precision is drawn as a power of ten, never as a raw logarithm", () => {
    // At a 1e300 Hz probe the Planck and Wien densities underflow and the classical one overflows;
    // the table printed "below double-precision range; ln(value) = -9.598486147758314e+285".
    const parameters = { ...LQ03_DEFAULTS, probeNu: 1e300 };
    const example = {
      parameters,
      evaluation: evaluateLq03(parameters),
      sourceDigest: "src/physics/reference/radiation.ts",
    };
    const html = renderToStaticMarkup(<SpectrumComparison example={example} />);
    for (const leak of ["double-precision", "ln(value)", "NaN", "Infinity", "e+285"]) {
      expect(html).not.toContain(leak);
    }
    // The classical u_lambda at this probe is e^2644.13 J/(m³ m), written 2.147882 × 10^1148.
    expect(html).toContain("10<sup>1148</sup>");
  });
});
