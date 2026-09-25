/**
 * Printed displays in the paper's one colour map (assignQuantityColoursPreferring, dispatch 224).
 * The records' views stay hard; a printed display is admitted as hard when the paper stays
 * colourable with it, and is otherwise named as sharing a colour.
 */
import assert from "node:assert/strict";
import test from "node:test";
import payload from "../generated/mass-energy-equations.json";
import printedPayload from "../generated/printed-displays.json";
import colourPayload from "../generated/quantity-colours.json";
import { checkPaperDisplays } from "./printed/paperDisplays.ts";
import {
  assignQuantityColours,
  assignQuantityColoursPreferring,
  type ColourableEquation,
  QUANTITY_PALETTE,
} from "./quantityColours.ts";

const distinct = (slots: Readonly<Record<string, number>>, ids: readonly string[]) => {
  const own = [...new Set(ids)].map((id) => slots[id]);
  return new Set(own).size === own.length;
};

test("a preferred view that fits is admitted, smallest first; one that cannot is named", () => {
  // Nine quantities in one record take every slot. {x, q9} fits, and is admitted first, being
  // smaller; {x, q1..q8} then needs x to take q9's slot, which the first now forbids.
  const q = QUANTITY_PALETTE.map((_, i) => `q${i + 1}`);
  const records: ColourableEquation[] = [{ id: "all", argument: "a", quantityIds: q }];
  const small = { id: "small", argument: "p", quantityIds: ["x", "q9"] };
  const large = { id: "large", argument: "p", quantityIds: ["x", ...q.slice(0, 8)] };
  const { slots, shared } = assignQuantityColoursPreferring(records, [large, small]);
  assert.deepEqual(shared, ["large"]);
  assert.equal(distinct(slots, small.quantityIds), true);
  assert.equal(distinct(slots, q), true);
  // Both alone would have fitted: the refusal is the combination, not either view.
  assert.doesNotThrow(() => assignQuantityColours([...records, large]));
});

test("the built map: every printed display is distinct unless the build names it as sharing", () => {
  // Read from what build-equations.ts wrote, since the map also depends on the reading formulas
  // shown together, which only the build assembles. The names are a finding of the build, not a
  // constant: a change of records may move them, so this holds the property, not the list.
  let checkedViews = 0;
  for (const [paper, quantities] of Object.entries(colourPayload.papers)) {
    const slots = Object.fromEntries(
      Object.entries(quantities).map(([id, c]) => [id, (c as { slot: number }).slot]),
    );
    const shared =
      (printedPayload.sharedPrintedViews as Record<string, readonly string[]>)[paper] ?? [];
    for (const display of printedPayload.displays.filter((d) => d.paper === paper)) {
      if (shared.includes(`printed:${display.display}`)) continue;
      assert.equal(
        distinct(
          slots,
          display.terms.map((t) => t.quantityId),
        ),
        true,
        `${paper} ${display.display}`,
      );
      checkedViews++;
    }
  }
  assert.ok(checkedViews > 0, "no printed display was checked");
  // The records keep the promise they had before the printed displays joined.
  const me = colourPayload.papers["mass-energy"] as Record<string, { slot: number }>;
  const meSlots = Object.fromEntries(Object.entries(me).map(([id, c]) => [id, c.slot]));
  for (const record of payload.equations)
    assert.equal(
      distinct(
        meSlots,
        record.terms.map((t) => t.quantityId),
      ),
      true,
      record.id,
    );
});

test("mass-energy cannot give every printed display distinct colours, so one must share", async () => {
  const records = payload.equations.map((e) => ({
    id: e.id,
    argument: e.argument,
    quantityIds: e.terms.map((t) => t.quantityId),
  }));
  const checked = await checkPaperDisplays(process.cwd(), "mass-energy");
  assert.ok(checked);
  const views = [...new Map(checked.displays.map((d) => [d.display, d])).values()].map((d) => ({
    id: `printed:${d.display}`,
    argument: `printed:${d.display}`,
    quantityIds: d.terms.map((t) => t.quantityId),
  }));
  assert.ok(views.length > 1);
  // Each alone fits; all together do not (the clique of nine, and v and V: quantityColours.ts).
  // A view is refused only when the records and the views admitted before it leave it no
  // colouring, and every subset of a colourable set is colourable, so one refusal proves the whole
  // set cannot be made distinct. Asserting that directly costs a second exhaustive search.
  for (const view of views) assert.doesNotThrow(() => assignQuantityColours([...records, view]));
  const { shared } = assignQuantityColoursPreferring(records, views);
  assert.ok(shared.length > 0, "one printed display must share a colour");
  assert.ok(shared.length < views.length, "the rest are admitted");
});
