import { describe, expect, it } from "bun:test";
import { LQ09_DEFAULTS } from "../experiments/lq09/definition.ts";
import { createLq09Session } from "../experiments/lq09/session.ts";

describe("LQ-09 Session Management (am-lq-09-ionization-mbul)", () => {
  it("initializes an instance store and publishes initial accepted outputs", () => {
    const session = createLq09Session("inst-lq09-test-01");
    const snapshot = session.getSnapshot();

    expect(snapshot.accepted).toBeDefined();
    expect(snapshot.accepted?.experimentId).toBe("lq-09");
    expect(snapshot.accepted?.instanceId).toBe("inst-lq09-test-01");
    expect(snapshot.accepted?.final).toBe(true);

    const outputs = snapshot.accepted?.outputs;
    expect(outputs).toBeDefined();

    const ionRateOutput = outputs?.find((o) => o.quantityId === "ionizationRate");
    expect(ionRateOutput).toBeDefined();
    expect(ionRateOutput?.status).toBe("value");
    if (ionRateOutput?.status === "value") {
      expect(ionRateOutput.value).toBeGreaterThan(0);
    }
  });

  it("updates outputs upon parameter application", () => {
    const session = createLq09Session("inst-lq09-test-02");

    // Apply higher frequency (3500 THz)
    const res = session.apply({
      ...LQ09_DEFAULTS,
      frequency: 3.5e15,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const qeOutput = snapshot.accepted?.outputs.find((o) => o.quantityId === "quantumEnergyEv");
    expect(qeOutput?.status).toBe("value");
    if (qeOutput?.status === "value") {
      // At 3500 THz, E_q ≈ 14.475 eV
      expect(qeOutput.value).toBeCloseTo(14.475, 1);
    }
  });

  it("produces not-applicable status when parameter update is below threshold", () => {
    const session = createLq09Session("inst-lq09-test-03");

    // Subthreshold frequency (2000 THz -> ~8.27 eV < 10 eV)
    const res = session.apply({
      ...LQ09_DEFAULTS,
      frequency: 2.0e15,
      ionizationEnergyEv: 10.0,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const ionRateOutput = snapshot.accepted?.outputs.find((o) => o.quantityId === "ionizationRate");
    expect(ionRateOutput?.status).toBe("not-applicable");
    if (ionRateOutput?.status === "not-applicable") {
      expect(ionRateOutput.reason).toBe("no single-quantum ionization under this hypothesis");
    }

    const ionCountOutput = snapshot.accepted?.outputs.find(
      (o) => o.quantityId === "ionizationCount",
    );
    expect(ionCountOutput?.status).toBe("not-applicable");
  });

  it("handles declared fraction mode and unknown mode in session", () => {
    const session = createLq09Session("inst-lq09-test-04");

    session.apply({
      ...LQ09_DEFAULTS,
      absorptionMode: "declared-fraction",
      declaredFraction: 0.25,
    });
    const snap1 = session.getSnapshot();
    const ionRate1 = snap1.accepted?.outputs.find((o) => o.quantityId === "ionizationRate");
    expect(ionRate1?.status).toBe("value");

    session.apply({
      ...LQ09_DEFAULTS,
      absorptionMode: "unknown",
    });
    const snap2 = session.getSnapshot();
    const ionRate2 = snap2.accepted?.outputs.find((o) => o.quantityId === "ionizationRate");
    expect(ionRate2?.status).toBe("underdetermined");
  });
});
