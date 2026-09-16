import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  ME01_CAPTION,
  ME01_DEFAULTS,
  ME01_NOT_MODELED,
  ME01_PRESETS,
  ME01_PROMPTS,
  ME01_QUESTION,
  type Me01Parameters,
} from "./definition.ts";
import { decodeMe01Settings, encodeMe01Settings } from "./permalink.ts";
import { createMe01Session } from "./session.ts";

const root = process.cwd();

describe("ME-01 instrument contract (am-me-01-two-ledgers-g1re)", () => {
  test("manifest validates and has correct question, notModeled, and prompt", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/me-01.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("me-01");
    expect(manifest.explanatoryQuestion).toBe(ME01_QUESTION);
    expect(manifest.notModeled.length).toBe(7);
    expect(manifest.notModeled).toEqual([...ME01_NOT_MODELED]);

    // Check non-circularity: no mass parameter in schema
    const paramIds = manifest.parameters.map((p) => p.id);
    expect(paramIds).not.toContain("mass");
    expect(paramIds).not.toContain("restMass");
    expect(paramIds).not.toContain("M");

    // Check prompt grammar
    const promptId = ME01_PROMPTS.tiltAxis.promptId;
    const parsed = parsePredictPromptId(promptId);
    expect(parsed.ok).toBe(true);
    expect(ME01_PROMPTS.tiltAxis.candidates.length).toBe(3);
  });

  test("all presets resolve and reproduce stated values", () => {
    const session = createMe01Session();

    for (const preset of ME01_PRESETS) {
      const outcome = session.apply(preset.parameterValues);
      expect(outcome.kind).toBe("accepted");
      const current = session.acceptedParameters();
      expect(current.frameSpeed).toBe(preset.parameterValues.frameSpeed);
      expect(current.emissionAngle).toBe(preset.parameterValues.emissionAngle);
      expect(current.emittedEnergyRestFrame).toBe(preset.parameterValues.emittedEnergyRestFrame);
    }
  });

  test("command classes: observer change preserves runId; setup change advances runId; presentation changes preserve runId and scientific values", () => {
    const session = createMe01Session("me01-test-session", ME01_DEFAULTS);
    const initialSnap = session.getSnapshot();
    const initialRunId = initialSnap.accepted?.runId;
    expect(initialRunId).toBeDefined();

    // 1. Observer change: change observer speed v/c to 0.3
    const obsOutcome = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: 0.3,
    });
    expect(obsOutcome.kind).toBe("accepted");
    const obsSnap = session.getSnapshot();
    expect(obsSnap.accepted?.runId).toBe(initialRunId); // runId is preserved!
    expect(obsSnap.accepted?.snapshotVersion).toBeGreaterThan(
      initialSnap.accepted?.snapshotVersion ?? 0,
    );

    // 2. Setup change: change emission angle phi to 60 deg
    const setupOutcome = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: 0.3,
      emissionAngle: 60,
    });
    expect(setupOutcome.kind).toBe("accepted");
    const setupSnap = session.getSnapshot();
    expect(setupSnap.accepted?.runId).not.toBe(initialRunId); // new runId!
    const angleRunId = setupSnap.accepted?.runId;

    // 3. Presentation change: toggle notation
    const notOutcome = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: 0.3,
      emissionAngle: 60,
      notation: "modern",
    });
    expect(notOutcome.kind).toBe("accepted");
    const notSnap = session.getSnapshot();
    expect(notSnap.accepted?.runId).toBe(angleRunId); // runId preserved!

    // 4. Presentation change: step subtraction
    const stepOutcome = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: 0.3,
      emissionAngle: 60,
      notation: "modern",
      step: "sum-angle",
    });
    expect(stepOutcome.kind).toBe("accepted");
    const stepSnap = session.getSnapshot();
    expect(stepSnap.accepted?.runId).toBe(angleRunId); // runId preserved!
  });

  test("refusals: out-of-domain speeds and invalid inputs are refused", () => {
    const session = createMe01Session();

    // Speed >= 1.0
    const refSuperluminal = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: 1.0,
    });
    expect(refSuperluminal.kind).toBe("refused");
    if (refSuperluminal.kind === "refused") {
      expect(refSuperluminal.refusal.details?.code).toBe("superluminal-observer");
    }

    // Negative energy L <= 0
    const refNegL = session.apply({
      ...ME01_DEFAULTS,
      emittedEnergyRestFrame: -1,
    });
    expect(refNegL.kind).toBe("refused");

    // Nonfinite input
    const refNan = session.apply({
      ...ME01_DEFAULTS,
      frameSpeed: Number.NaN,
    });
    expect(refNan.kind).toBe("refused");
  });

  test("permalink encode and decode roundtrips", () => {
    const custom: Me01Parameters = {
      ...ME01_DEFAULTS,
      frameSpeed: 0.45,
      emissionAngle: 60,
      emittedEnergyRestFrame: 2.5,
      premise: "relaxed",
      notation: "modern",
    };

    const encoded = encodeMe01Settings(custom);
    expect(encoded.includes("v=0.45")).toBe(true);
    expect(encoded.includes("phi=60")).toBe(true);
    expect(encoded.includes("L=2.5")).toBe(true);
    expect(encoded.includes("premise=relaxed")).toBe(true);
    expect(encoded.includes("notation=modern")).toBe(true);

    const decoded = decodeMe01Settings(encoded);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.frameSpeed).toBe(0.45);
      expect(decoded.parameters.emissionAngle).toBe(60);
      expect(decoded.parameters.emittedEnergyRestFrame).toBe(2.5);
      expect(decoded.parameters.premise).toBe("relaxed");
      expect(decoded.parameters.notation).toBe("modern");
    }
  });

  test("caption readings R0-R3 exist and cover all requirements", () => {
    expect(ME01_CAPTION.r0.includes("Two equal flashes")).toBe(true);
    expect(ME01_CAPTION.r1.includes("E₀ - E₁ = L")).toBe(true);
    expect(ME01_CAPTION.r1.includes("γL")).toBe(true);
    expect(ME01_CAPTION.r2.includes("sum to 2")).toBe(true);
    expect(ME01_CAPTION.r2.includes("K₀ - K₁ = L(γ - 1)")).toBe(true);
    expect(ME01_CAPTION.r3.includes("1/√(1 - v²/V²)")).toBe(true);
    expect(ME01_CAPTION.r3.includes("source premise")).toBe(true);
  });
});
