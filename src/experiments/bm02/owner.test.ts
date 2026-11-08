import { describe, expect, test } from "bun:test";
import { withHistoricalGuard } from "../../physics/reference/constants.ts";
import { createBm02Session } from "./owner.ts";

describe("BM-02 has one retained scientific owner", () => {
  test("all views read one immutable calculation and one identified accepted snapshot", () => {
    const session = createBm02Session("partition-one");
    const view = session.getSnapshot();
    const calculation = session.getCalculation();
    expect(view.accepted?.instanceId).toBe("partition-one");
    expect(view.accepted?.stepIndex).toBe(0);
    expect(view.accepted?.simulationTime).toBe(0);
    expect(session.getSnapshot()).toBe(view);
    expect(session.getCalculation()).toBe(calculation);
    expect(Object.isFrozen(calculation)).toBe(true);
    expect(Object.isFrozen(calculation.inputs)).toBe(true);
    expect(Object.isFrozen(calculation.osmoticPressure.result)).toBe(true);
    const unsubscribe = session.subscribe(() => {
      if (!session.getSnapshot().pending)
        expect(session.getCalculation().inputs.Np).toBe(session.acceptedParameters().Np);
    });
    expect(session.apply({ Np: 2000 }).kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).not.toBe(view.accepted?.runId);
    expect(session.getCalculation().inputs.Np).toBe(2000);
    expect(session.getCalculation().osmoticPressure.result).toMatchObject({
      status: "value",
      value: 8.094745087e-6,
    });
    unsubscribe();
  });

  test("a refused form preserves the entire accepted result and its run identity", () => {
    const session = createBm02Session("refused-partition");
    expect(session.apply({ T: 310, Np: 4000 }).kind).toBe("accepted");
    const before = session.getSnapshot();
    const calculation = session.getCalculation();
    expect(session.apply({ T: 0 }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
    expect(session.getCalculation()).toBe(calculation);
    expect(session.acceptedParameters().T).toBe(310);
  });

  test("crowded suspensions publish typed dependent refusals with their actual units", () => {
    const session = createBm02Session("crowded-partition");
    expect(session.apply({ Np: 19099 }).kind).toBe("accepted");
    const outputs = session.getSnapshot().accepted?.outputs ?? [];
    expect(outputs.find((result) => result.quantityId === "numberDensity")?.status).toBe("value");
    for (const [quantityId, unit] of [
      ["osmoticPressure", "Pa"],
      ["partitionForce", "N"],
      ["hydrostaticHead", "m"],
    ]) {
      const result = outputs.find((item) => item.quantityId === quantityId);
      expect(result).toMatchObject({ quantityId, unit, status: "outside-domain" });
      expect(result && "value" in result).toBe(false);
    }
  });

  test("historical constants are accepted by the owner without reading modern thermal constants", () => {
    const session = createBm02Session("historical-partition");
    withHistoricalGuard(() => {
      expect(session.apply({ constantSetId: "einstein-1905-brownian-printed" }).kind).toBe(
        "accepted",
      );
    });
    expect(session.getCalculation().thermalConstant.value).toBe(8.31 / 6e23);
    expect(session.acceptedParameters().constantSetId).toBe("einstein-1905-brownian-printed");
    const pressure = session
      .getSnapshot()
      .accepted?.outputs.find((result) => result.quantityId === "osmoticPressure");
    expect(pressure?.status).toBe("value");
    if (pressure?.status === "value" && typeof pressure.value === "number")
      expect(Math.abs(pressure.value / 4.0601275e-6 - 1)).toBeLessThan(1e-14);
  });

  test("same settings continue a run; an explicit new run has real lineage", () => {
    const session = createBm02Session("partition-lineage");
    const first = session.getSnapshot().accepted;
    expect(session.apply(session.acceptedParameters()).kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(first?.runId);
    expect(session.startNewRun(session.acceptedParameters()).kind).toBe("accepted");
    const next = session.getSnapshot().accepted;
    expect(next?.runId).not.toBe(first?.runId);
    expect(next?.parentRunId).toBe(first?.runId ?? null);
    expect(next?.outputs).toEqual(first?.outputs);
    expect(next?.stepIndex).toBe(0);
  });
});
