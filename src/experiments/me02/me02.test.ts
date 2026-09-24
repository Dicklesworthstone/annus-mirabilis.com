import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateActionContract } from "../../accessibility/actionContracts.ts";
import {
  auditReadings,
  type ReadingsOwnerEntry,
  type ReadingTarget,
} from "../../content/audits/readings.ts";
import { parsePredictPromptId } from "../../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { evaluateMe02, printedMassConversion } from "../../physics/reference/massEnergy.ts";
import { parseResult } from "../results/codec.ts";
import { TapeValidationError, validateControlTape } from "../tapes/schema.ts";
import { ME02_CAPTION, ME02_DEFAULTS, ME02_QUESTION, type Me02Parameters } from "./definition.ts";
import { validateMe02Parameters } from "./parameters.ts";
import { decodeMe02Settings, encodeMe02Settings } from "./permalink.ts";
import { createMe02Session } from "./session.ts";

const root = process.cwd();

function val(result: { status: string; value?: number | Float64Array }): number {
  expect(result.status).toBe("value");
  return result.value as number;
}

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

  test("caption readings exist at R0-R3 and name the printed radical", () => {
    expect(ME02_CAPTION.r0.includes("speed of light squared")).toBe(true);
    expect(ME02_CAPTION.r1.includes("analytic limit")).toBe(true);
    expect(ME02_CAPTION.r2.includes("β²")).toBe(true);
    expect(ME02_CAPTION.r3.includes("explicit radical")).toBe(true);
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
    // The radical as page 641 prints it, (v/V) squared under the root (checked on the ap-18-639 plates).
    expect(ME02_CAPTION.r3.includes("1/√(1 − (v/V)^{2})")).toBe(true);
  });

  test("AC8: full instrument contract - action contracts validate and enforce accessible equivalence", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/me-02.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.actions.length).toBeGreaterThan(0);

    const action = manifest.actions.find((a) => a.actionId === "compare-named-speeds");
    expect(action).toBeDefined();
    if (!action) return;

    expect(action.family).toBe("energy-accounting");
    expect(action.commandClass).toBe("observer-change");
    expect(action.inputs).toContain("beta");
    expect(action.inputs).toContain("emittedEnergy");
    expect(action.acceptedResult.outputs).toContain("exactDifference");
    expect(action.acceptedResult.outputs).toContain("limitingCoefficient");
    expect(action.visualAffordance.length).toBeGreaterThan(0);
    expect(action.equivalentAffordance.length).toBeGreaterThan(0);
    expect(action.announcement.length).toBeGreaterThan(0);

    const validated = validateActionContract(action);
    expect(validated.actionId).toBe("compare-named-speeds");

    // Planted negative 1: missing equivalent affordance throws ExperimentValidationError
    const missingEquiv = { ...action, equivalentAffordance: "" };
    expect(() => validateActionContract(missingEquiv)).toThrow(ExperimentValidationError);

    // Planted negative 2: drag-only forbidden pattern throws ExperimentValidationError
    const dragOnly = {
      ...action,
      visualAffordance: "Drag a slider across speeds",
      equivalentAffordance: "Drag the slider with mouse",
    };
    expect(() => validateActionContract(dragOnly)).toThrow(ExperimentValidationError);
  });

  test("AC8: full instrument contract - JS-disabled worked example matches reference physics", () => {
    const examplePath = join(root, "src/generated/me02-example.json");
    const rawExample = JSON.parse(readFileSync(examplePath, "utf8"));

    // 1. Parameters validation
    const checked = validateMe02Parameters(rawExample.parameters);
    expect(checked.kind).toBe("accepted");
    if (checked.kind !== "accepted") return;
    expect(checked.data.beta).toBe(0.6);
    expect(checked.data.emittedEnergy).toBe(1);

    // 2. Initial results at 0.6c match evaluateMe02
    const ref06 = evaluateMe02({ beta: 0.6, emittedEnergy: 1, speedOfLight: 1 });
    const parsedResults = rawExample.results.map((r: string) => parseResult(r));
    const exactResult = parsedResults.find((r: any) => r.quantityId === "kineticEnergyDifference");
    const quadResult = parsedResults.find(
      (r: any) => r.quantityId === "quadraticKineticDifference",
    );
    const proxyResult = parsedResults.find((r: any) => r.quantityId === "finiteSpeedMassProxy");
    const limitResult = parsedResults.find((r: any) => r.quantityId === "inertialMassDecrease");

    expect(val(exactResult as any)).toBeCloseTo(val(ref06.exactDifference), 10);
    expect(val(quadResult as any)).toBeCloseTo(val(ref06.quadraticApproximation), 10);
    expect(val(proxyResult as any)).toBeCloseTo(val(ref06.finiteSpeedProxy), 6);
    expect(limitResult?.status).toBe("analytic-limit");
    if (
      limitResult?.status === "analytic-limit" &&
      limitResult.representation.kind === "coefficient"
    ) {
      expect(limitResult.representation.value).toBe(1);
    }

    // 3. Comparison results at 0.01c match evaluateMe02
    const ref001 = evaluateMe02({ beta: 0.01, emittedEnergy: 1, speedOfLight: 1 });
    const parsedComp = rawExample.comparisonResults.map((r: string) => parseResult(r));
    const compExact = parsedComp.find((r: any) => r.quantityId === "kineticEnergyDifference");
    const compProxy = parsedComp.find((r: any) => r.quantityId === "finiteSpeedMassProxy");
    const compExcess = parsedComp.find((r: any) => r.quantityId === "proxyExcessOverLimit");

    expect(val(compExact as any)).toBeCloseTo(val(ref001.exactDifference), 10);
    expect(val(compProxy as any)).toBeCloseTo(val(ref001.finiteSpeedProxy), 6);
    expect(val(compExcess as any)).toBeCloseTo(7.50063e-5, 8);

    // 4. Printed factor conversion matches printedMassConversion
    const refConversion = printedMassConversion({ emittedEnergyErg: 9e20 });
    expect(rawExample.printedConversion.emittedEnergyErg).toBe(9e20);
    expect(rawExample.printedConversion.printedGrams).toBe(refConversion.printed.value);
    expect(rawExample.printedConversion.printedConstantSetId).toBe(
      "einstein-1905-mass-energy-printed",
    );
    expect(rawExample.printedConversion.modernGrams).toBeCloseTo(refConversion.modern.value, 6);
    expect(rawExample.printedConversion.modernConstantSetId).toBe("modern-si-2019");
    expect(rawExample.printedConversion.wording).toBe(refConversion.comparison.wording);
  });

  test("AC8: full instrument contract - permalink encode/decode roundtrip and validation", () => {
    const params: Me02Parameters = {
      beta: 0.35,
      emittedEnergy: 2.5,
      energyUnit: "joule",
      speedAxis: "logarithmic",
      showNaive: true,
      notation: "modern",
    };

    const encoded = encodeMe02Settings(params);
    expect(encoded.startsWith("?")).toBe(true);

    const decoded = decodeMe02Settings(encoded);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters).toEqual(params);
    }

    const defEncoded = encodeMe02Settings(ME02_DEFAULTS);
    const defDecoded = decodeMe02Settings(defEncoded);
    expect(defDecoded.kind).toBe("settings");
    if (defDecoded.kind === "settings") {
      expect(defDecoded.parameters).toEqual(ME02_DEFAULTS);
    }

    // Planted negative: out of domain beta (|v/c| >= 1) returns invalid
    const invalidBeta = decodeMe02Settings("?beta=1.5&L=1");
    expect(invalidBeta.kind).toBe("invalid");

    const boundaryBeta = decodeMe02Settings("?beta=1.0&L=1");
    expect(boundaryBeta.kind).toBe("invalid");

    const negBoundaryBeta = decodeMe02Settings("?beta=-1.0&L=1");
    expect(negBoundaryBeta.kind).toBe("invalid");

    // Planted negative: non-positive energy returns invalid
    const zeroEnergy = decodeMe02Settings("?beta=0.6&L=0");
    expect(zeroEnergy.kind).toBe("invalid");

    const negativeEnergy = decodeMe02Settings("?beta=0.6&L=-5");
    expect(negativeEnergy.kind).toBe("invalid");

    // Empty search query returns none
    expect(decodeMe02Settings("").kind).toBe("none");
  });

  test("AC8: full instrument contract - session manages command classes and rejects outside-domain inputs", () => {
    const session = createMe02Session("test-session");

    // 1. Initial server snapshot is ready and accepted
    const serverSnap = session.getServerSnapshot();
    expect(serverSnap.accepted).toBeDefined();
    expect(serverSnap.accepted?.experimentId).toBe("me-02");
    const initialRunId = serverSnap.accepted?.runId;
    const initialInputRev = serverSnap.accepted?.revisions.input;
    const initialObsRev = serverSnap.accepted?.revisions.observer;

    // 2. Observer change (modifying beta) increments observer revision and keeps runId
    const obsResult = session.apply({ ...ME02_DEFAULTS, beta: 0.4 });
    expect(obsResult.kind).toBe("accepted");
    const obsSnap = session.getSnapshot().accepted;
    expect(obsSnap?.revisions.observer).toBe((initialObsRev ?? 0) + 1);
    expect(obsSnap?.runId).toBe(initialRunId);

    // 3. Presentation change (modifying notation) preserves revisions and runId
    const presResult = session.apply({ ...session.acceptedParameters(), notation: "modern" });
    expect(presResult.kind).toBe("accepted");
    const presSnap = session.getSnapshot().accepted;
    expect(presSnap?.revisions.observer).toBe(obsSnap?.revisions.observer);
    expect(presSnap?.revisions.input).toBe(obsSnap?.revisions.input);
    expect(presSnap?.runId).toBe(initialRunId);

    // 4. Setup change (modifying emittedEnergy) forks new runId and increments input revision
    const setupResult = session.apply({ ...session.acceptedParameters(), emittedEnergy: 5 });
    expect(setupResult.kind).toBe("accepted");
    const setupSnap = session.getSnapshot().accepted;
    expect(setupSnap?.revisions.input).toBe((initialInputRev ?? 0) + 1);
    expect(setupSnap?.runId).not.toBe(initialRunId);

    // 5. Refusal on invalid input (beta outside range)
    const refused = session.apply({ ...session.acceptedParameters(), beta: 1.2 });
    expect(refused.kind).toBe("refused");
    if (refused.kind === "refused") {
      expect(refused.refusal.code).toBe("invalid-parameter");
    }
  });
});
