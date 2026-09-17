import { describe, expect, test } from "bun:test";
import {
  fillTemplate,
  TemplateValidationError,
  validateTemplate,
} from "../../a11y/descriptions/templates.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";

describe("templates: Layer 2 accessible graph description template engine (am-a11y-graph-descriptions-vxe1)", () => {
  test("renders quantityNormalization and elapsed time in ordinary language", () => {
    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1 },
      simulatedElapsedTime: { quantityId: "t", value: 12, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 4, represents: "none" },
      quantityNormalization: { kind: "per-bin-width", note: "per μm" },
    };
    const filled = fillTemplate("{simulatedElapsedTime}. {quantityNormalization}.", { scale });
    expect(filled).toContain("this frame shows");
    expect(filled).toContain("of model time");
    expect(filled).toContain("counts per bin width");
    expect(filled).not.toContain("per-bin-width");
  });

  test("fills template with quantity values, units, and constant-set naming", () => {
    const template =
      "Tracer root-mean-square displacement is {lambda_x} after {t} under {constantSet}. Status: {status}";

    const data = {
      quantities: {
        lambda_x: 0.7947833,
        t: 1.0,
      },
      units: {
        lambda_x: "μm",
        t: "s",
      },
      constantSetLabel: "Einstein's 1905 printed constants",
    };

    const filled = fillTemplate(template, data);
    expect(filled).toContain("0.794783 μm");
    expect(filled).toContain("1 s");
    expect(filled).toContain("Einstein's 1905 printed constants");
    expect(filled).toContain("Value calculated normally.");
  });

  test("renders typed status analytic-limit in ordinary language with NO enum name", () => {
    const template = "Diffusion state at t=0: {status}";

    const analyticLimitResult: ScientificResult = Object.freeze({
      quantityId: "density",
      unit: "1/m",
      semanticKind: "probability-density",
      ownerId: "diffusion",
      status: "analytic-limit" as const,
      representation: { kind: "point-mass" as const, location: 0, mass: 1 },
      description:
        "At initial time zero, the distribution is an exact Dirac delta limit with zero spatial variance.",
    });

    const data = {
      results: [analyticLimitResult],
    };

    const filled = fillTemplate(template, data);
    expect(filled).toContain(
      "At initial time zero, the distribution is an exact Dirac delta limit with zero spatial variance.",
    );
    expect(filled).not.toContain("analytic-limit");
  });

  test("renders underdetermined status with ordinary language explanation", () => {
    const template = "Inversion outcome: {status}";

    const underdeterminedResult: ScientificResult = Object.freeze({
      quantityId: "diffusivity",
      unit: "m^2/s",
      semanticKind: "diffusivity",
      ownerId: "diffusion",
      status: "underdetermined" as const,
      neededInformation: ["observation-duration", "viscosity"],
      compatibleFamily: "diffusivity-range",
    });

    const data = {
      results: [underdeterminedResult],
    };

    const filled = fillTemplate(template, data);
    expect(filled).toContain(
      "These observations do not select a unique value (diffusivity-range).",
    );
    expect(filled).not.toContain("underdetermined");
  });

  test("validates template and rejects missing snapshot slots", () => {
    const template = "Displacement is {lambda_x} at time {missing_time_slot}";

    expect(() => {
      validateTemplate(template, ["lambda_x", "t"]);
    }).toThrow(TemplateValidationError);

    try {
      validateTemplate(template, ["lambda_x", "t"]);
    } catch (err: unknown) {
      const e = err as TemplateValidationError;
      expect(e.missingSlot).toBe("missing_time_slot");
    }
  });

  test("renders representation-scale facts in ordinary language", () => {
    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 1000 },
      simulatedElapsedTime: { quantityId: "t", value: 1.0, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 4, represents: "none" },
      quantityNormalization: { kind: "per-bin-width" },
    };

    const template =
      "Scale facts: Magnification: {spatialMagnification}. Time: {simulatedElapsedTime}. Playback: {playbackMultiplier}. Glyphs: {glyphSize}. Normalization: {quantityNormalization}.";

    const filled = fillTemplate(template, { scale });
    expect(filled).toContain("Scene magnified ×1,000");
    expect(filled).toContain("1 second");
    expect(filled).toContain("true rate (1 s/s)");
    expect(filled).toContain("4 px marker (uncalibrated marker, not a physical particle size)");
    expect(filled).toContain("counts per bin width");
  });
});
