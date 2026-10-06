import type { Page } from "playwright";

/**
 * A CHECK'S ARRIVAL HAS TO BE A REAL ARRIVAL (am-xyxk, measured 2026-10-06).
 *
 * `run.ts` opened each assertion with `await p.goto(`${url}/runtime-conformance.html#/runtime`)` and
 * then waited for the fixture's ready flag, which reads like isolation and is not. A navigation to a
 * url that differs from the current one ONLY IN ITS FRAGMENT is a same-document navigation: the
 * browser moves the scroll position and fires `hashchange`, and the document, its modules, its stores
 * and its workers all survive. Playwright's `goto` resolves happily, and the fixture's
 * `data-ready` attribute is still `true` from the previous check, so the wait returns at once.
 *
 * MEASURED IN CHROMIUM, with the protocol-mismatch hook as the mutation:
 *
 *   A fresh arrival         runId run/1  input 1  accepted 1  accepted   seed 1
 *   B after mismatch        runId run/1  input 2  accepted 1  unavailable seed 1
 *   C after goto same hash  runId run/1  input 2  accepted 1  unavailable seed 1   <- NOT reloaded
 *   D observer change       runId run/2  input 2  accepted 2  accepted   seed 2
 *   E after page.reload()   runId run/1  input 1  accepted 1  accepted   seed 1   <- reloaded
 *   F observer after reload runId run/1  input 1  accepted 1  accepted   seed 1
 *
 * Row C is the defect and row D is its consequence: with a stranded request still in the store, an
 * observer change forked the runId, so `observer-change-preserves-world` reported a command-class
 * violation that belonged to the PREVIOUS check. Row F is the same command on a real fresh document,
 * preserving the runId as the contract requires.
 *
 * Nothing before 2026-10-06 mutated state in a way a later check read, so eleven assertions ran in a
 * shared document for weeks and all of them passed. That is the dangerous shape: order-dependent
 * checks whose coupling is invisible until one of them happens to matter, and a passing run says
 * nothing about whether isolation ever existed.
 *
 * `reload` is used rather than a cache-busting query because it cannot be wrong about url shapes: it
 * always re-creates the document, whatever the fragment, query or server does.
 */
export async function openRuntimeFixture(
  page: Page,
  url: string,
  options: { readySelector?: string; timeoutMs?: number } = {},
): Promise<void> {
  const readySelector = options.readySelector ?? '[data-reader-root][data-ready="true"]';
  const timeout = options.timeoutMs ?? 15000;
  await page.goto(url);
  // The second navigation is the one that guarantees a new document. Without it this function is the
  // bug it exists to fix.
  await page.reload();
  await page.waitForSelector(readySelector, { timeout });
}
