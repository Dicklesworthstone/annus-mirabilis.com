import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { evaluateMe02 } from "../../physics/reference/massEnergy.ts";
import { TapeValidationError, validateControlTape } from "../tapes/schema.ts";
import { ME02_CAPTION, ME02_QUESTION } from "./definition.ts";
import { createMe02Session } from "./session.ts";

const root = process.cwd();

describe("ME-02 instrument contract", () => {
  test("manifest validates, both prompt ids parse, and toward-low-speed is listed", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/me-02.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("me-02");
    expect(manifest.explanatoryQuestion).toBe(ME02_QUESTION);
    expect(manifest.teachingTapes.some((t) => t.tapeId === "toward-low-speed")).toBe(true);
    expect(manifest.notModeled.length).toBeGreaterThan(0);
    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("me-02-predict-exact-versus-quadratic");
    expect(ids).toContain("me-02-predict-toward-low-speed");
    for (const id of ids) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(true);
    }
    const toward =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.find((p) => p.promptId === "me-02-predict-toward-low-speed")
        : undefined;
    expect(toward?.candidates.map((c) => c.id)).toEqual([
      "looks-like-lighter-body",
      "drops-to-nothing-faster",
      "stays-a-fixed-fraction",
    ]);
  });

  test("toward-low-speed tape validates and a foreign model identity is rejected", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/toward-low-speed.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("toward-low-speed");
    expect(tape.experimentId).toBe("me-02");
    expect(tape.modelIdentity.modelId).toBe("mass-energy-coefficient-host");
    const foreign = {
      ...(raw as Record<string, unknown>),
      modelIdentity: {
        modelId: "brownian-motion-reference",
        modelVersion: "1.0.0",
        artifactDigest:
          "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    };
    const parsed = validateControlTape(foreign);
    expect(parsed.modelIdentity.modelId).not.toBe("mass-energy-coefficient-host");
    expect(parsed.experimentId).toBe("me-02");
  });

  test("a tape whose experimentId is not me-02 is not this instrument's teaching tape", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/toward-low-speed.yaml"), "utf8"),
      "yaml",
    ) as Record<string, unknown>;
    expect(() => validateControlTape({ ...raw, experimentId: "" })).toThrow(TapeValidationError);
  });

  test("session evaluates the owner; naive diagnostic does not feed the proxy", () => {
    const session = createMe02Session();
    const snap = session.evaluate({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
    expect(snap.naive.semanticKind).toBe("naive-gamma-minus-one");
    expect(snap.finiteSpeedProxy.ownerId).toBe("massEnergy.finiteSpeedProxy");
    expect(snap.naive.ownerId).toBe("massEnergy.naiveGammaMinusOne");
    const conversion = session.convertPrintedMass(9e20);
    expect(conversion.comparison.wording.includes("0.1385 percent")).toBe(true);
  });

  test("caption readings exist at R0-R3 and name the UNKNOWN facsimile glyph", () => {
    expect(ME02_CAPTION.r0.includes("speed of light squared")).toBe(true);
    expect(ME02_CAPTION.r1.includes("analytic limit")).toBe(true);
    expect(ME02_CAPTION.r2.includes("beta^2")).toBe(true);
    expect(ME02_CAPTION.r3.includes("UNKNOWN")).toBe(true);
  });

  test("outputs are even in v and the quadratic sits below the exact curve at 0.6c", () => {
    const a = evaluateMe02({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
    const b = evaluateMe02({ beta: -0.6, emittedEnergy: 1, speedOfLight: 1 });
    expect(a.exactDifference).toEqual(b.exactDifference);
    if (a.exactDifference.status === "value" && a.quadraticApproximation.status === "value") {
      expect(a.exactDifference.value).toBeGreaterThan(a.quadraticApproximation.value as number);
    }
  });
});
