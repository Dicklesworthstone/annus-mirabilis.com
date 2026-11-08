import { describe, expect, test } from "bun:test";
import { createLq02Session } from "./owner.ts";

describe("LQ-02 owns its accepted calculation and measurement identity", () => {
  test("moving the probe preserves the physical run and cutoff energy", () => {
    const session = createLq02Session("allocation-probe");
    const before = session.getSnapshot().accepted;
    const initial = session.getCalculation();
    expect(session.apply({ probeFrequency: 5e13 }).kind).toBe("accepted");
    const after = session.getSnapshot().accepted;
    expect(after?.runId).toBe(before?.runId);
    expect(after?.revisions.input).toBe(before?.revisions.input);
    expect(after?.revisions.measurement).toBe((before?.revisions.measurement ?? 0) + 1);
    expect(session.getCalculation().energyUpToCutoff).toEqual(initial.energyUpToCutoff);
    expect(session.getCalculation().shareAboveProbe).toMatchObject({
      status: "value",
      value: 0.875,
    });
    expect(session.getCalculation()).toBe(session.getCalculation());
    expect(after?.stepIndex).toBe(0);
  });

  test("tenfold widening starts a new setup and calculates the thousandfold energy", () => {
    const session = createLq02Session("allocation-cutoff");
    const before = session.getSnapshot().accepted;
    expect(session.apply({ nuCutoff: 1e15 }).kind).toBe("accepted");
    const after = session.getSnapshot().accepted;
    expect(after?.runId).not.toBe(before?.runId);
    expect(after?.parentRunId).toBe(before?.runId ?? null);
    const energy = after?.outputs.find((result) => result.quantityId === "energyUpToCutoff");
    expect(energy?.status).toBe("value");
    if (energy?.status === "value" && typeof energy.value === "number")
      expect(energy.value).toBeCloseTo(6.439187004807029, 12);
  });

  test("invalid inputs and the infinite-range question retain the finite accepted snapshot", () => {
    const session = createLq02Session("allocation-refusal");
    const before = session.getSnapshot();
    const calculation = session.getCalculation();
    expect(session.apply({ nuCutoff: -1 }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
    expect(session.removeUpperLimit()).toMatchObject({
      status: "outside-domain",
      condition: "classical-total-diverges",
    });
    expect(session.getSnapshot()).toBe(before);
    expect(session.getCalculation()).toBe(calculation);
  });

  test("an above-cutoff probe refuses only its share without replacing the run", () => {
    const session = createLq02Session("allocation-above");
    const run = session.getSnapshot().accepted?.runId;
    expect(session.apply({ probeFrequency: 2e14 }).kind).toBe("accepted");
    const view = session.getSnapshot();
    expect(view.accepted?.runId).toBe(run);
    expect(
      view.accepted?.outputs.find((result) => result.quantityId === "shareAboveProbe"),
    ).toMatchObject({ status: "outside-domain", condition: "probe-above-cutoff", unit: "1" });
    expect(
      view.accepted?.outputs.find((result) => result.quantityId === "energyUpToCutoff")?.status,
    ).toBe("value");
  });

  test("underflow gives a typed numerical result rather than a NaN share", () => {
    const session = createLq02Session("allocation-underflow");
    expect(session.apply({ T: 1e-300, nuCutoff: 1e-100, probeFrequency: 1e-101 }).kind).toBe(
      "accepted",
    );
    expect(
      session
        .getSnapshot()
        .accepted?.outputs.find((result) => result.quantityId === "shareAboveProbe"),
    ).toMatchObject({
      status: "outside-domain",
      condition: "cutoff-energy-underflow",
      domainKind: "numerical",
    });
  });

  test("starting another run with only a new probe still forks once and accepts the complete settings", () => {
    const session = createLq02Session("allocation-new-run");
    const initial = session.getSnapshot().accepted;
    expect(session.startNewRun({ probeFrequency: 5e13 }).kind).toBe("accepted");
    const next = session.getSnapshot().accepted;
    expect(next?.runId).not.toBe(initial?.runId);
    expect(next?.parentRunId).toBe(initial?.runId ?? null);
    expect(next?.parameters).toEqual({
      T: 1500,
      nuCutoff: 1e14,
      probeFrequency: 5e13,
      constantSetId: "modern-si-2019",
    });
    expect(next?.revisions.input).toBe((initial?.revisions.input ?? 0) + 1);
    expect(next?.revisions.measurement).toBe((initial?.revisions.measurement ?? 0) + 1);
  });
});
