import { describe, expect, it } from "bun:test";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { decodeLq06Settings, encodeLq06Settings } from "../experiments/lq06/permalink.ts";
import { createLq06Session, evaluateLq06 } from "../experiments/lq06/session.ts";

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

  it("correctly encodes and decodes permalink settings", () => {
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

    const decoded = decodeLq06Settings(search);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.radiationEnergy).toBeCloseTo(12e-9, 12);
      expect(decoded.parameters.frequency).toBeCloseTo(7.5e14, 0);
      expect(decoded.parameters.selectedSubexpression).toBe("N_E_over_R_beta_nu");
      expect(decoded.parameters.proposedEnergyElement).toBe("h_nu");
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
