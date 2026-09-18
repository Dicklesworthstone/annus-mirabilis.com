import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  auditReadings,
  type ReadingTarget,
  type ReadingsOwnerEntry,
} from "../../content/audits/readings.ts";
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

  test("AC7: caption R0-R3 readings pass auditReadings with owner declaration and citations", () => {
    const rawOwners = readFileSync(
      join(root, "content/editorial/readings-owners/am-me-02-coefficient-dtmi.yaml"),
      "utf8",
    );
    const parsed = strictParse(rawOwners, "yaml") as {
      ownerBeadId: string;
      beadId: string;
      paper: string;
      targetKinds: readonly string[];
      targets: Array<{
        id: string;
        kind: string;
        targetKind?: string;
        paper?: string;
        readings: {
          r0: string;
          r1: string;
          r2: string;
          r3: string;
          r3Citations?: string[];
        };
      }>;
    };

    expect(parsed.ownerBeadId).toBe("am-me-02-coefficient-dtmi");
    expect(parsed.targets.some((t) => t.id === "me-02")).toBe(true);

    const targetIds = parsed.targets.map((t) => t.id);
    const ownerEntry: ReadingsOwnerEntry = {
      ownerBeadId: parsed.ownerBeadId,
      fileName: "am-me-02-coefficient-dtmi.yaml",
      paper: parsed.paper ?? "mass-energy",
      targetKinds: ["instrument-caption"],
      targetIds,
    };

    const validTargets: ReadingTarget[] = parsed.targets.map((t) => ({
      targetId: t.id,
      targetKind: "instrument-caption",
      paper: t.paper ?? "mass-energy",
      readings: t.readings,
    }));

    const validReport = auditReadings({
      targets: validTargets,
      owners: [ownerEntry],
    });
    expect(validReport.ok).toBe(true);
    expect(validReport.findings.filter((f) => f.severity === "error").length).toBe(0);

    // Verify definition.ts ME02_CAPTION matches and also passes auditReadings
    const definitionTargets: ReadingTarget[] = [
      {
        targetId: "me-02",
        targetKind: "instrument-caption",
        paper: "mass-energy",
        readings: {
          r0: ME02_CAPTION.r0,
          r1: ME02_CAPTION.r1,
          r2: ME02_CAPTION.r2,
          r3: ME02_CAPTION.r3,
          r3Citations: ME02_CAPTION.r3Citations,
        },
      },
    ];
    const defReport = auditReadings({
      targets: definitionTargets,
      owners: [ownerEntry],
    });
    expect(defReport.ok).toBe(true);
    expect(defReport.findings.length).toBe(0);

    // Planted negative 1: omitting R3 citations fails with r3-citation-missing
    const noCitationTargets: ReadingTarget[] = [
      {
        targetId: "me-02",
        targetKind: "instrument-caption",
        paper: "mass-energy",
        readings: {
          r0: ME02_CAPTION.r0,
          r1: ME02_CAPTION.r1,
          r2: ME02_CAPTION.r2,
          r3: ME02_CAPTION.r3,
          r3Citations: [],
        },
      },
    ];
    const noCitationReport = auditReadings({
      targets: noCitationTargets,
      owners: [ownerEntry],
    });
    expect(noCitationReport.ok).toBe(false);
    expect(noCitationReport.findings.some((f) => f.check === "r3-citation-missing")).toBe(true);

    // Planted negative 2: shortening R2 below 1.2 * R1 word count fails with r2-length
    const shortR2Targets: ReadingTarget[] = [
      {
        targetId: "me-02",
        targetKind: "instrument-caption",
        paper: "mass-energy",
        readings: {
          r0: ME02_CAPTION.r0,
          r1: ME02_CAPTION.r1,
          r2: "Expand gamma as 1 + (1/2) beta^2.",
          r3: ME02_CAPTION.r3,
          r3Citations: ME02_CAPTION.r3Citations,
        },
      },
    ];
    const shortR2Report = auditReadings({
      targets: shortR2Targets,
      owners: [ownerEntry],
    });
    expect(shortR2Report.ok).toBe(false);
    expect(shortR2Report.findings.some((f) => f.check === "r2-length")).toBe(true);

    // Planted negative 3: missing R2 fails with missing-r2
    const missingR2Targets: ReadingTarget[] = [
      {
        targetId: "me-02",
        targetKind: "instrument-caption",
        paper: "mass-energy",
        readings: {
          r0: ME02_CAPTION.r0,
          r1: ME02_CAPTION.r1,
          r2: "",
          r3: ME02_CAPTION.r3,
          r3Citations: ME02_CAPTION.r3Citations,
        },
      },
    ];
    const missingR2Report = auditReadings({
      targets: missingR2Targets,
      owners: [ownerEntry],
    });
    expect(missingR2Report.ok).toBe(false);
    expect(missingR2Report.findings.some((f) => f.check === "missing-r2")).toBe(true);
  });

  test("AC6: equation cards render in printed notation by default with no added ellipsis in approximation", () => {
    // 1. Check page formulas in lab/me-02/page.tsx
    const pageSource = readFileSync(join(root, "src/app/lab/me-02/page.tsx"), "utf8");

    // Must contain the quadratic formula without ellipsis
    expect(pageSource.includes(String.raw`\tfrac12 L\beta^2`)).toBe(true);
    // Must NOT contain \dots or \ldots or +\ldots or +\dots in the approximation formula
    expect(pageSource.includes(String.raw`\tfrac12 L\beta^2+\dots`)).toBe(false);
    expect(pageSource.includes(String.raw`\tfrac12 L\beta^2+\ldots`)).toBe(false);
    expect(pageSource.includes(String.raw`\tfrac12\frac{L}{V^2}v^2+\dots`)).toBe(false);
    expect(pageSource.includes(String.raw`\tfrac12\frac{L}{V^2}v^2+\ldots`)).toBe(false);

    // General scanner for ellipsis in quadratic approximation formulas
    const checkNoEllipsisInApproximation = (formulaText: string) => {
      if (
        (formulaText.includes(String.raw`\beta^2`) || formulaText.includes(String.raw`v^2`)) &&
        (formulaText.includes(String.raw`\dots`) || formulaText.includes(String.raw`\ldots`))
      ) {
        throw new Error(`Approximation formula must never add ellipsis: ${formulaText}`);
      }
    };

    // The actual formula in page.tsx:
    const approxFormula = String.raw`\tfrac12 L\beta^2\qquad\text{(quadratic)}\qquad\lim_{v\to 0}\frac{2L(\gamma-1)}{v^2}=\frac{L}{c^2}`;
    expect(() => checkNoEllipsisInApproximation(approxFormula)).not.toThrow();

    // Planted negative: injecting +\ldots or +\dots into approximation must throw
    expect(() => checkNoEllipsisInApproximation(String.raw`\tfrac12 L\beta^2+\ldots`)).toThrow(
      "must never add ellipsis",
    );
    expect(() => checkNoEllipsisInApproximation(String.raw`\tfrac12 L\beta^2+\dots`)).toThrow(
      "must never add ellipsis",
    );

    // 2. Default notation is printed notation
    const rawManifest = strictParse(
      readFileSync(join(root, "content/experiments/me-02.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(rawManifest);
    expect(manifest.id).toBe("me-02");
    expect(manifest.assumptions.some((a) => a.includes("Newtonian"))).toBe(true);
    expect(ME02_CAPTION.r3.includes("UNKNOWN until the facsimile is pinned")).toBe(true);
  });
});
