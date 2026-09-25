import { describe, expect, it } from "bun:test";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { decodeLq06Settings, encodeLq06Settings } from "../experiments/lq06/permalink.ts";
import { createLq06Session, evaluateLq06, lq06Outputs } from "../experiments/lq06/session.ts";

describe("LQ-06 Session Management & Evaluator (am-lq-06-coefficient-match-n8pe)", () => {
  it("initializes session with accepted snapshot and default outputs", () => {
    const session = createLq06Session("test-lq06-session");
    const snapshot = session.getSnapshot();

    expect(snapshot.accepted).not.toBeNull();
    expect(snapshot.accepted?.experimentId).toBe("lq-06");

    const outputs = snapshot.accepted?.outputs;
    expect(outputs).toBeDefined();

    const nEff = outputs?.find((o) => o.quantityId === "effectiveIndependentCount");
    expect(nEff?.status).toBe("value");
    if (nEff?.status === "value") {
      expect(nEff.value as number).toBeCloseTo(2.277774e10, -5);
    }

    const qe = outputs?.find((o) => o.quantityId === "quantumEnergyEv");
    expect(qe?.status).toBe("value");
    if (qe?.status === "value") {
      expect(qe.value as number).toBeCloseTo(2.4814, 3);
    }
  });

  it("handles subexpression matching and updates correspondence verdict", () => {
    const session = createLq06Session("test-matching");

    // Initially none selected -> verdict is not-applicable
    let snapshot = session.getSnapshot();
    let verdict = snapshot.accepted?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdict?.status).toBe("not-applicable");

    // Select correct subexpression N*E / (R*beta*nu) -> verdict is 1
    const res = session.apply({ selectedSubexpression: "N_E_over_R_beta_nu" });
    expect(res.kind).toBe("accepted");

    snapshot = session.getSnapshot();
    verdict = snapshot.accepted?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdict?.status).toBe("value");
    if (verdict?.status === "value") {
      expect(verdict.value).toBe(1);
    }

    // Select wrong subexpression E -> verdict is 0
    session.apply({ selectedSubexpression: "E" });
    snapshot = session.getSnapshot();
    verdict = snapshot.accepted?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdict?.status).toBe("value");
    if (verdict?.status === "value") {
      expect(verdict.value).toBe(0);
    }
  });

  it("refuses invalid parameters (negative frequency or energy)", () => {
    const session = createLq06Session("test-refusals");

    const negE = session.apply({ radiationEnergy: -1e-9 });
    expect(negE.kind).toBe("refused");

    const negNu = session.apply({ frequency: 0 });
    expect(negNu.kind).toBe("refused");

    const negGas = session.apply({ gasParticles: -5 });
    expect(negGas.kind).toBe("refused");
  });

  it("correctly encodes and decodes permalink settings with full round-trip parameter fidelity", () => {
    const params = {
      ...LQ06_DEFAULTS,
      radiationEnergy: 12e-9,
      frequency: 7.5e14,
      selectedSubexpression: "N_E_over_R_beta_nu" as const,
      proposedEnergyElement: "h_nu" as const,
      forkAChoice: "independent-quanta" as const,
    };

    const search = encodeLq06Settings(params);
    expect(search).toContain("e=12");
    expect(search).toContain("nu=750");
    expect(search).toContain("sub=N_E_over_R_beta_nu");

    // Exact round-trip verification: full parameter object match
    const decoded = decodeLq06Settings(search);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters).toEqual(params);
    }

    // Optional legacy lq key is supported without failing validation
    const withLegacyKey = decodeLq06Settings(`${search}&lq=1`);
    expect(withLegacyKey.kind).toBe("settings");
    if (withLegacyKey.kind === "settings") {
      expect(withLegacyKey.parameters).toEqual(params);
    }
  });

  it("evaluateLq06 returns complete set of scientific results", () => {
    const results = evaluateLq06(LQ06_DEFAULTS);
    expect(results.length).toBeGreaterThanOrEqual(16);

    const qIds = results.map((r) => r.quantityId);
    expect(qIds).toContain("radiationEnergy");
    expect(qIds).toContain("frequency");
    expect(qIds).toContain("volumeRatio");
    expect(qIds).toContain("effectiveIndependentCount");
    expect(qIds).toContain("quantumEnergy");
    expect(qIds).toContain("quantumEnergyEv");
    expect(qIds).toContain("radiationEntropy");
    expect(qIds).toContain("gasEntropy");
    expect(qIds).toContain("entropyVolumeCoefficient");
    expect(qIds).toContain("meanQuantumEnergyWien");
    expect(qIds).toContain("meanEnergyRatio");
  });
});

/**
 * Refusal sites in session.ts, one case per throw site (am-p465, am-kd9h).
 *
 * THE TWO parameters-rejected SITES ARE TOLD APART, not collected by one assertion. The code
 * appears at session.ts:30 and session.ts:110, and naming the code alone would credit both from
 * either case. They are distinguishable from outside: :30 is evaluateLq06 refusing settings handed
 * to the evaluator, :110 is createLq06Session refusing the parameters carried by a prepared
 * example, and each writes a different message. Both cases below drive their own entry point and
 * assert their own message.
 *
 * TWO OF THE FIVE SITES ARE UNREACHABLE and stay counted rather than covered:
 *   :75  "Missing output contract" - every key in the values record is a literal in this file, and
 *        all sixteen are declared in LQ06_OUTPUTS. Measured, not assumed. It guards a future
 *        rename in definition.ts.
 *   :148 the initial publication - its outputs come from evaluateLq06 and its contracts from
 *        LQ06_OUTPUTS, so they agree by construction, and the store's other refusals need a
 *        previous accepted snapshot that a first publish does not have. Ten accepted parameter
 *        sets across the envelope, including both volumeRatio ends, gasParticles 1 and 1e15, and
 *        a selected subexpression, all published. (Measured before the declared domain, which
 *        now stops n at 10⁶ and refuses 1e15 before it reaches the store.)
 * Neither code is named anywhere below, so no assertion here can collect a surplus credit for
 * a site no case drives.
 */
describe("LQ-06 session refusals (am-p465)", () => {
  const invalid = { ...LQ06_DEFAULTS, gasParticles: 0 };
  const prepared = (parameters: Record<string, unknown>) => ({
    sourceDigest: `source:sha256:${"a".repeat(64)}`,
    parameters,
    results: [] as readonly string[],
    stepIndex: 0,
    simulationTime: 0,
  });
  const refusalFrom = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return error as Error & { code?: string };
    }
    throw new Error("The settings were accepted when they should have been refused.");
  };

  it("refuses settings handed straight to the evaluator (session.ts:30)", () => {
    const err = refusalFrom(() => evaluateLq06(invalid));
    expect(err.code).toBe("parameters-rejected");
    expect(err.message).toContain("Invalid LQ-06 parameters.");
    expect(err.message).not.toContain("prepared");
  });

  it("refuses the parameters carried by a prepared example (session.ts:110)", () => {
    const err = refusalFrom(() => createLq06Session("lq06-refusal-prepared", prepared(invalid)));
    expect(err.code).toBe("parameters-rejected");
    expect(err.message).toContain("The prepared LQ-06 parameters are invalid.");
  });

  it("refuses a calculation that leaves the representable range (session.ts:68)", () => {
    // A subnormal radiation energy drives the entropy volume coefficient to zero. The declared
    // domain (from 1e-12 J, content/experiments/lq-06.yaml) now refuses it before any calculation,
    // so the guard is driven through lq06Outputs, the calculation without the parameter check.
    // The refusal names the quantity rather than emitting a 0.
    const unchecked = { ...LQ06_DEFAULTS, radiationEnergy: 1e-320 };
    expect(refusalFrom(() => evaluateLq06(unchecked)).code).toBe("parameters-rejected");
    const err = refusalFrom(() => lq06Outputs(unchecked));
    expect(err.code).toBe("outside-numeric-range");
    expect(err.message).toContain(
      "The entropyVolumeCoefficient calculation is outside the representable numeric range.",
    );
  });

  it("does not refuse a subnormal that still computes", () => {
    // The negative a naive "refuse anything small" implementation would fail: 1e-300 is subnormal
    // territory too, and the guard has to compute it, so the site above is a range check and not a
    // magnitude taboo. (The declared domain refuses 1e-300 J first; this is the guard alone.)
    const outputs = lq06Outputs({ ...LQ06_DEFAULTS, radiationEnergy: 1e-300 });
    expect(outputs.length).toBe(17);
    expect(outputs.every((o) => o.status === "value" || o.status === "not-applicable")).toBe(true);
  });
});
