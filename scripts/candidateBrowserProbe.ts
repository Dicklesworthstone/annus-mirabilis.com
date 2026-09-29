/**
 * The browser half of the candidate checks (am-rel-candidate-checks-kc7y, dispatch 462).
 *
 * WHY THIS EXISTS. AGENTS.md's deployment chapter requires a candidate to prove, by name, "one real
 * accepted WASM result per numerical capability" and "one deliberate typed refusal", both "against
 * the deployed assets rather than the build directory". Neither can be seen over HTTP: an accepted
 * result is produced by a lab's worker executing on the page, and `A LOADED WASM FILE DOES NOT EARN
 * THE LABEL`. So until this module existed both checks reported `not-available` and every promotion
 * went out without them.
 *
 * HOW IT REACHES A PROTECTED CANDIDATE. The candidate is behind Vercel SSO; a plain browser request
 * gets a 302 to vercel.com/sso-api, which is why the other checks go through `vercel curl`. This
 * module therefore serves the browser ENTIRELY from the same `Fetcher` those checks use: the page is
 * opened on an origin that does not exist, every request is intercepted at the browser context and
 * fulfilled with the bytes the fetcher returned, and anything the fetcher cannot supply is aborted
 * rather than loaded from somewhere else. 64 requests were served that way for one lab page when this
 * was measured, including the dedicated worker's fetch of the WASM artifact, and `0` came from
 * anywhere else.
 *
 * WHAT THAT BUYS AND WHAT IT COSTS. Every byte executed is the deployment's byte, which is the
 * requirement. The synthetic origin is the price: this module cannot check a response header, a
 * content type as Vercel serves it, or a CSP, because it supplies those itself. Content types here
 * are inferred from the path, and `application/wasm` matters (streaming instantiation refuses
 * anything else). The HTTP checks in candidate-checks.ts compare served bytes with the upload; this
 * one asks what those bytes DO.
 */
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import type {
  AcceptedWasmObservation,
  CandidateBrowserProbe,
  Fetcher,
  LabPreparation,
  RefusalObservation,
  RefusalTarget,
  WasmCapabilityTarget,
} from "./candidate-checks.ts";
import { retryingFetcher } from "./candidate-checks.ts";

/** The origin the page believes it is on. It resolves nowhere, which is the point. */
const SYNTHETIC_ORIGIN = "https://candidate-under-test.invalid";

/** Long enough for a worker to load the artifact and publish a snapshot on a slow machine. */
const SETTLE_MS = 8000;

const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  pdf: "application/pdf",
  wasm: "application/wasm",
});

/**
 * A path with no extension is a page, not an octet stream. Getting this wrong does not merely
 * mislabel a response: Chromium treated the lab page as a file to save and `page.goto` failed with
 * "Download is starting", which is how this line came to be written.
 */
export function contentTypeForPath(pathname: string): string {
  const last = pathname.split("/").pop() ?? "";
  const ext = last.includes(".") ? (last.split(".").pop() ?? "").toLowerCase() : "html";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * What an observation says when the probe could not supply a byte the page asked for.
 *
 * MEASURED, not hypothetical (dispatch 483). Against a complete export, planting a single status 0
 * for `/_next/static/chunks/4269.3973e0a70b800eb3.js` made BM-01 report labels `[static]` then
 * `[static]`, 0 wasm requests, no FrankenSim wording and NO page error: byte for byte the signature
 * the candidate of 2026-09-28 reported, which was read as "BM-01 makes zero wasm requests" and
 * refused the release of 54 commits. The same lab driven over the same export, by hand at three
 * press timings and through this probe, reaches "Ideal model, computed with FrankenSim".
 *
 * So one asset that never arrived and a laboratory that never called its owner are the same
 * observation, and the check cannot tell them apart unless the probe says which it was. This does
 * not excuse a missing result: the check still fails. It names the cause.
 */
export function unsuppliedSentences(unsupplied: ReadonlyMap<string, number>): string[] {
  return [...unsupplied].map(
    ([path, status]) =>
      `the probe could not supply ${path} (${describeUnsupplied(status)}), so the page ran without it and a missing result here may be this harness's rather than the deployment's`,
  );
}

/**
 * Whether a status delivered the bytes the page asked for. Only a 2xx did.
 *
 * A 3XX COUNTS AS UNSUPPLIED, and that is the correction (dispatch 493). This probe fulfils every
 * response with status, body and content type and no location header, so a redirect reaches the
 * browser with nowhere to go and the asset never arrives. The first version of this recorded only
 * `status === 0 || status >= 400`, which left exactly one transport failure both unfollowed and
 * unseen, and it is the one a Vercel SSO candidate answers with: a 302.
 */
export function isUnsupplied(status: number): boolean {
  return status < 200 || status >= 300;
}

function describeUnsupplied(status: number): string {
  if (status === 0) return "the request itself failed after every attempt";
  if (status >= 300 && status < 400)
    return `status ${status}, a redirect this probe cannot follow because it fulfils a response without its location header`;
  return `status ${status}`;
}

type ProbeState = Readonly<{
  browser: Browser;
  context: BrowserContext;
  /** Immutable deployment, so a path fetched twice is the same bytes; this keeps the count of
   * `vercel curl` subprocesses near the number of DISTINCT assets rather than of requests. */
  cache: Map<string, { status: number; body: Buffer }>;
  counters: { served: number; aborted: number; fetched: number };
  /**
   * Paths this probe could not supply, with the status it reported, cleared when a page opens so
   * each observation carries its own. A byte that never arrives is INVISIBLE in a page's labels,
   * which is how a harness failure came to read as a broken laboratory; see `unsuppliedSentences`.
   */
  unsupplied: Map<string, number>;
}>;

async function open(fetcher: Fetcher): Promise<ProbeState> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
  const cache = new Map<string, { status: number; body: Buffer }>();
  const counters = { served: 0, aborted: 0, fetched: 0 };
  const unsupplied = new Map<string, number>();
  // One `vercel curl` subprocess per asset, and a failed spawn resolves with status 0. The HTTP
  // checks have retried that since 2026-09-24; this probe never did, and every byte a page needs
  // came from a single attempt.
  const transport = retryingFetcher(fetcher);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== SYNTHETIC_ORIGIN) {
      counters.aborted += 1;
      await route.abort();
      return;
    }
    const key = `${url.pathname}${url.search}`;
    let response = cache.get(key);
    if (response === undefined) {
      counters.fetched += 1;
      const fetched = await transport(key);
      response = { status: fetched.status, body: fetched.body };
      cache.set(key, response);
    }
    counters.served += 1;
    if (isUnsupplied(response.status)) unsupplied.set(key, response.status);
    await route.fulfill({
      status: response.status === 0 ? 599 : response.status,
      body: response.body,
      contentType: contentTypeForPath(url.pathname),
    });
  });
  return { browser, context, cache, counters, unsupplied };
}

/**
 * Executes one declarative preparation step: a reader's own affordances, in a reader's order.
 *
 * Returns a sentence when the step cannot be taken and `null` when it was. It does not throw, so the
 * unreachable-kind case is one more thing the check reports rather than a bare throw this repository
 * would have to record as debt in bareThrowsBaseline.json. Either way the check fails, and the
 * failure names the step.
 */
async function prepare(page: Page, step: LabPreparation): Promise<string | null> {
  switch (step.kind) {
    case "open-settings-drawers": {
      // The apply control of several labs sits inside the "Experiment settings" drawer, so a
      // closed disclosure hides it and the press would silently do nothing.
      await page.evaluate(() => {
        for (const details of document.querySelectorAll("details")) details.open = true;
      });
      return null;
    }
    case "press": {
      const button = page.getByRole("button", { name: step.name, exact: true }).first();
      await button.scrollIntoViewIfNeeded();
      await button.click({ timeout: 15000 });
      return null;
    }
    case "select": {
      await page.locator(`select[id$="-${step.field}"]`).first().selectOption(step.value);
      return null;
    }
    case "check": {
      const box = page.getByRole("checkbox", { name: new RegExp(step.labelMatches, "u") }).first();
      await box.scrollIntoViewIfNeeded();
      await box.check({ timeout: 15000 });
      return null;
    }
    case "fill": {
      const field = page.locator(`input[id$="-${step.field}"]`).first();
      await field.scrollIntoViewIfNeeded();
      await field.fill(step.value);
      return null;
    }
    default: {
      const exhaustive: never = step;
      return `unhandled laboratory preparation step: ${JSON.stringify(exhaustive)}`;
    }
  }
}

type LabelReading = Readonly<{ labels: readonly string[]; texts: readonly string[] }>;

function readLabels(page: Page): Promise<LabelReading> {
  return page.evaluate(() => ({
    labels: [...document.querySelectorAll("[data-execution-label]")].map(
      (element) => element.getAttribute("data-execution-label") ?? "",
    ),
    texts: [
      ...new Set(
        [...document.querySelectorAll("p.execution-label")].map((element) =>
          (element.textContent ?? "").trim(),
        ),
      ),
    ],
  }));
}

/** Opens one laboratory, answers its predict gate as a reader would, and returns the page. */
async function openLab(state: ProbeState, lab: string): Promise<{ page: Page; errors: string[] }> {
  const page = await state.context.newPage();
  state.unsupplied.clear();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  const response = await page.goto(`${SYNTHETIC_ORIGIN}/lab/${lab}/`, { waitUntil: "load" });
  const status = response?.status() ?? 0;
  if (status !== 200) errors.push(`the deployment answered ${status} for /lab/${lab}/`);
  const skip = page.getByRole("button", { name: "Skip prediction" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  return { page, errors };
}

export async function createCandidateBrowserProbe(
  fetcher: Fetcher,
): Promise<CandidateBrowserProbe & Readonly<{ requestsServed: () => number }>> {
  const state = await open(fetcher);
  return Object.freeze({
    requestsServed: () => state.counters.served,
    async observeAcceptedWasm(target: WasmCapabilityTarget): Promise<AcceptedWasmObservation> {
      const { page, errors } = await openLab(state, target.lab);
      const wasmRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith(".wasm")) wasmRequests.push(new URL(request.url()).pathname);
      });
      const before = await readLabels(page);
      try {
        for (const step of target.prepare) {
          const problem = await prepare(page, step);
          if (problem !== null) errors.push(problem);
        }
        const apply = page.getByRole("button", { name: target.apply, exact: true }).first();
        if (!(await apply.isVisible().catch(() => false)))
          errors.push(`${target.lab} offers no visible control named "${target.apply}"`);
        else {
          await apply.scrollIntoViewIfNeeded();
          await apply.click({ timeout: 15000 });
          await page.waitForTimeout(SETTLE_MS);
        }
      } catch (error) {
        errors.push(`driving ${target.lab} failed: ${String(error).slice(0, 200)}`);
      }
      const after = await readLabels(page);
      errors.push(...unsuppliedSentences(state.unsupplied));
      await page.close();
      return Object.freeze({
        capabilityId: target.capabilityId,
        lab: target.lab,
        labelsBefore: Object.freeze([...before.labels]),
        labelsAfter: Object.freeze([...after.labels]),
        labelTexts: Object.freeze([...after.texts]),
        wasmRequests: Object.freeze([...new Set(wasmRequests)]),
        pageErrors: Object.freeze([...errors]),
      });
    },
    async provokeRefusal(target: RefusalTarget): Promise<RefusalObservation> {
      const { page, errors } = await openLab(state, target.lab);
      try {
        for (const step of target.prepare) {
          const problem = await prepare(page, step);
          if (problem !== null) errors.push(problem);
        }
        const apply = page.getByRole("button", { name: target.apply, exact: true }).first();
        if (!(await apply.isVisible().catch(() => false)))
          errors.push(`${target.lab} offers no visible control named "${target.apply}"`);
        else {
          await apply.scrollIntoViewIfNeeded();
          await apply.click({ timeout: 15000 });
          await page.waitForTimeout(SETTLE_MS);
        }
      } catch (error) {
        errors.push(`driving ${target.lab} failed: ${String(error).slice(0, 200)}`);
      }
      const observed = await page.evaluate(() => {
        const main = document.querySelector("main");
        const text = main instanceof HTMLElement ? main.innerText : "";
        return {
          codes: [
            ...new Set(
              [...document.querySelectorAll("[data-refusal-code]")].map(
                (element) => element.getAttribute("data-refusal-code") ?? "",
              ),
            ),
          ],
          readerText: [...document.querySelectorAll(".notice.error")]
            .map((element) =>
              element instanceof HTMLElement ? element.innerText.replace(/\s+/gu, " ").trim() : "",
            )
            .join(" ")
            .slice(0, 600),
          nonFiniteTokens: [...new Set(text.match(/NaN|Infinity/gu) ?? [])],
        };
      });
      errors.push(...unsuppliedSentences(state.unsupplied));
      await page.close();
      return Object.freeze({
        lab: target.lab,
        codes: Object.freeze([...observed.codes]),
        readerText: observed.readerText,
        nonFiniteTokens: Object.freeze([...observed.nonFiniteTokens]),
        pageErrors: Object.freeze([...errors]),
      });
    },
    async close(): Promise<void> {
      await state.context.close();
      await state.browser.close();
    },
  });
}
