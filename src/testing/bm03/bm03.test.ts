import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  BM03_CAPTION,
  BM03_DEFAULTS,
  BM03_PRESETS,
  BM03_QUESTION,
} from "../../experiments/bm03/definition.ts";
import { validateBm03Parameters } from "../../experiments/bm03/parameters.ts";
import { decodeBm03Settings, encodeBm03Settings } from "../../experiments/bm03/permalink.ts";
import {
  buildBm03Snapshot,
  createBm03Session,
  evaluateBm03,
} from "../../experiments/bm03/session.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function numVal(r: { result: ScientificResult }): number {
  if (r.result.status !== "value" || typeof r.result.value !== "number") {
    throw new Error(`Expected scalar value status, got ${r.result.status}`);
  }
  return r.result.value;
}

describe("BM-03 configuration integral physics & instrument contract", () => {
  test("manifest validates, prompt id parses, and presets are present", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/bm-03.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("bm-03");
    expect(manifest.explanatoryQuestion).toBe(BM03_QUESTION);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("bm-03-predict-volume-factor");
    for (const id of ids) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(true);
    }
  });

  test("two particles at V/V0 = 2 give exact factor 4 and deltaF = -2 kB T ln 2", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 2,
      volumeRatio: 2,
      V0: 1_000_000,
      T: 293.15,
      model: "independent",
    });

    expect(evalResult.exactDecimalString).toBe("4");
    expect(evalResult.deltaF.result.status).toBe("value");
    const deltaF = numVal(evalResult.deltaF);
    const expectedDeltaF = -2 * 1.380649e-23 * 293.15 * Math.LN2;
    expect(deltaF).toBeCloseTo(expectedDeltaF, 24);
    expect(deltaF).toBeCloseTo(-5.61085e-21, 24);
  });

  test("one million particles evaluate in log-space without nonfinite numbers", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 1_000_000,
      volumeRatio: 2,
      V0: 1_000_000,
      T: 293.15,
      model: "independent",
    });

    expect(evalResult.deltaF.result.status).toBe("value");
    const deltaF = numVal(evalResult.deltaF);
    expect(deltaF).toBeCloseTo(-2.80542e-15, 18);
    expect(Number.isFinite(deltaF)).toBe(true);
    expect(Number.isFinite(evalResult.log10Exponent)).toBe(true);
    expect(Number.isFinite(evalResult.naturalLogExponent)).toBe(true);

    const snapshot = buildBm03Snapshot("inst-million", "run-1", {
      ...BM03_DEFAULTS,
      Np: 1_000_000,
      volumeRatio: 2,
    });
    for (const out of snapshot.outputs) {
      if (out.status === "value" && typeof out.value === "number") {
        expect(Number.isFinite(out.value)).toBe(true);
      }
    }
  });

  test("overflow guard: 1024 particles with ratio 2 produces log10 exponent 308.2547", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 1024,
      volumeRatio: 2,
    });

    const expectedLog10 = 1024 * (Math.LN2 / Math.LN10);
    expect(evalResult.log10Exponent).toBeCloseTo(308.2547, 4);
    expect(evalResult.log10Exponent).toBeCloseTo(expectedLog10, 10);

    // Standard double 2^1024 would overflow to Infinity
    const standardPower = 2 ** 1024;
    expect(standardPower).toBe(Infinity);
  });

  test("pressure matches BM-02 default and agrees with central difference", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 1000,
      volumeRatio: 1,
      V0: 1_000_000,
      T: 293.15,
    });

    expect(evalResult.pressure.result.status).toBe("value");
    const p = numVal(evalResult.pressure);
    expect(p).toBeCloseTo(4.0473725e-6, 12);

    // Independent finite difference check on free energy derivative:
    // p = - (F(V + eps) - F(V - eps)) / (2 eps)
    const V_m3 = 1_000_000 * 1e-18;
    const eps = 1e-4 * V_m3;
    const kT = 1.380649e-23 * 293.15;
    const F_plus = -1000 * kT * Math.log(V_m3 + eps);
    const F_minus = -1000 * kT * Math.log(V_m3 - eps);
    const p_diff = -(F_plus - F_minus) / (2 * eps);
    expect(p).toBeCloseTo(p_diff, 8);
  });

  test("locked cluster counterexample yields factor V/V0 and p = kB T / V", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 1000,
      volumeRatio: 2,
      V0: 1_000_000,
      T: 293.15,
      model: "locked-cluster",
    });

    expect(evalResult.exactDecimalString).toBe("2");
    expect(evalResult.lockedClusterPressure.result.status).toBe("value");
    const pLocked = numVal(evalResult.lockedClusterPressure);
    // At V = 2 * 10^6 μm³: p = kB T / (2 * 10^-12) = 2.02368627e-9 Pa
    expect(pLocked).toBeCloseTo(2.02368627e-9, 12);

    // At V = 10^6 μm³ (volumeRatio = 1): p = kB T / 10^-12 = 4.0473725e-9 Pa
    const evalAtV1M = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 1000,
      volumeRatio: 1,
      V0: 1_000_000,
      T: 293.15,
      model: "locked-cluster",
    });
    expect(numVal(evalAtV1M.lockedClusterPressure)).toBeCloseTo(4.0473725e-9, 12);

    // Independent pressure output is outside-domain under locked cluster
    expect(evalResult.pressure.result.status).toBe("outside-domain");
    if (evalResult.pressure.result.status === "outside-domain") {
      expect(evalResult.pressure.result.condition).toBe("independence-premise-removed");
    }
  });

  test("volume ratio 1 gives deltaF = 0 and factor 1", () => {
    const evalResult = evaluateBm03({
      ...BM03_DEFAULTS,
      Np: 2,
      volumeRatio: 1,
    });

    expect(evalResult.exactDecimalString).toBe("1");
    expect(evalResult.deltaF.result.status).toBe("value");
    expect(numVal(evalResult.deltaF)).toBe(0);
  });

  test("refusals on invalid parameters (non-integer, <=0, NaN, infinity)", () => {
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, Np: 0 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, Np: 2.5 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, volumeRatio: 0 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, volumeRatio: -1 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, V0: 0 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, T: -10 }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, Np: NaN }).kind).toBe("refused");
    expect(validateBm03Parameters({ ...BM03_DEFAULTS, volumeRatio: Infinity }).kind).toBe(
      "refused",
    );
  });

  test("symbolic outputs for J, momentum integrals, and F0", () => {
    const evalResult = evaluateBm03(BM03_DEFAULTS);
    expect(evalResult.volumeIndependentFactor.status).toBe("symbolic");
    expect(evalResult.momentumIntegrals.status).toBe("symbolic");
    expect(evalResult.freeEnergyOffset.status).toBe("symbolic");
  });

  test("session tracks revisions and command classes", () => {
    const session = createBm03Session("bm03-session-test");
    const initialView = session.getSnapshot();
    expect(initialView.status).toBe("accepted");
    const initialRunId = initialView.accepted?.runId;
    const initialInputRev = initialView.accepted?.revisions.input;

    // Presentation change (step only) -> input revision and runId unchanged
    session.apply({ ...session.acceptedParameters(), step: "derivative" });
    const stepView = session.getSnapshot();
    expect(stepView.accepted?.runId).toBe(initialRunId);
    expect(stepView.accepted?.revisions.input).toBe(initialInputRev);

    // Setup change (Np) -> input revision incremented and new runId
    session.apply({ ...session.acceptedParameters(), Np: 4 });
    const npView = session.getSnapshot();
    expect(npView.accepted?.runId).not.toBe(initialRunId);
    expect(npView.accepted?.revisions.input).toBe((initialInputRev ?? 0) + 1);
  });

  test("permalink encode and decode roundtrip", () => {
    const original = BM03_PRESETS["bm-03-locked-cluster"].parameters;
    const query = encodeBm03Settings(original);
    const decoded = decodeBm03Settings(query);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters).toEqual(original);
    }
  });

  test("caption readings R0-R3 exist and cover required commentary", () => {
    expect(BM03_CAPTION.r0.includes("Counting where independent particles can be")).toBe(true);
    expect(BM03_CAPTION.r1.includes("N_p k_B T / V")).toBe(true);
    expect(BM03_CAPTION.r2.includes("volume-independent factor J")).toBe(true);
    expect(BM03_CAPTION.r3.includes("2 kappa N = R")).toBe(true);
  });
});
