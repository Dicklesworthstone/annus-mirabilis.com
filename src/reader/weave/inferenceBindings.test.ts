import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LQ06_OUTPUTS } from "../../experiments/lq06/definition.ts";
import { createLq06Session } from "../../experiments/lq06/session.ts";
import { ME01_DEFAULTS, ME01_OUTPUTS } from "../../experiments/me01/definition.ts";
import { createMe01Session } from "../../experiments/me01/session.ts";
import { ME02_DEFAULTS, ME02_OUTPUTS } from "../../experiments/me02/definition.ts";
import { createMe02Session } from "../../experiments/me02/session.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import { createSessionWeave, type SessionWeave } from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import { LQ06_READER_WEAVE } from "./coefficientMatchPassages.ts";
import { weaveContext } from "./context.ts";
import { ME01_READER_WEAVE } from "./ledgersPassages.ts";
import { ME02_READER_WEAVE } from "./massCoefficientPassages.ts";

function ready(state: SessionWeave) {
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected an accepted comparison");
  return state;
}

for (const [binding, outputs] of [
  [LQ06_READER_WEAVE, LQ06_OUTPUTS],
  [ME01_READER_WEAVE, ME01_OUTPUTS],
  [ME02_READER_WEAVE, ME02_OUTPUTS],
] as const) {
  test(`${binding.instrumentId}: critical inference pointers resolve to source sentences and declared outputs`, () => {
    const targets = new Set<string>();
    for (const passage of Object.values(binding.passages)) {
      const block = passage.sentenceId.replace(/-s\d+$/, "");
      const source = load(
        readFileSync(
          new URL(`../../../content/source-blocks/${binding.paper}/${block}.yaml`, import.meta.url),
          "utf8",
        ),
      ) as { sentenceSpans: readonly { id: string }[] };
      assert.ok(source.sentenceSpans.some(({ id }) => id === passage.sentenceId));
      targets.add(passage.sentenceId);
    }
    for (const predicate of binding.predicates) {
      expect(
        validateWeavePredicate(predicate, {
          instrumentOutputIds: new Set(Object.keys(outputs)),
          resolvableTargetIds: targets,
        }),
      ).toEqual(predicate);
      expect(checkPointerVoice(predicate)).toEqual([]);
      expect(binding.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
    }
  });
}

test("LQ-06: the owner's correspondence verdict lights algebra without treating arbitrary gas counts as equal entropies", () => {
  const session = createLq06Session("quantum-source");
  const source = createSessionWeave(session, LQ06_READER_WEAVE);
  expect(ready(source.getSnapshot()).derived.flags["lq06-s6-entropy-match"]?.lit).toBe(false);
  for (const [selectedSubexpression, lit] of [
    ["E", false],
    ["E_over_beta_nu", false],
    ["N_E_over_R_beta_nu", true],
    ["none", false],
  ] as const) {
    expect(session.apply({ selectedSubexpression }).kind).toBe("accepted");
    const state = ready(source.getSnapshot());
    expect(state.accepted).toBe(session.getSnapshot().accepted);
    expect(state.derived.flags["lq06-s6-entropy-match"]?.lit).toBe(lit);
    expect(state.derived.flags["lq06-s6-effective-count"]?.lit).toBe(true);
    expect(state.derived.flags["lq06-s6-mean-quantum-energy"]?.lit).toBe(true);
  }
});

test("LQ-06: switching to printed constants preserves their actual accepted identity and qualified interpretation", () => {
  const session = createLq06Session("quantum-constants");
  const source = createSessionWeave(session, LQ06_READER_WEAVE);
  const before = ready(source.getSnapshot());
  expect(
    session.apply({
      constantSetId: "einstein-1905-light-quanta-printed",
      selectedSubexpression: "N_E_over_R_beta_nu",
    }).kind,
  ).toBe("accepted");
  const after = ready(source.getSnapshot());
  const quantum = (state: typeof before) =>
    state.accepted.outputs.find(({ quantityId }) => quantityId === "quantumEnergy");
  expect(quantum(after)).not.toEqual(quantum(before));
  assert.equal(typeof LQ06_READER_WEAVE.constantSetId, "function");
  if (typeof LQ06_READER_WEAVE.constantSetId !== "function") return;
  expect(LQ06_READER_WEAVE.constantSetId(after.accepted)).toBe(
    "einstein-1905-light-quanta-printed",
  );
  expect(weaveContext(after.accepted, LQ06_READER_WEAVE.contextFields)).toContainEqual({
    id: "constantSetId",
    label: "Constants",
    value: "the paper's printed constants",
  });
  expect(after.derived.flags["lq06-s6-entropy-match"]?.lit).toBe(true);
  expect(after.derived.flags["lq06-s6-effective-count"]?.pointerText).toContain("as if");
});

test("ME-01: relaxing and restoring the offset premise changes only the supported inference, not the two balances", () => {
  const session = createMe01Session("ledgers-source");
  const source = createSessionWeave(session, ME01_READER_WEAVE);
  for (const premise of ["unchanged", "relaxed", "unchanged"] as const) {
    expect(session.apply({ ...ME01_DEFAULTS, premise }).kind).toBe("accepted");
    const state = ready(source.getSnapshot());
    expect(state.accepted).toBe(session.getSnapshot().accepted);
    expect(state.derived.flags["me01-two-energy-balances"]?.lit).toBe(true);
    expect(state.derived.flags["me01-unchanged-offset-premise"]?.lit).toBe(premise === "unchanged");
    expect(state.derived.flags["me01-offset-underdetermined"]?.lit).toBe(premise === "relaxed");
    expect(
      state.accepted.outputs.find(({ quantityId }) => quantityId === "kineticEnergyDifference")
        ?.status,
    ).toBe(premise === "unchanged" ? "value" : "underdetermined");
  }
});

test("ME-02: a low-speed approach is distinguished from an analytic limit, including exactly zero speed", () => {
  const session = createMe02Session("coefficient-source");
  const source = createSessionWeave(session, ME02_READER_WEAVE);
  const dispose = source.subscribe(() => {});
  // 0.04c lies between the 0.1% enter and 0.2% exit bounds. It cannot enter from
  // above, but holds after an accepted low-speed trial. No threshold arithmetic is copied here.
  for (const [beta, lit] of [
    [0.6, false],
    [0.04, false],
    [0.01, true],
    [0.04, true],
    [0.06, false],
    [-0.01, true],
    [0, false],
  ] as const) {
    expect(session.apply({ ...ME02_DEFAULTS, beta }).kind).toBe("accepted");
    const state = ready(source.getSnapshot());
    expect(state.accepted).toBe(session.getSnapshot().accepted);
    expect(state.derived.flags["me02-limiting-coefficient"]?.lit).toBe(true);
    expect(state.derived.flags["me02-coefficient-stabilized"]?.lit).toBe(lit);
    if (beta === 0) {
      expect(state.derived.flags["me02-coefficient-stabilized"]?.state).toBe("not-evaluable");
      expect(
        state.accepted.outputs.find(({ quantityId }) => quantityId === "finiteSpeedMassProxy")
          ?.status,
      ).toBe("not-applicable");
    }
  }
  dispose();
});

test("all three inference bindings withdraw missing, pending, refused and foreign publications", () => {
  for (const [binding, session] of [
    [LQ06_READER_WEAVE, createLq06Session("quantum-identity")],
    [ME01_READER_WEAVE, createMe01Session("ledger-identity")],
    [ME02_READER_WEAVE, createMe02Session("coefficient-identity")],
  ] as const) {
    const original = session.getSnapshot();
    assert.ok(original.accepted);
    let view: ExperimentView = original;
    const source = createSessionWeave(
      { getSnapshot: () => view, getServerSnapshot: () => original, subscribe: () => () => {} },
      binding,
    );
    for (const [patch, reason] of [
      [{ pending: true, status: "pending" }, "pending"],
      [{ status: "refused" }, "refused"],
      [{ accepted: { ...original.accepted, instanceId: "another-trial" } }, "wrong-instance"],
    ] as const) {
      view = { ...original, ...patch };
      expect(source.getSnapshot()).toEqual({ kind: "inactive", reason });
    }
    view = { ...original, accepted: { ...original.accepted, outputs: [] } };
    expect(
      Object.values(ready(source.getSnapshot()).derived.flags).every((flag) => !flag.lit),
    ).toBe(true);
  }
});
