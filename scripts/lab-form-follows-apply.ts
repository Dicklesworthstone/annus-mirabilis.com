/**
 * THE FORM MUST SHOW THE NUMBERS THE LABORATORY IS COMPUTING WITH (am-2rl9, dispatch 433).
 *
 * WHY A BROWSER AND NOT `bun test`. Every control here is wired by React, and this repository's DOM
 * harness does not deliver React events, so the one line that makes a form follow an applied change
 * cannot be reached by a unit test: removing `setDraft(toMe01Draft(next))` from ME-01's walkthrough
 * handler leaves every test in playWalkthrough.test.ts green. That gap was reported rather than
 * hidden, and this is what reaches it.
 *
 * WHAT IT COSTS, measured before it was written. A real Playwright click DOES reach React in the
 * static export: clicking ME-01's "Stationary observer (v = 0)" against out/ took its frame-speed
 * field from 0.6 to 0 with zero page errors, served by the 40-line static server below, in about a
 * second. No dev server, no `next build`, no shared generator. The only ingredient a build supplies
 * is the page itself, so this runs against whatever out/ currently holds and says plainly which
 * controls that build does not contain.
 *
 * It deliberately does not live in scripts/e2e-paper-vertical-slices.ts. That harness carries the
 * browser launch, viewports, evidence retention and JSONL, and no scenario source: its paper lanes
 * are am-test-e2e-harness-bqmh's scope, and hard-coding a lab scenario into it would misrepresent
 * that bead as done. When those lanes land, this check is a scenario for them and this file goes.
 *
 * THE PROPERTY. Three controls on ME-01 apply settings, and each does the same pair: set the form's
 * draft, then apply the parameters. `loadPreset` does it, the linked-settings button does it, and the
 * walkthrough control added in 00ac4861 does it. If the first half is dropped the laboratory computes
 * with new numbers while the fields still show the old ones, which is the defect this repository has
 * paid for twelve times over. So after each control: the frame-speed field and the frame speed in the
 * laboratory's own status sentence must agree.
 *
 *   bun scripts/lab-form-follows-apply.ts [--base-url http://host:port]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const OUT = join(ROOT, "out");
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

/*
 * The exported site, served as a static host serves it: a directory is its index.html.
 *
 * node:http rather than Bun.serve, because this repository's ambient Bun type declares only
 * Bun.build, and a script under scripts/ is typechecked: a file referencing an undeclared Bun member
 * breaks `bun run check:types` for every pane, which AGENTS.md records costing twenty minutes once
 * already.
 */
function serveExport(port: number): Promise<Server> {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname));
    for (const candidate of [
      join(OUT, path),
      join(OUT, path, "index.html"),
      `${join(OUT, path)}.html`,
    ]) {
      if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
      response.writeHead(200, {
        "content-type": TYPES[extname(candidate)] ?? "application/octet-stream",
      });
      response.end(readFileSync(candidate));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok(server));
  });
}

/**
 * WHAT GENERALISES AND WHAT DOES NOT (dispatch 436).
 *
 * The click harness generalises: any laboratory page in the export can be opened and any control
 * pressed. The OBSERVABLE does not. The form-follows-apply property below compares ME-01's
 * frame-speed field against the frame speed in ME-01's own status sentence, and each laboratory words
 * its status line and names its fields differently, so a per-laboratory table of observables would be
 * five hand-written pairs maintained against five components. So the strong property is checked where
 * it is observable, on ME-01, and every laboratory that mounts the walkthrough control is checked for
 * the general property instead: pressing it produces a result notice and no page error.
 */
const FORM_FOLLOWS_LAB = "me-01";
const FORM_FOLLOWS_CONTROLS: readonly string[] = [
  "Stationary observer (v = 0)",
  "Transverse emission (v = 0.6c, φ = 90°)",
  "Collinear emission (v = 0.6c, φ = 0°)",
];
/** Every laboratory that mounts the walkthrough control (dispatch 436). */
const WALKTHROUGH_LABS: readonly string[] = ["me-01", "lq-05", "lq-06", "lq-07", "lq-09"];

async function main(): Promise<number> {
  const urlArg = process.argv.indexOf("--base-url");
  const external = urlArg > 0 ? process.argv[urlArg + 1] : process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "lab/me-01/index.html"))) {
      console.error(
        "out/lab/me-01/index.html is absent: this reads a built site. Run a build, or pass --base-url.",
      );
      return 2;
    }
    for (const port of [47823, 47824, 47825]) {
      try {
        server = await serveExport(port);
        base = `http://127.0.0.1:${port}`;
        break;
      } catch {
        // A peer may hold the port; try the next.
      }
    }
    if (!server) {
      console.error("could not bind a local port to serve out/; pass --base-url instead.");
      return 2;
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${base}/lab/${FORM_FOLLOWS_LAB}/`, { waitUntil: "load", timeout: 30000 });

  // Predict mode hides the results until the reader answers, so answer it as a reader would.
  const skip = page.getByRole("button", { name: "Skip prediction" });
  if (await skip.isVisible().catch(() => false)) await skip.click();

  /*
   * The frame speed the form shows, and the one the laboratory says it is computing with.
   *
   * Two things this got wrong first, both of them the instrument rather than the page. The status
   * must be read from `p.status-line`, the laboratory's own accepted-status element: matching the
   * phrase anywhere in <main> matched the page's own prose about 0.6c and reported two false
   * disagreements. And AcceptedStatus spaces its announcements by a deliberate second, so that a
   * fast control cannot produce a fast live region, which means a check reading it 500ms after a
   * click reads the PREVIOUS announcement. So it is polled until it settles.
   */
  const STATUS = "p.status-line";
  const statusText = async () =>
    (
      await page
        .locator(STATUS)
        .first()
        .innerText()
        .catch(() => "")
    ).replace(/\s+/gu, " ");

  /*
   * WAIT FOR THE ANNOUNCEMENT TO CHANGE, NOT FOR IT TO HOLD STILL.
   *
   * Three things this got wrong in turn, all of them the instrument rather than the page. The status
   * must be read from `p.status-line`, the laboratory's own accepted-status element: matching the
   * phrase anywhere in <main> matched the page's own prose about 0.6c. The frame-speed field must be
   * read by its id prefix, because answering the prediction renders the results region and puts other
   * inputs before it in document order. And AcceptedStatus spaces its announcements by a deliberate
   * second, so that a fast control cannot produce a fast live region (AGENTS.md: a 60 Hz animation
   * never produces a 60 Hz live-region stream) - which means polling for STABILITY is fooled, since
   * two reads 300ms apart both show the old text and look settled. So the pre-click text is carried
   * in and the poll waits for it to differ.
   */
  async function statusAfter(previous: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const now = await statusText();
      if (now !== "" && now !== previous) return now;
      await page.waitForTimeout(250);
    }
    return await statusText();
  }

  /** The frame speed the form shows, and the one the laboratory says it is computing with. */
  async function shownAndComputed(previous: string): Promise<{
    field: number;
    status: number | null;
    text: string;
  }> {
    const text = await statusAfter(previous);
    const field = Number(
      await page
        .locator('input[id^="frameSpeed-"]')
        .first()
        .inputValue()
        .catch(() => Number.NaN.toString()),
    );
    const match = /moving at ([-\d.]+)c/u.exec(text);
    return { field, status: match ? Number(match[1]) : null, text };
  }

  let present = 0;
  let clicked = 0;
  let agreed = 0;
  const absent: string[] = [];
  const disagreed: string[] = [];
  for (const name of FORM_FOLLOWS_CONTROLS) {
    const control = page.getByRole("button", { name, exact: true });
    if (!(await control.isVisible().catch(() => false))) {
      absent.push(name);
      continue;
    }
    present += 1;
    // The announcement before the click, so the wait below can tell a new one from the old.
    const before = await statusText();
    await control.click({ timeout: 10000 });
    clicked += 1;
    const { field, status } = await shownAndComputed(before);
    if (status === null) {
      disagreed.push(`${name}: the laboratory printed no status sentence to compare against`);
      continue;
    }
    if (Number.isFinite(field) && Math.abs(field - status) < 1e-12) agreed += 1;
    else
      disagreed.push(
        `${name}: the form shows ${field} and the laboratory is computing with ${status}`,
      );
  }

  console.log(
    `[form follows apply] ${FORM_FOLLOWS_CONTROLS.length} controls named on ${FORM_FOLLOWS_LAB}, ` +
      `${present} present in this build, ${clicked} clicked, ${agreed} agreed`,
  );
  for (const name of absent) console.log(`  absent from this build, so not checked: "${name}"`);
  for (const line of disagreed) console.log(`  DISAGREED: ${line}`);

  // Every laboratory that mounts the walkthrough control: pressing it says something to a reader.
  let walkButtons = 0;
  let walkPlayed = 0;
  const walkAbsent: string[] = [];
  for (const lab of WALKTHROUGH_LABS) {
    await page.goto(`${base}/lab/${lab}/`, { waitUntil: "load", timeout: 30000 });
    const skipHere = page.getByRole("button", { name: "Skip prediction" });
    if (await skipHere.isVisible().catch(() => false)) await skipHere.click();
    const controls = page.locator("button[data-walkthrough]");
    const count = await controls.count();
    if (count === 0) {
      walkAbsent.push(lab);
      continue;
    }
    for (let index = 0; index < count; index += 1) {
      walkButtons += 1;
      await controls.nth(index).click({ timeout: 10000 });
      const notice = page.locator('[data-walkthrough-result="played"]');
      if (
        await notice
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      )
        walkPlayed += 1;
      else disagreed.push(`${lab}: a walkthrough button produced no played notice`);
    }
  }
  console.log(
    `[walkthrough controls] ${WALKTHROUGH_LABS.length} laboratories, ${walkButtons} buttons found, ` +
      `${walkPlayed} played`,
  );
  for (const lab of walkAbsent) console.log(`  no walkthrough control in this build: ${lab}`);

  if (pageErrors.length > 0) console.log(`  page errors: ${pageErrors.join(" | ")}`);

  await browser.close();
  server?.close();
  // A build too old to carry a control is not a pass for that control, and a run that clicked
  // nothing is not a pass at all.
  const ok = clicked > 0 && disagreed.length === 0 && pageErrors.length === 0;
  console.log(ok ? "ok" : "FAILED");
  return ok ? 0 : 1;
}

process.exit(await main());
