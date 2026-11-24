import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import source from "../../../content/equations/mass-energy/eq-model-me-finite-speed-proxy.json";
import {
  ME02_CLASSES,
  ME02_DEFAULTS,
  ME02_OUTPUTS,
  type Me02Parameters,
} from "../../experiments/me02/definition.ts";
import { snapshotOutputs } from "../../experiments/me02/session.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { EquationScope } from "../EquationScope.tsx";
import { parseEquationRecord } from "../record.ts";
import { compileEquation } from "../render.ts";
import { SemanticEquation } from "../SemanticEquation.tsx";
import {
  type EquationValueGroup,
  equationValueGroups,
  type LiveSlot,
  readBoundTermValue,
  readTermValue,
  resolveSlot,
} from "./values.ts";

beforeEach(installDom);
afterEach(uninstallDom);

const equation = compileEquation(
  parseEquationRecord(
    {
      ...source,
      schemaVersion: 2,
      bindings: ["baseline", "variant"].flatMap((instanceSlot) =>
        source.bindings.map((binding) => ({ ...binding, instanceSlot })),
      ),
    },
    "two independently accepted mass-energy trials",
  ),
);
const drop = equation.terms.find((term) => term.quantityId === "kineticEnergyDifference");
assert.ok(drop);
const dropSelector = `[data-term-value="${drop.termId}"]`;
const digest = `source:sha256:${"e".repeat(64)}`;

/** Real store publications from the mass-energy owner, with no replacement numerical kernel. */
function trial(id: string, slot: string, energy: number) {
  const parameters: Me02Parameters = {
    ...ME02_DEFAULTS,
    energyUnit: "joule",
    emittedEnergy: energy,
  };
  const store = createInstanceStore({
    experimentId: "me-02",
    instanceId: id,
    initialParameters: parameters,
    parameterClasses: ME02_CLASSES,
    outputs: ME02_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const decision = store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: snapshotOutputs(parameters),
  });
  assert.equal(decision.accepted, true);
  const initial = store.getSnapshot().accepted;
  assert.ok(initial);
  return {
    store,
    slot(): LiveSlot {
      const view = store.getSnapshot();
      return {
        slot,
        experimentId: "me-02",
        view,
        execution: deriveHostExecution(view, ME02_OUTPUTS, digest, view.accepted === initial),
      };
    },
  };
}

function groupFor(groups: readonly EquationValueGroup[], slot: string) {
  const group = groups.find((entry) => entry.instanceSlot === slot);
  assert.ok(group);
  return group;
}

function markup(slots: readonly LiveSlot[]) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <EquationScope slots={slots}>
      <SemanticEquation equation={equation} />
    </EquationScope>,
  );
  return container;
}

test("each comparison slot reads its own accepted result and named output", () => {
  const baseline = trial("baseline-instance", "baseline", 1);
  const variant = trial("variant-instance", "variant", 2);
  const groups = equationValueGroups(equation.bindings, [baseline.slot(), variant.slot()]);
  expect(readBoundTermValue(drop, groupFor(groups, "baseline")).text).toBe("0.25");
  expect(readBoundTermValue(drop, groupFor(groups, "variant")).text).toBe("0.5");

  const binding = groupFor(groups, "baseline").bindings.find(
    (entry) => entry.termId === drop.termId,
  );
  assert.ok(binding);
  // A same-quantity output exists, but the DECLARED output does not. It must not be substituted.
  expect(readTermValue(drop, baseline.slot(), { ...binding, outputId: "absent" }).kind).toBe(
    "symbolic",
  );
  expect(readTermValue(drop, variant.slot(), binding).kind).toBe("symbolic");
});

test("a repeated quantity cannot lend an unbound occurrence its value", () => {
  const baseline = trial("bound-occurrence", "baseline", 1);
  const group = groupFor(equationValueGroups(equation.bindings, [baseline.slot()]), "baseline");
  expect(readBoundTermValue(drop, group).kind).toBe("value");
  expect(readBoundTermValue({ ...drop, termId: `${drop.termId}-unbound` }, group).kind).toBe(
    "symbolic",
  );
  expect(
    readBoundTermValue(drop, { ...group, bindings: [...group.bindings, ...group.bindings] }).kind,
  ).toBe("symbolic");
});

test("missing and ambiguous trials never borrow another slot's output", () => {
  const baseline = trial("only-baseline", "baseline", 1);
  const duplicate = trial("duplicate-baseline", "baseline", 2);
  const missing = equationValueGroups(equation.bindings, [baseline.slot()]);
  expect(readBoundTermValue(drop, groupFor(missing, "baseline")).kind).toBe("value");
  expect(readBoundTermValue(drop, groupFor(missing, "variant")).kind).toBe("symbolic");
  const ambiguous = equationValueGroups(equation.bindings, [baseline.slot(), duplicate.slot()]);
  expect(groupFor(ambiguous, "baseline").resolution.kind).toBe("ambiguous");
  expect(readBoundTermValue(drop, groupFor(ambiguous, "baseline")).kind).toBe("symbolic");
});

test("slot labels cannot disguise a different experiment, instance or numerical owner", () => {
  const baseline = trial("identity-baseline", "baseline", 1);
  const other = trial("identity-other", "variant", 2);
  const wrongExperiment: LiveSlot = { ...baseline.slot(), experimentId: "bm-01" };
  expect(resolveSlot([wrongExperiment], "bm-01", "baseline").kind).toBe("unresolved");
  expect(readTermValue(drop, wrongExperiment).kind).toBe("symbolic");

  const own = baseline.slot();
  const wrongInstance: LiveSlot = {
    ...own,
    view: { ...own.view, requested: other.slot().view.requested },
  };
  expect(resolveSlot([wrongInstance], "me-02", "baseline").kind).toBe("unresolved");
  expect(readTermValue(drop, wrongInstance).kind).toBe("symbolic");
  expect(readTermValue(drop, { ...own, execution: { ...own.execution, owners: [] } }).kind).toBe(
    "symbolic",
  );
});

test("pending and refused updates retain each trial's accepted numbers and identities", () => {
  const baseline = trial("retained-baseline", "baseline", 1);
  const variant = trial("retained-variant", "variant", 2);
  const accepted = variant.store.getSnapshot().accepted;
  assert.ok(accepted);
  const request = variant.store.issue("observer-change", { beta: 1 });
  const pending = markup([baseline.slot(), variant.slot()]);
  const pendingRegion = pending.querySelector(
    '[data-equation-values][data-instance-slot="variant"]',
  );
  expect(pendingRegion?.getAttribute("data-pending")).toBe("true");
  expect(pendingRegion?.getAttribute("data-instance-id")).toBe(accepted.instanceId);
  expect(pendingRegion?.querySelector(dropSelector)?.textContent).toBe("0.5 J");
  expect(pendingRegion?.textContent).toContain("Previous accepted settings");
  variant.store.refuse(request, makeRefusal("superluminal-observer", { parameterIds: ["beta"] }));
  const refused = markup([baseline.slot(), variant.slot()]);
  const refusedRegion = refused.querySelector(
    '[data-equation-values][data-instance-slot="variant"]',
  );
  expect(refusedRegion?.getAttribute("data-pending")).toBe("false");
  expect(refusedRegion?.querySelector(dropSelector)?.textContent).toBe("0.5 J");
  expect(refusedRegion?.textContent).toContain("request refused");
  expect(
    refused.querySelector('[data-instance-slot="baseline"]')?.querySelector(dropSelector)
      ?.textContent,
  ).toBe("0.25 J");
  expect(variant.store.getSnapshot().accepted).toBe(accepted);
});

test("static comparison regions expose separate snapshot identities and no value for a missing trial", () => {
  const baseline = trial("render-baseline", "baseline", 1);
  const variant = trial("render-variant", "variant", 2);
  const container = markup([baseline.slot(), variant.slot()]);
  for (const [slot, instance, value] of [
    ["baseline", "render-baseline", "0.25 J"],
    ["variant", "render-variant", "0.5 J"],
  ]) {
    const region = container.querySelector(`[data-equation-values][data-instance-slot="${slot}"]`);
    expect(region?.getAttribute("data-instance-id")).toBe(instance);
    expect(region?.getAttribute("data-execution-label")).toBe("static");
    expect(region?.querySelector(dropSelector)?.textContent).toBe(value);
  }
  const missing = markup([baseline.slot()]);
  const missingRegion = missing.querySelector(
    '[data-equation-values][data-instance-slot="variant"]',
  );
  expect(missingRegion?.getAttribute("data-instance-id")).toBeNull();
  expect(missingRegion?.querySelector(dropSelector)).toBeNull();
  expect(missingRegion?.textContent).toContain("Symbolic here");
});

test("selecting a term shows both independently bound values in the real inspector", async () => {
  const baseline = trial("inspector-baseline", "baseline", 1);
  const variant = trial("inspector-variant", "variant", 2);
  const container = createContainer();
  const root = createRoot(container);
  const element: ReactNode = (
    <EquationScope slots={[baseline.slot(), variant.slot()]}>
      <SemanticEquation equation={equation} />
    </EquationScope>
  );
  try {
    await act(async () => {
      root.render(element);
    });
    const chip = container.querySelector<HTMLButtonElement>(`[data-node-id="${drop.termId}"]`);
    assert.ok(chip);
    await act(async () => {
      chip.click();
    });
    const inspector = container.querySelector(`[data-inspector-node="${drop.termId}"]`);
    assert.ok(inspector);
    for (const [slot, instance, value] of [
      ["baseline", "inspector-baseline", "0.25 J"],
      ["variant", "inspector-variant", "0.5 J"],
    ]) {
      const line = inspector.querySelector(`[data-inspector-value][data-instance-slot="${slot}"]`);
      expect(line?.getAttribute("data-instance-id")).toBe(instance);
      expect(line?.getAttribute("data-value-kind")).toBe("value");
      expect(line?.textContent).toContain(value);
    }
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});
