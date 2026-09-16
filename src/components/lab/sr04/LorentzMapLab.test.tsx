import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SR04_DEFAULTS, SR04_NOT_MODELED } from "../../../experiments/sr04/definition.ts";
import { evaluateSr04 } from "../../../experiments/sr04/session.ts";
import { LorentzMapComparison } from "./LorentzMapLab.tsx";

describe("LorentzMapLab: server-rendered markup shows real numbers without JavaScript (am-sr-04-lorentz-map-px1k)", () => {
  test("the default example renders the Galilean shelf step with real numbers, not an empty box", () => {
    const example = {
      parameters: SR04_DEFAULTS,
      evaluation: evaluateSr04(SR04_DEFAULTS),
      sourceDigest: "src/physics/reference/kinematics.ts",
    };
    const html = renderToStaticMarkup(<LorentzMapComparison example={example} />);

    expect(html).toContain('data-instrument-id="sr-04"');
    expect(html).toContain('data-execution-label="host"');
    expect(html).toContain("Ideal model, host calculation");

    // The default has no constraints enabled: the Galilean residual-report renders.
    expect(html).toContain("Galilean candidate");

    // The slow case's real computed number reaches the markup.
    expect(html).toContain("-20 m/s");

    // notModeled is present as a plain line.
    expect(html).toContain("Not modeled:");
    for (const item of SR04_NOT_MODELED) {
      expect(html).toContain(item);
    }

    // The noscript fallback exists (works without JavaScript).
    expect(html).toContain("<noscript");
    expect(html).toContain("complete worked example calculated when the site was built");

    // The action-contract equivalent is present as plain text.
    expect(html).toContain("without dragging, color, or a canvas");

    // No answer preinstalled: gamma/rapidity are not shown unless showLaterAids is on
    // (SR04_DEFAULTS.showLaterAids is false).
    expect(html).not.toContain("Later aids (never a premise");
  });

  test("enabling all six constraints renders the fully-fixed map (1.25, 1.25, transverse 1)", () => {
    const parameters = {
      ...SR04_DEFAULTS,
      enabledConstraints: [
        "right-moving-light",
        "left-moving-light",
        "reciprocity",
        "isotropy",
        "identity-branch",
        "transverse-light",
      ] as const,
    };
    const example = {
      parameters,
      evaluation: evaluateSr04(parameters),
      sourceDigest: "src/physics/reference/kinematics.ts",
    };
    const html = renderToStaticMarkup(<LorentzMapComparison example={example} />);
    expect(html).toContain("1.250000");
  });
});
