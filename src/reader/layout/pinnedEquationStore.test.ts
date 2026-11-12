import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createSelectionStore } from "../../equations/selectionStore.ts";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import {
  createPinnedEquationStore,
  EquationPinError,
  type PinnedEquation,
} from "./pinnedEquationStore.ts";
import { pinnedEquationView } from "./pinnedEquationView.ts";

const payload = JSON.parse(
  readFileSync(
    new URL("../../generated/argument-equations/arg-sr-clock-and-length.json", import.meta.url),
    "utf8",
  ),
);
const equation = payload.equations.find(
  (item: CompiledEquation) => item.notationForm?.state === "printed",
) as CompiledEquation;
assert.ok(equation);
const context = () => ({ store: createSelectionStore(), slots: [], editQuantity: null });
const pin = (): PinnedEquation => ({
  equation,
  formId: "printed",
  context: context(),
  sourceId: "source-card",
  sourceAnchor: equation.argument,
  returnElement: null,
});

describe("pinned equation store (am-read-page-anatomy-l0b)", () => {
  it("pin keeps equation id, form, and selection; unpin clears", () => {
    const store = createPinnedEquationStore();
    const selected = pin();
    assert.equal(store.pinEquation(selected), true);
    assert.equal(store.getPinnedEquation()?.equation, equation);
    assert.equal(store.getPinnedEquation()?.context.store, selected.context.store);
    const node = equation.navigation[0];
    assert.ok(node);
    selected.context.store.select({
      nodeId: `${equation.paper}/${node.id}`,
      quantityId: node.quantityId,
      kind: node.kind,
    });
    store.showPinned(false);
    assert.equal(store.getSnapshot().visible, false);
    assert.equal(store.getPinnedEquation()?.formId, "printed");
    assert.equal(
      store.getPinnedEquation()?.context.store.getSnapshot()?.nodeId,
      `${equation.paper}/${node.id}`,
    );
    store.showPinned(true);
    assert.equal(store.getSnapshot().visible, true);
    store.unpinEquation();
    assert.equal(store.getPinnedEquation(), null);
  });

  it("reader instances and pending lazy pins cannot overwrite another accepted choice", () => {
    const left = createPinnedEquationStore();
    const right = createPinnedEquationStore();
    const attempt = left.beginPin();
    left.pinEquation({ ...pin(), formId: "modern" });
    assert.equal(left.pinEquation(pin(), attempt), false);
    assert.equal(left.getPinnedEquation()?.formId, "modern");
    assert.equal(right.getPinnedEquation(), null);
    const loading = left.beginPin();
    left.unpinEquation();
    assert.equal(left.pinEquation(pin(), loading), false);
    assert.equal(left.getPinnedEquation(), null);
    assert.equal(left.getServerSnapshot().pinned, null);
  });

  it("an unavailable printed form is refused, and the view selects existing compiled markup only", () => {
    const store = createPinnedEquationStore();
    const invalid = { ...pin(), equation: { ...equation, id: "" } };
    assert.throws(() => store.pinEquation(invalid), EquationPinError);
    const model = pinnedEquationView(equation, "modern");
    assert.equal(model.html, equation.html);
    assert.equal(model.mathml, equation.mathml);
    assert.equal(model.notationForm, undefined);
    assert.throws(() => store.pinEquation({ ...pin(), equation: model }), EquationPinError);
    assert.throws(() => pinnedEquationView(model, "printed"), EquationPinError);
    const historical = pinnedEquationView(equation, "printed");
    assert.equal(equation.notationForm?.state, "printed");
    if (equation.notationForm?.state !== "printed") return;
    assert.equal(historical.html, equation.notationForm.html);
    assert.equal(historical.mathml, equation.notationForm.mathml);
    assert.equal(historical.sentence, equation.notationForm.sentence);
    assert.equal(historical.tree, equation.tree);
    assert.equal(historical.notationForm, undefined);
  });
});
