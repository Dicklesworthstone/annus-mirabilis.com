/**
 * REVEALS A LABORATORY'S RESULTS, WITHOUT WHICH A BROWSER SWEEP CANNOT SEE ONE OF THEM (am-14at).
 *
 * `PredictGate.tsx` spreads `gate.response` onto every element that shows a result, giving it
 * `data-predict-response="awaiting"`, and the server renders `awaiting` for every laboratory
 * because `open` is computed after mount. So a page that is merely LOADED hides every telemetry
 * table, plot and value panel behind `display: none`, and a hidden box reports
 * `scrollWidth === clientWidth === 0` with an empty `getClientRects()`.
 *
 * Measured 2026-10-27 on /lab/lq-08/ at 320px, same build, same predicate:
 *
 *   scripts on   .table-scroll "Values at these settings"    0/0     laid=false  gate=awaiting
 *   scripts off  .table-scroll "Values at these settings"    254/254 laid=true   gate=awaiting
 *
 * THE DIRECTION IS WHAT MAKES THIS WORTH A MODULE. A hidden region reads as ABSENT, not as clean,
 * so nothing in a sweep's output says its population has a hole in it. `unreachableScrollRegions`
 * reported "1128 scrollable containers across 764 routes; 0 not keyboard reachable" for two weeks:
 * true, and about a population that excluded every laboratory result. AGENTS.md states the general
 * case -- a vacuous run is indistinguishable from a clean one -- and this is that case applied to a
 * subset, which is harder to notice because the total still looks large.
 *
 * SKIPPING IS THE RIGHT CONTROL of the three the panel offers. "I have one in mind" also reveals;
 * choosing a candidate would record a prediction through the reader's own storage port and change
 * what the panel then says. `PredictGate.skip` reveals the result and is the documented escape, in
 * that component's words: "Skipping always shows the result."
 *
 * WHAT THIS IS NOT. It is not a substitute for measuring the no-script state. Without scripts the
 * panel is what goes and the result stays, deliberately, so a reader without JavaScript sees these
 * regions with no interaction at all -- and the two states do not agree: sr-12's table is 354/252
 * at 320px either way, but with scripts `initFormulaOverflow` has given it a tab stop and without
 * them nothing has. A sweep that cares about reachability must measure both.
 *
 * EXTRACTED ON THE THIRD USE, which is this repository's stated bar, after two copies had already
 * been written. Its proof is its callers' floors: each asserts that the number of prompts it
 * dismissed clears a measured minimum, so a rename of the control turns three gates red rather
 * than quietly shrinking three populations. That is the honest limit of this module's own
 * verification -- there is no fixture here, because the thing it has to be right about is a real
 * page's markup.
 */

import type { Page } from "playwright";

/** The control that reveals a result, by the stable half of its accessible name. */
export const SKIP_PREDICTION_SELECTOR = 'button[aria-label^="Skip prediction"]';

/**
 * Clicks every prediction prompt's skip control, and returns how many it found.
 *
 * The count is returned rather than logged because a run where this silently clicked nothing is
 * otherwise indistinguishable from one where it worked: the caller asserts a floor on it.
 */
export async function dismissPredictMode(page: Page): Promise<number> {
  const total = await page.locator(SKIP_PREDICTION_SELECTOR).count();
  for (let index = 0; index < total; index += 1) {
    // Each click re-renders the panel, so the first button is re-resolved rather than held across
    // the await: a Locator captured before the render points at a detached node.
    const next = page.locator(SKIP_PREDICTION_SELECTOR).first();
    if ((await next.count()) === 0) break;
    await next.click({ timeout: 5000 });
  }
  return total;
}
