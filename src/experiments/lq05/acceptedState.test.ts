import { expect, test } from "bun:test";
import { LQ05_DEFAULTS } from "./definition.ts";
import { createLq05Session } from "./session.ts";

const initial = { ...LQ05_DEFAULTS, trials: 32 };

test("display changes reuse the accepted sample and exact counts without changing their identity", () => {
  const session = createLq05Session("configuration-display", initial);
  const original = session.getSnapshot();
  expect(original.accepted.outputs).toBe(original.evaluation.outputs);
  expect(original.evaluation.probability.value).toBeCloseTo(1 / 16, 14);
  expect(original.evaluation.sampling.drawCountAfter).toBe(128);
  for (const display of ["sampling", "logarithmic", "enumeration"] as const) {
    expect(session.apply({ ...initial, view: display }).kind).toBe("accepted");
    const next = session.getSnapshot();
    expect(next.accepted.parameters.view).toBe(display);
    expect(next.accepted.runId).toBe(original.accepted.runId);
    expect(next.evaluation).toBe(original.evaluation);
    expect(next.accepted.outputs).toBe(next.evaluation.outputs);
    expect(session.getSnapshot()).toBe(next);
  }
  expect(session.getServerSnapshot()).toBe(original);
  expect(session.getServerSnapshot().accepted.parameters.view).toBe("enumeration");
});

test("changing the dependence model replaces both plot and scalar results, while refusal keeps both", () => {
  const session = createLq05Session("configuration-model", initial);
  const original = session.getSnapshot();
  expect(session.apply({ ...initial, locked: true }).kind).toBe("accepted");
  const locked = session.getSnapshot();
  expect(locked.evaluation).not.toBe(original.evaluation);
  expect(locked.evaluation.probability.value).toBe(0.5);
  expect(locked.evaluation.sampling.drawCountAfter).toBe(32);
  expect(locked.evaluation.distribution.terms.find((term) => term.k === 1)?.probability).toBe(0);
  expect(locked.accepted.outputs).toBe(locked.evaluation.outputs);
  expect(locked.accepted.outputs.find((output) => output.quantityId === "lnW")?.ownerId).toBe(
    "radiation.lockedPositionsProbability",
  );
  expect(session.apply({ ...initial, f: 0 }).kind).toBe("refused");
  const refused = session.getSnapshot();
  expect(refused.status).toBe("refused");
  expect(refused.accepted).toBe(locked.accepted);
  expect(refused.evaluation).toBe(locked.evaluation);
  expect(session.getServerSnapshot()).toBe(original);

  expect(session.apply({ ...initial, f: 0.25 }).kind).toBe("accepted");
  const quarter = session.getSnapshot();
  expect(quarter.evaluation.probability.value).toBeCloseTo(1 / 256, 14);
  expect(quarter.evaluation.sampling.f).toBe(0.25);
  expect(quarter.evaluation.sampling.drawCountAfter).toBe(128);
  expect(quarter.accepted.outputs).toBe(quarter.evaluation.outputs);
});

test("seed, sample size and point-count changes cannot reuse an old accepted evaluation", () => {
  const session = createLq05Session("configuration-sampling", initial);
  for (const changed of [
    { ...initial, seed: "98765" },
    { ...initial, trials: 17 },
    { ...initial, n: 10 },
  ]) {
    const before = session.getSnapshot();
    expect(session.apply(changed).kind).toBe("accepted");
    const after = session.getSnapshot();
    expect(after.evaluation).not.toBe(before.evaluation);
    expect(after.evaluation.sampling.seed).toBe(changed.seed);
    expect(after.evaluation.sampling.trials).toBe(changed.trials);
    expect(after.evaluation.sampling.n).toBe(changed.n);
    expect(after.accepted.outputs).toBe(after.evaluation.outputs);
  }
  expect(session.getSnapshot().evaluation.probability.value).toBeCloseTo(1 / 1024, 14);
});
