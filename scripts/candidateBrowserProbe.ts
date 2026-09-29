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

/** The origin the page believes it is on. It resolves nowhere, which is the point. */
const SYNTHETIC_ORIGIN = "https://candidate-under-test.invalid";

/**
 * How long a press may take to produce a result before the run gives up on it.
 *
 * THE BUG THIS EXISTS FOR (dispatch 504). Three candidates refused BM-01 on the same line while the
 * laboratory worked in every other condition. Driven against one real deployment, one build and
 * this same probe, changing only the ORDER of the targets:
 *
 *   bm-01 first -> bm-01 FAILS with 0 wasm requests; bm-05 and bm-06 pass
 *   bm-01 last  -> bm-05 FAILS with 0 wasm requests; bm-06 and bm-01 pass
 *
 * The defect followed the POSITION, not the laboratory. Every byte here arrives through its own
 * `vercel curl` subprocess, about 300ms each; the first lab driven pays for its worker chunk AND
 * the WASM artifact with a cold cache, and 8000ms of sleep ran out before the fetch was even made.
 * BM-01 refused three candidates for being first in WASM_CAPABILITY_TARGETS.
 *
 * Waiting for the RESULT rather than for the clock is both stricter and faster: a lab that answers
 * in 300ms is not waited on for 8 seconds, and one that needs 20 is not called empty. Nothing about
 * what counts as an accepted result changes; a run that reaches this deadline still fails, and says
 * it waited.
 */
export const RESULT_DEADLINE_MS = 45000;

/**
 * Polls `settled` until it is true, or the deadline passes. Returns the wait, for the record.
 *
 * It takes a `sleep` rather than a Page so the property can be proved without a browser, in a lane
 * this gate does not control: the gate runs in the release pipeline, and a gate whose only proof
 * lives downstream of itself disappears at the moment it fails open.
 */
export async function waitForResult(
  sleep: (ms: number) => Promise<void>,
  settled: () => Promise<boolean>,
  deadlineMs: number = RESULT_DEADLINE_MS,
): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    if (await settled()) return Date.now() - started;
    await sleep(250);
  }
  return Date.now() - started;
}

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

type ProbeState = Readonly<{
  browser: Browser;
  context: BrowserContext;
  /** Immutable deployment, so a path fetched twice is the same bytes; this keeps the count of
   * `vercel curl` subprocesses near the number of DISTINCT assets rather than of requests. */
  cache: Map<string, { status: number; body: Buffer }>;
  counters: { served: number; aborted: number; fetched: number };
}>;

async function open(fetcher: Fetcher): Promise<ProbeState> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
  const cache = new Map<string, { status: number; body: Buffer }>();
  const counters = { served: 0, aborted: 0, fetched: 0 };
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
      const fetched = await fetcher(key);
      response = { status: fetched.status, body: fetched.body };
      cache.set(key, response);
    }
    counters.served += 1;
    await route.fulfill({
      status: response.status === 0 ? 599 : response.status,
      body: response.body,
      contentType: contentTypeForPath(url.pathname),
    });
  });
  return { browser, context, cache, counters };
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
          const waited = await waitForResult(
            (ms) => page.waitForTimeout(ms),
            async () => (await readLabels(page)).labels.includes("frankensim"),
          );
          if (waited >= RESULT_DEADLINE_MS)
            errors.push(
              `${target.lab} produced no frankensim label within ${Math.round(RESULT_DEADLINE_MS / 1000)}s of the press`,
            );
        }
      } catch (error) {
        errors.push(`driving ${target.lab} failed: ${String(error).slice(0, 200)}`);
      }
      const after = await readLabels(page);
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
          await waitForResult(
            (ms) => page.waitForTimeout(ms),
            async () => (await page.locator("[data-refusal-code]").count()) > 0,
          );
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
          /*
           * The live region a reader who cannot see the screen would be told through. Read from the
           * refusal element itself or its nearest ancestor, because that is exactly what an
           * assistive technology follows, and reported as "none" when there is no such region.
           */
          announcedBy: (() => {
            const marked = document.querySelector("[data-refusal-code]");
            const region = marked?.closest("[aria-live],[role='status'],[role='alert']");
            if (!region) return "none";
            return (
              region.getAttribute("aria-live") ?? region.getAttribute("role") ?? "a live region"
            );
          })(),
        };
      });
      await page.close();
      return Object.freeze({
        lab: target.lab,
        codes: Object.freeze([...observed.codes]),
        readerText: observed.readerText,
        nonFiniteTokens: Object.freeze([...observed.nonFiniteTokens]),
        announcedBy: observed.announcedBy,
        pageErrors: Object.freeze([...errors]),
      });
    },
    async close(): Promise<void> {
      await state.context.close();
      await state.browser.close();
    },
  });
}
