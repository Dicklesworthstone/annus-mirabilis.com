import { describe, expect, it } from "bun:test";
import { LQ08_DEFAULTS } from "../experiments/lq08/definition.ts";
import { createLq08Session } from "../experiments/lq08/session.ts";

describe("LQ-08 Session Management (am-lq-08-photoelectric-va5a)", () => {
  it("initializes an instance store and publishes initial accepted outputs", () => {
    const session = createLq08Session("inst-lq08-test-01");
    const snapshot = session.getSnapshot();

    expect(snapshot.accepted).toBeDefined();
    expect(snapshot.accepted?.experimentId).toBe("lq-08");
    expect(snapshot.accepted?.instanceId).toBe("inst-lq08-test-01");
    expect(snapshot.accepted?.final).toBe(true);

    const outputs = snapshot.accepted?.outputs;
    expect(outputs).toBeDefined();

    const stoppingOutput = outputs?.find((o) => o.quantityId === "stoppingPotentialMagnitude");
    expect(stoppingOutput).toBeDefined();
    expect(stoppingOutput?.status).toBe("value");
    if (stoppingOutput?.status === "value") {
      expect(stoppingOutput.value).toBeGreaterThan(0);
    }
  });

  it("updates outputs upon parameter application", () => {
    const session = createLq08Session("inst-lq08-test-02");

    // Apply higher frequency (800 THz)
    const res = session.apply({
      ...LQ08_DEFAULTS,
      frequency: 8.0e14,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const stoppingOutput = snapshot.accepted?.outputs.find(
      (o) => o.quantityId === "stoppingPotentialMagnitude",
    );
    expect(stoppingOutput?.status).toBe("value");
    if (stoppingOutput?.status === "value") {
      // At 800 THz, E_q = 3.3085 eV, Phi = 2.2 eV -> V_s ≈ 1.1085 V
      expect(stoppingOutput.value).toBeCloseTo(1.1085, 2);
    }
  });

  it("produces not-applicable status when parameter update is below threshold", () => {
    const session = createLq08Session("inst-lq08-test-03");

    // Subthreshold frequency (400 THz)
    const res = session.apply({
      ...LQ08_DEFAULTS,
      frequency: 4.0e14,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const stoppingOutput = snapshot.accepted?.outputs.find(
      (o) => o.quantityId === "stoppingPotentialMagnitude",
    );
    expect(stoppingOutput?.status).toBe("not-applicable");
    if (stoppingOutput?.status === "not-applicable") {
      expect(stoppingOutput.reason).toBe("no emitted electron in this model");
    }
  });
});
