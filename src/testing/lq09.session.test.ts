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

describe("LQ-09 refuses a named gas without a citation before evaluating", () => {
  it("keeps the accepted snapshot and never publishes the owner's zero-filled refusal as values", () => {
    const session = createLq09Session("inst-lq09-uncited-gas");
    const before = session.getSnapshot().accepted;
    const res = session.apply({ ...LQ09_DEFAULTS, gasName: "Neon", gasCitation: "" });
    expect(res.kind).toBe("refused");
    // Before the refusal moved into validation, this was accepted and published quantumEnergyEv,
    // thresholdFrequency and excessEnergyEv as the value 0.
    expect(session.getSnapshot().accepted).toBe(before);
    const quantum = session
      .getSnapshot()
      .accepted?.outputs.find((o) => o.quantityId === "quantumEnergyEv");
    expect(
      quantum?.status === "value" && typeof quantum.value === "number" && quantum.value > 0,
    ).toBe(true);
  });

  it("accepts an unnamed gas, and a named gas with a citation", () => {
    const session = createLq09Session("inst-lq09-cited-gas");
    expect(session.apply({ ...LQ09_DEFAULTS, gasName: "", gasCitation: "" }).kind).toBe("accepted");
    expect(
      session.apply({ ...LQ09_DEFAULTS, gasName: "Neon", gasCitation: "A cited source" }).kind,
    ).toBe("accepted");
  });
});
