/**
 * WHAT AN ACTION PROMISES, AND WHETHER THE INSTRUMENT'S RENDER CONTAINS IT (am-jioj).
 *
 * `contractAudit.ts` audits an instrument's accessible equivalents by matching the
 * `equivalentAffordance` PROSE against a regex of words like "type", "table" and "select", and
 * `actionContracts.test.ts` imports only `fs`, `path` and the schema validators. So the audit reads the
 * promise and never the page: an action may promise a table in a laboratory that renders none and the gate is
 * green.
 *
 * This module is the other half. It classifies the promise - which does mean reading the prose, because that
 * is where the promise lives - and then looks for the corresponding element in the instrument's OWN REGION of
 * the built page. The verdict comes from the DOM.
 *
 * THE REGION, NOT THE PAGE, and the difference decides the answer. Measured 2026-10-06 over the built export:
 * a page-level search found a table for all 33 instruments and reported zero disagreements, because a lab
 * page carries prose tables, a notation table and a results table besides the instrument. Scoped to
 * `[data-instrument-id="<id>"]`, me-03's region renders no table at all. A check that reads the page answers
 * a question nobody asked.
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS, stated because the bead asks for it. It reads the STATIC build,
 * which is what a reader without JavaScript receives, so an affordance that appears only after hydration is
 * not seen here. That is the stricter reading rather than a gap: AGENTS.md requires that "no-JavaScript
 * readers get real links, never hydration-dependent buttons", and an accessible equivalent that needs a
 * running script is not an equivalent for the reader who has none.
 *
 * AND THE SELECTION CHECK IS THE WEAKEST OF THE THREE, measured rather than assumed. sr-05 promises
 * "select a worldline" and renders no `<select>` and no radio: it renders SEVEN BUTTONS, one per worldline,
 * which is exactly how these laboratories offer a choice without a pointer. A rule demanding a `<select>`
 * would have reported two false failures on a lab that does the right thing. So a button group counts, which
 * means this class mainly catches a region with no control at all. Said out loud rather than left for a later
 * reader to discover.
 */

export type PromisedAffordance = "table" | "typed-entry" | "selection";

/**
 * The capabilities an affordance sentence promises. A sentence may promise several: me-01's
 * "Enter signed observer speed v/c and read the moving ledger values in the table" promises both typed entry
 * and a table, and both are checked.
 */
export function promisedAffordances(equivalentAffordance: string): PromisedAffordance[] {
  const text = equivalentAffordance;
  const out: PromisedAffordance[] = [];
  if (/\b(table|tabulated|row|column)\b/i.test(text)) out.push("table");
  if (/\b(type|typed|enter|entering|direct entry|input|field)\b/i.test(text))
    out.push("typed-entry");
  if (/\b(select|selecting|choose|choosing|switch|toggle|pick)\b/i.test(text))
    out.push("selection");
  return out;
}

/** What an instrument's rendered region actually contains, counted. */
export type RenderedControls = Readonly<{
  tables: number;
  /** Text, number and other typed fields; radio and checkbox are counted separately as selectors. */
  typedFields: number;
  selects: number;
  radiosAndCheckboxes: number;
  buttons: number;
}>;

/** A region satisfies a promise, or it does not. One function so the rule has one home. */
export function satisfies(promise: PromisedAffordance, controls: RenderedControls): boolean {
  switch (promise) {
    case "table":
      return controls.tables > 0;
    case "typed-entry":
      // A `<select>` is a typed-entry equivalent for an enumerated parameter: the reader states a value
      // without a pointer, which is what the contract is about.
      return controls.typedFields > 0 || controls.selects > 0;
    case "selection":
      // A button group is a selector. See the docblock: sr-05 renders seven buttons and no select.
      return (
        controls.selects > 0 ||
        controls.radiosAndCheckboxes > 0 ||
        controls.buttons >= 2 ||
        controls.typedFields > 0
      );
  }
}

/** The sentence a failure prints: what was promised, and what the region holds instead. */
export function unmetPromiseMessage(
  instrumentId: string,
  actionId: string,
  promise: PromisedAffordance,
  controls: RenderedControls,
): string {
  return (
    `${instrumentId}/${actionId} promises ${promise}, and the region [data-instrument-id="${instrumentId}"] ` +
    `renders ${controls.tables} table(s), ${controls.typedFields} typed field(s), ${controls.selects} select(s), ` +
    `${controls.radiosAndCheckboxes} radio/checkbox(es) and ${controls.buttons} button(s)`
  );
}
