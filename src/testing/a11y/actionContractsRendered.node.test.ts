/**
 * EVERY ACTION'S PROMISED EQUIVALENT IS IN THE INSTRUMENT'S RENDER (am-jioj).
 *
 * `contractAudit.ts` matches the `equivalentAffordance` PROSE against a regex of words like "type", "table"
 * and "select", and `actionContracts.test.ts` imports only `fs`, `path` and the schema validators. The audit
 * therefore reads the promise and never the page: an action may promise a table in a laboratory that renders
 * none and the gate stays green. This is the half that reads the DOM.
 *
 * IN THE NODE LANE, because it reads `out/`. That lane already refuses to start against a stale build and
 * says so ("out/ is stale, run bun run build"), which is the precondition this test needs and the wrong thing
 * to re-invent. A bun-lane version would have to choose between failing for everyone without a fresh build
 * and skipping silently, and a silent skip is a vacuous pass.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import {
  promisedAffordances,
  type RenderedControls,
  satisfies,
  unmetPromiseMessage,
} from "../../a11y/actions/renderedAffordance.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { assertOutFreshness } from "../outFreshness.ts";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const MANIFESTS = join(ROOT, "content", "experiments");

type Action = Readonly<{ instrumentId: string; actionId: string; equivalentAffordance: string }>;

function declaredActions(): Action[] {
  const out: Action[] = [];
  for (const file of readdirSync(MANIFESTS).filter((f) => f.endsWith(".yaml"))) {
    const doc = strictParse(readFileSync(join(MANIFESTS, file), "utf8"), "yaml") as {
      id?: string;
      actions?: { actionId?: string; equivalentAffordance?: string }[];
    };
    const instrumentId = doc.id ?? file.replace(/\.yaml$/, "");
    for (const action of doc.actions ?? []) {
      if (!action.actionId || !action.equivalentAffordance) continue;
      out.push({
        instrumentId,
        actionId: action.actionId,
        equivalentAffordance: action.equivalentAffordance,
      });
    }
  }
  return out;
}

/**
 * The controls inside one instrument's own region of its built page, or null when the page or the region is
 * absent - which is a finding and never a pass.
 */
function controlsFor(instrumentId: string, html?: string): RenderedControls | null {
  const page = join(ROOT, "out", "lab", instrumentId, "index.html");
  const source = html ?? (existsSync(page) ? readFileSync(page, "utf8") : undefined);
  if (source === undefined) return null;
  const window = new Window({ url: "http://localhost" });
  try {
    window.document.documentElement.innerHTML = source;
    const root = window.document.querySelector(`[data-instrument-id="${instrumentId}"]`);
    if (!root) return null;
    return {
      tables: root.querySelectorAll('table, [role="table"]').length,
      typedFields: root.querySelectorAll(
        "input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]), textarea",
      ).length,
      selects: root.querySelectorAll("select").length,
      radiosAndCheckboxes: root.querySelectorAll("input[type=radio], input[type=checkbox]").length,
      buttons: root.querySelectorAll("button, input[type=button], input[type=submit]").length,
    };
  } finally {
    void window.happyDOM.close();
  }
}

const actions = declaredActions();

test("out/ is present and fresh, so what follows is a statement about a real build", () => {
  // The citation discipline AGENTS.md asks for: a run over an absent or stale build would report zero
  // disagreements and read exactly like a clean result.
  const freshness = assertOutFreshness("out", ROOT);
  assert.ok(freshness.present);
});

test("the populations are real, and printed beside the verdict", () => {
  const instruments = new Set(actions.map((a) => a.instrumentId));
  const promises = actions.flatMap((a) => promisedAffordances(a.equivalentAffordance));
  const withRegion = [...instruments].filter((id) => controlsFor(id) !== null);
  assert.ok(actions.length >= 60, `only ${actions.length} declared actions`);
  assert.ok(instruments.size >= 33, `only ${instruments.size} instruments`);
  assert.ok(promises.length >= 60, `only ${promises.length} promised affordances`);
  assert.equal(
    withRegion.length,
    instruments.size,
    `${instruments.size - withRegion.length} instrument(s) have no [data-instrument-id] region in their built page`,
  );
  const byClass = { table: 0, "typed-entry": 0, selection: 0 };
  for (const p of promises) byClass[p] += 1;
  // Each class must be non-empty or its arm below proves nothing.
  for (const [name, count] of Object.entries(byClass))
    assert.ok(count > 0, `no action promises ${name}, so that rule is never exercised`);
  console.log(
    `[action contracts] ${actions.length} actions across ${instruments.size} instruments, ` +
      `${promises.length} promised affordances (${byClass.table} table, ${byClass["typed-entry"]} typed entry, ` +
      `${byClass.selection} selection); ${withRegion.length} instrument regions read from out/`,
  );
});

test("every promised equivalent is present in that instrument's own rendered region", () => {
  const unmet: string[] = [];
  let judged = 0;
  for (const action of actions) {
    const controls = controlsFor(action.instrumentId);
    if (controls === null) {
      unmet.push(`${action.instrumentId}: no rendered region in out/lab/${action.instrumentId}/`);
      continue;
    }
    for (const promise of promisedAffordances(action.equivalentAffordance)) {
      judged += 1;
      if (!satisfies(promise, controls))
        unmet.push(unmetPromiseMessage(action.instrumentId, action.actionId, promise, controls));
    }
  }
  assert.ok(judged >= 60, `only ${judged} promises were judged against a region`);
  assert.deepEqual(
    unmet,
    [],
    `${unmet.length} promised equivalent(s) are not in the render:\n${unmet.join("\n")}`,
  );
});

test("THE REGION, NOT THE PAGE, and me-03 is the instrument with no table at all", () => {
  /*
   * The scope decision, kept as an assertion, and CORRECTED from what I first wrote here.
   *
   * I claimed a page-level search finds a table for all 33 instruments. That was an over-generalisation from
   * a probe that only looked at pages whose actions PROMISE a table - me-03 promises none, so it was never
   * in that population. Measured directly: me-03's page contains ZERO `<table>` elements, me-01's one and
   * sr-05's five.
   *
   * The scope argument survives the correction and is now stated the right way round. Reading the page would
   * CREDIT an instrument for a table rendered by its prose, its notation section or its results card, none of
   * which is the accessible equivalent an action promised; reading the region is what makes the credit belong
   * to the instrument. me-03 happens not to show the difference, and the four labs whose regions hold fewer
   * tables than their pages do.
   */
  const controls = controlsFor("me-03");
  assert.ok(controls, "me-03 has no rendered region");
  assert.equal(controls.tables, 0);
  const page = readFileSync(join(ROOT, "out", "lab", "me-03", "index.html"), "utf8");
  assert.equal((page.match(/<table[\s>]/g) ?? []).length, 0, "me-03's page has no table either");
  // And me-03 promises no table, so the zero above is a scope note rather than a finding.
  const me03 = actions.filter((a) => a.instrumentId === "me-03");
  assert.ok(me03.length > 0);
  for (const action of me03)
    assert.ok(
      !promisedAffordances(action.equivalentAffordance).includes("table"),
      `${action.actionId} promises a table that me-03's region does not render`,
    );
  // The real demonstration that region and page differ: at least one instrument's region holds strictly
  // fewer tables than its page. Asserted over the whole set rather than claimed for one.
  const narrower: string[] = [];
  for (const id of new Set(actions.map((a) => a.instrumentId))) {
    const region = controlsFor(id);
    const html = readFileSync(join(ROOT, "out", "lab", id, "index.html"), "utf8");
    const pageTables = (html.match(/<table[\s>]/g) ?? []).length;
    if (region && pageTables > region.tables)
      narrower.push(`${id} (page ${pageTables}, region ${region.tables})`);
  }
  assert.ok(
    narrower.length > 0,
    "no instrument's region holds fewer tables than its page, so scoping to the region changes nothing and this test is the wrong shape",
  );
  console.log(`[action contracts] regions narrower than their page: ${narrower.join(", ")}`);
});

test("A BUTTON GROUP IS A SELECTOR: sr-05 promises selection and renders no select", () => {
  // Kept as an assertion because a stricter rule would have reported two false failures on a lab doing the
  // right thing. sr-05 offers one button per worldline, which is how these laboratories give a choice
  // without a pointer.
  const controls = controlsFor("sr-05");
  assert.ok(controls);
  assert.equal(controls.selects, 0);
  assert.equal(controls.radiosAndCheckboxes, 0);
  assert.ok(controls.buttons >= 2, `sr-05 renders ${controls.buttons} button(s)`);
  assert.ok(satisfies("selection", controls));
  // The other direction: a region with one button and nothing else does NOT satisfy selection.
  const bare: RenderedControls = {
    tables: 1,
    typedFields: 0,
    selects: 0,
    radiosAndCheckboxes: 0,
    buttons: 1,
  };
  assert.equal(satisfies("selection", bare), false);
});

test("PLANTED: a region whose table is removed fails, naming the instrument and the action", () => {
  // Driven through the real predicate against the real built page, with the table stripped from the HTML in
  // memory - so the plant cannot be swept into a peer's commit, and the page on disk is untouched.
  const promisesTable = actions.find((a) =>
    promisedAffordances(a.equivalentAffordance).includes("table"),
  );
  assert.ok(promisesTable, "no action promises a table, so this plant proves nothing");
  const page = readFileSync(
    join(ROOT, "out", "lab", promisesTable.instrumentId, "index.html"),
    "utf8",
  );
  const before = controlsFor(promisesTable.instrumentId, page);
  assert.ok(before && before.tables > 0, "the unplanted region must have a table");
  // Prove what landed before reading the verdict: the planted page has strictly fewer tables.
  const planted = page
    .replace(/<table\b/g, "<div data-planted-not-a-table")
    .replace(/<\/table>/g, "</div>");
  const after = controlsFor(promisesTable.instrumentId, planted);
  assert.ok(after, "the planted page still has a region");
  assert.equal(after.tables, 0, "the plant did not land; the verdict below would mean nothing");
  assert.equal(satisfies("table", after), false);
  const message = unmetPromiseMessage(
    promisesTable.instrumentId,
    promisesTable.actionId,
    "table",
    after,
  );
  assert.match(message, new RegExp(promisesTable.instrumentId));
  assert.match(message, new RegExp(promisesTable.actionId));
  assert.match(message, /renders 0 table\(s\)/);
});

test("the classifier reads the promise, in both directions", () => {
  assert.deepEqual(promisedAffordances("Read the values in the table."), ["table"]);
  assert.deepEqual(
    promisedAffordances(
      "Enter signed observer speed v/c and read the moving ledger values in the table.",
    ),
    ["table", "typed-entry"],
  );
  assert.deepEqual(promisedAffordances("Choose a named worldline."), ["selection"]);
  // A sentence promising none of the three is not forced into one: three real actions are like this, and
  // inventing a promise for them would be a demand for an element nobody offered.
  assert.deepEqual(promisedAffordances("Advance the recorded step."), []);
});
