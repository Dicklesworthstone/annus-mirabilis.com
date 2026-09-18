import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../../content/ids.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { evaluatePhotonBox } from "../../physics/reference/massEnergy.ts";
import { validateControlTape } from "../tapes/schema.ts";
import {
  ME03_BOX_MODEL,
  ME03_CAPTION,
  ME03_DEFAULTS,
  ME03_PROMPTS,
  type Me03Parameters,
} from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";
import { createMe03Session } from "./session.ts";

describe("ME-03 1906 Photon-in-a-box thought experiment", () => {
  test("canonical fixture (E = 1 J, l = 1 m, M = 1 kg) evaluates correctly", () => {
    const res = evaluatePhotonBox({ M: 1.0, ell: 1.0, E: 1.0, assignLightMass: true });
    expect(res.flightTimeValue).toBeCloseTo(3.33564095198152e-9, 15);
    expect(res.recoilSpeedValue).toBeCloseTo(3.33564095198152e-9, 15);
    expect(res.displacement).toBeCloseTo(-1.1126500560536185e-17, 23);
    expect(res.comShift).toBe(0);
    expect(res.exactRationalCenterOfMassShift.isExactlyZero).toBe(true);
    expect(res.pulseMomentum.status).toBe("value");
    if (res.pulseMomentum.status === "value") {
      expect(res.pulseMomentum.value).toBeCloseTo(3.33564095198152e-9, 15);
    }
    expect(res.lightMassAssigned.status).toBe("value");
    if (res.lightMassAssigned.status === "value") {
      expect(res.lightMassAssigned.value).toBeCloseTo(1.1126500560536185e-17, 23);
    }
    expect(res.domainRatio).toBeLessThanOrEqual(1e-3);
  });

  test("exact rational center of mass is identically zero with light mass, nonzero without", () => {
    const withMass = evaluatePhotonBox({ M: 1.0, ell: 1.0, E: 1.0, assignLightMass: true });
    expect(withMass.exactRationalCenterOfMassShift.isExactlyZero).toBe(true);
    expect(withMass.exactRationalCenterOfMassShift.numerator).toBe(0n);
    expect(withMass.exactRationalCenterOfMassShift.denominator).toBe(1n);
    expect(withMass.comShift).toBe(0);

    const withoutMass = evaluatePhotonBox({ M: 1.0, ell: 1.0, E: 1.0, assignLightMass: false });
    expect(withoutMass.exactRationalCenterOfMassShift.isExactlyZero).toBe(false);
    expect(withoutMass.exactRationalCenterOfMassShift.numerator).not.toBe(0n);
    expect(withoutMass.comShift).toBeCloseTo(-1.1126500560536185e-17, 23);
    expect(withoutMass.comShift).toBe(withoutMass.displacement);
  });

  test("domain refusal when E / (M c^2) > 1e-3, accepted when <= 1e-3", () => {
    const outside = validateMe03Parameters({
      ...ME03_DEFAULTS,
      mode: "box-1906",
      boxMass: 1.0,
      boxLength: 1.0,
      pulseEnergy: 1e14,
    });
    expect(outside.kind).toBe("refused");
    if (outside.kind === "refused") {
      expect(outside.refusal.code).toBe("invalid-parameter");
      expect(outside.refusal.details?.code).toBe("outside-domain");
    }

    const accepted = validateMe03Parameters({
      ...ME03_DEFAULTS,
      mode: "box-1906",
      boxMass: 1.0,
      boxLength: 1.0,
      pulseEnergy: 1.0,
    });
    expect(accepted.kind).toBe("accepted");
  });

  test("command classes: magnification preserves runId while toggling assignLightMass creates new run", () => {
    const boxParams: Me03Parameters = {
      ...ME03_DEFAULTS,
      mode: "box-1906",
      boxMass: 1.0,
      boxLength: 1.0,
      pulseEnergy: 1.0,
      assignLightMass: true,
      magnification: 1e17,
    };
    const session = createMe03Session("test-box-cmd-classes", boxParams);
    const initialRunId = session.getSnapshot().accepted?.runId;
    expect(initialRunId).toBeDefined();

    // 1. Changing magnification (presentation class)
    const magResult = session.apply({
      ...boxParams,
      magnification: 1e20,
    });
    expect(magResult.kind).toBe("accepted");
    const magRunId = session.getSnapshot().accepted?.runId;
    expect(magRunId).toBe(initialRunId); // runId preserved!

    // 2. Toggling assignLightMass (input class)
    const toggleResult = session.apply({
      ...boxParams,
      magnification: 1e20,
      assignLightMass: false,
    });
    expect(toggleResult.kind).toBe("accepted");
    const toggleRunId = session.getSnapshot().accepted?.runId;
    expect(toggleRunId).not.toBe(initialRunId); // new run created!
  });

  test("predict prompt for boxLightMass validates with 3 candidate IDs", () => {
    const prompt = ME03_PROMPTS.boxLightMass;
    expect(prompt.promptId).toBe("me-03-predict-box-light-mass");
    expect(parsePredictPromptId(prompt.promptId).ok).toBe(true);
    expect(prompt.candidates.length).toBe(3);
    expect(prompt.candidates.map((c) => c.id)).toEqual([
      "com-shifts",
      "com-stationary",
      "box-does-not-move",
    ]);
    expect(prompt.settledCandidateId).toBe("com-stationary");
  });

  test("the-1906-box teaching tape validates and rejects foreign model identity", () => {
    const tapePath = join(process.cwd(), "content/experiments/tapes/the-1906-box.yaml");
    const raw = strictParse(readFileSync(tapePath, "utf8"), "yaml") as Record<string, unknown>;
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("the-1906-box");
    expect(tape.experimentId).toBe("me-03");
    expect(tape.modelIdentity.modelId).toBe("me-03-box-1906-v1");

    const foreign = {
      ...raw,
      modelIdentity: {
        modelId: "me-03-boundary-ledger-v1",
        modelVersion: "1.0.0",
        artifactDigest: "host:sha256:1905-boundary-ledger-digest",
      },
    };
    const parsedForeign = validateControlTape(foreign);
    expect(parsedForeign.modelIdentity.modelId).not.toBe(ME03_BOX_MODEL.id);
  });

  test("caption audit verifies 1906 argument and Poincaré 1900 attribution", () => {
    expect(ME03_CAPTION.r1).toContain("1906 photon-in-a-box");
    expect(ME03_CAPTION.r1).toContain("Poincaré 1900");
    expect(ME03_CAPTION.r2).toContain("1906 box argument");
    expect(ME03_CAPTION.r3).toContain("1906 argument (credit: Poincaré 1900)");
  });
});
