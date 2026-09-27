/**
 * THE ACTION CONTRACT, CHECKED AGAINST THE RENDERED PAGE (am-jioj).
 *
 * `contractAudit.ts` reads an action's `equivalentAffordance` prose and matches it against a list of
 * words - "type", "select", "table", "read". That says whether a promise was WORDED, never whether
 * the page keeps it. Measured on 2026-09-27: me-01 declared a view of kind `table` and two actions
 * telling a reader to "read the moving ledger values in the table", and the laboratory rendered no
 * table at all. It passed the audit, because the sentence contains the word.
 *
 * So this module answers the other half. The prose is still the input - it is where the promise is
 * stated - but the verdict comes from the DOM the reader receives:
 *
 *   an action promising a TABLE must find a table in that instrument's render;
 *   one promising TYPED ENTRY must find a field a value can be typed into;
 *   one promising SELECTION must find a control that selects;
 *   one promising STEPPING must find a control that advances;
 *   one promising READING must find something that holds the values to read.
 *
 * WHAT IT DOES NOT ANSWER, said in its own output rather than left implicit. A promise whose wording
 * names no affordance this vocabulary knows is reported as `unclassified`, and an instrument whose
 * page could not be rendered is reported as `unrendered`. Neither is counted as verified, because a
 * check that quietly passes what it could not read is the defect this module exists to replace.
 * Whether the affordance a reader finds is the RIGHT one for the question - whether the table holds
 * the quantity the action names - is not decidable from the element alone; this reports that the
 * promised kind of control is on the page, and the instrument's own tests own the rest.
 */

import type { ActionContract, ActionContractAuditDiagnostic } from "./types.ts";

/** What an equivalent affordance can promise a reader will find. */
export type PromisedAffordance = "table" | "typed-entry" | "selection" | "stepping" | "reading";

/**
 * The words that state each promise, matched on whole words. An unanchored `table` also matches
 * "tabled" and a bare `read` matches "already", which is the failure mode of the prose audit this
 * replaces: the pattern must name the thing, not merely appear near it.
 */
const PROMISE_WORDS: Readonly<Record<PromisedAffordance, RegExp>> = Object.freeze({
  table: /\b(tables?|ledgers?|rows?|columns?|grid)\b/i,
  "typed-entry": /\b(type|types|typed|typing|enter|enters|entering|entry|input|field|fields)\b/i,
  selection: /\b(select|selects|selecting|selection|choose|chooses|choosing|toggle|toggles|switch|switches|pick|picks)\b/i,
  stepping: /\b(advance|advances|step|steps|stepping|retreat|retreats|next|previous|play|pause)\b/i,
  reading: /\b(read|reads|reading|inspect|inspects|observe|observes|compare|compares|comparing)\b/i,
});

/**
 * The elements that keep each promise, in the order they are tried. The first selector that matches
 * is reported, so a failure names what was looked for and a pass names what answered.
 */
const AFFORDANCE_SELECTORS: Readonly<Record<PromisedAffordance, readonly string[]>> = Object.freeze({
  table: ['table', '[role="table"]', '[role="grid"]', "dl"],
  "typed-entry": [
    'input[type="number"]',
    'input[type="text"]',
    "input:not([type])",
    "textarea",
    '[contenteditable="true"]',
  ],
  selection: [
    "select",
    'input[type="radio"]',
    'input[type="checkbox"]',
    "[aria-pressed]",
    '[role="radio"]',
    '[role="listbox"]',
    '[role="combobox"]',
    "[aria-current]",
  ],
  stepping: ["button", '[role="button"]', 'input[type="range"]'],
  reading: [
    "table",
    "dl",
    "output",
    '[role="status"]',
    "[data-output]",
    "[data-quantity-id]",
    "figcaption",
  ],
});

export type RenderedAffordanceReport = Readonly<{
  /** Actions whose promise was classified and looked for on the page. */
  examined: number;
  /** Actions whose promised affordance was found in the render. */
  verified: number;
  /** Actions whose wording names no affordance this vocabulary knows. */
  unclassified: readonly string[];
  /** What answered each kept promise: `<actionId> <promise> <selector>`, for the record. */
  found: readonly string[];
  diagnostics: readonly ActionContractAuditDiagnostic[];
}>;

/** Every promise an equivalent affordance states, in a stable order. */
export function promisedAffordances(equivalentAffordance: string): readonly PromisedAffordance[] {
  const text = equivalentAffordance ?? "";
  return (Object.keys(PROMISE_WORDS) as PromisedAffordance[]).filter((promise) =>
    PROMISE_WORDS[promise].test(text),
  );
}

/** The first selector of this promise that the page answers with, or undefined where none does. */
export function affordanceInPage(page: ParentNode, promise: PromisedAffordance): string | undefined {
  for (const selector of AFFORDANCE_SELECTORS[promise]) {
    if (page.querySelector(selector)) return selector;
  }
  return undefined;
}

/**
 * One instrument's actions, read against its rendered page. `page` is the DOM the reader receives:
 * a document, or any node holding the instrument's render.
 */
export function auditRenderedActions(
  instrumentId: string,
  contracts: readonly ActionContract[],
  page: ParentNode,
): RenderedAffordanceReport {
  const diagnostics: ActionContractAuditDiagnostic[] = [];
  const unclassified: string[] = [];
  const found: string[] = [];
  let examined = 0;
  let verified = 0;

  for (const contract of contracts) {
    const actionId = contract.actionId;
    const promises = promisedAffordances(contract.equivalentAffordance ?? "");
    if (promises.length === 0) {
      unclassified.push(actionId);
      continue;
    }
    for (const promise of promises) {
      examined += 1;
      const selector = affordanceInPage(page, promise);
      if (selector) {
        verified += 1;
        found.push(`${actionId} ${promise} ${selector}`);
        continue;
      }
      diagnostics.push({
        code: "action-affordance-absent",
        message: `Action "${actionId}" of instrument "${instrumentId}" promises a reader ${PROMISE_NAMES[promise]} ("${contract.equivalentAffordance}"), and the rendered page holds none: no ${AFFORDANCE_SELECTORS[promise].join(", ")}.`,
        instrumentId,
        actionId,
        path: `actionContracts.${actionId}.equivalentAffordance`,
      });
    }
  }

  return Object.freeze({
    examined,
    verified,
    unclassified: Object.freeze(unclassified),
    found: Object.freeze(found),
    diagnostics: Object.freeze(diagnostics),
  });
}

const PROMISE_NAMES: Readonly<Record<PromisedAffordance, string>> = Object.freeze({
  table: "a table of values",
  "typed-entry": "a field a value can be typed into",
  selection: "a control that selects",
  stepping: "a control that advances the experiment",
  reading: "values to read",
});
