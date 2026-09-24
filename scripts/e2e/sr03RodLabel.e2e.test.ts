/**
 * SR-03's rod is labelled with the rod's length, and the platform marks are named, in a real
 * browser (am-sr03-default-readings-not-rod-ends-bf7w).
 *
 * The default readings are two platform marks 10 ls apart, simultaneous in K; the rod rests in k.
 * Live once printed "a distance in frame K: 10.00 ls" directly above the rod drawn at 8.00 ls, and
 * a reader took the platform distance for the rod's length. src/experiments/sr03/readings.test.ts
 * proves the view model; this reads what a reader sees, from the built site (out/), in Chromium and
 * WebKit at 390 and 1440 px: at load (0.6c) and after the lab's own settings link at 0.8c is
 * applied through the settings drawer, as a reader applies it. A load with JavaScript off reads the
 * static HTML. The label beside the drawn rod in K must give L0/γ (8.00, then 6.00 ls), the verdict
 * must name the platform marks and never call their 10 ls the rod's length, and the values table's
 * row for their separation must say "platform marks, not the rod".
 *
 * The number beside each drawn rod must also agree with the drawing: the two strips' drawn lengths
 * stand in the ratio of their labels (8 : 10 at load), whatever the figure's scale.
 *
 * By default this serves the built site (out/, which must be fresh). With AM_E2E_ORIGIN set to a
 * deployed origin (https://annus-mirabilis.com) it reads that site instead, as a reader's browser
 * does; that is how the fix was checked on live.
 *
 * A browser that fails to launch fails this test; it is not skipped. Each case writes one JSON line
 * to artifacts/test-logs/sr03-rod-label/<log-run-id>.jsonl, and a failing case keeps a screenshot,
 * trace, DOM snapshot, console log and network log.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page, webkit } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { retainE2EEvidence } from "./evidence.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const SUITE = "sr03-rod-label";
const BEAD_ID = "am-sr03-default-readings-not-rod-ends-bf7w";
const ROUTE = "/lab/sr-03/";
/** The lab's own settings link (experiments/sr03/permalink.ts) for the default readings at 0.8c. */
const AT_0_8C =
  "?sr=3&rodRestFrame=k&v=0.8&L0=10&measuringFrame=K&endpointPairId=platform-simultaneous&R=1";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    if (existsSync(filePath) && statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolveServer({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

type Case = Readonly<{
  name: string;
  query: string;
  jsEnabled: boolean;
  rodK: string;
  speed: string;
}>;
const CASES: readonly Case[] = [
  { name: "load", query: "", jsEnabled: true, rodK: "8.00", speed: "0.60" },
  { name: "v0.8", query: AT_0_8C, jsEnabled: true, rodK: "6.00", speed: "0.80" },
  { name: "load-nojs", query: "", jsEnabled: false, rodK: "8.00", speed: "0.60" },
];

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function readLab(page: Page) {
  const text = async (selector: string) =>
    squash((await page.locator(selector).first().textContent()) ?? "");
  return {
    note: await text('[data-view-id="sr-03-strip-view"] .sr03-figure-note'),
    verdict: await text(".sr03-verdict"),
    kind: (await page.locator(".sr03-verdict").first().getAttribute("data-readings-kind")) ?? "",
    stripK: await text('[data-rod-frame="K"] .sr03-strip-label'),
    tableRow: await text('tr[data-quantity-id="measuredLength"] th'),
    labelk: await text('[data-rod-frame="k"] .sr03-strip-label'),
    // The drawn rods: each strip's bar, whose width is the rod's length at the figure's scale.
    drawnK: Number(
      await page.locator('[data-rod-frame="K"] svg rect').first().getAttribute("width"),
    ),
    drawnk: Number(
      await page.locator('[data-rod-frame="k"] svg rect').first().getAttribute("width"),
    ),
  };
}

/** The first "N.NN ls" in a strip label. */
const lsIn = (label: string) => Number(/([0-9]+\.[0-9]+) ls/.exec(label)?.[1] ?? Number.NaN);

/** What a case must show; each entry names the failure in a reader's terms. */
function problems(c: Case, seen: Awaited<ReturnType<typeof readLab>>): string[] {
  const out: string[] = [];
  if (!seen.note.includes(`v = ${c.speed}c`))
    out.push(`the figure is not at ${c.speed}c: "${seen.note}"`);
  if (!seen.stripK.includes(`Frame K, the platform: ${c.rodK} ls`))
    out.push(`the rod drawn in K is not labelled ${c.rodK} ls: "${seen.stripK}"`);
  if (!seen.verdict.includes(`is ${c.rodK} ls long there`))
    out.push(`the verdict does not give the rod ${c.rodK} ls: "${seen.verdict}"`);
  if (!seen.verdict.includes("two marks on the platform, not the rod's ends"))
    out.push(`the verdict does not name the platform marks: "${seen.verdict}"`);
  if (seen.verdict.includes("the rod's length there:"))
    out.push(`the verdict calls the marks' separation the rod's length: "${seen.verdict}"`);
  if (seen.kind !== "platform-marks") out.push(`data-readings-kind is "${seen.kind}"`);
  if (!seen.tableRow.includes("platform marks, not the rod"))
    out.push(`the table row for the separation does not say platform marks: "${seen.tableRow}"`);
  const drawn = seen.drawnK / seen.drawnk;
  const labelled = lsIn(seen.stripK) / lsIn(seen.labelk);
  if (!(Math.abs(drawn - labelled) < 0.01))
    out.push(
      `the drawn rods stand ${drawn.toFixed(3)} : 1 but their labels ${labelled.toFixed(3)} : 1`,
    );
  return out;
}

test("SR-03 labels the rod with its own length and names the platform marks (am-sr03-default-readings-not-rod-ends-bf7w)", {
  timeout: 240_000,
}, async () => {
  const remote = process.env.AM_E2E_ORIGIN?.replace(/\/$/, "");
  let freshnessNote = `deployed site ${remote}`;
  let server: Server | null = null;
  let origin = remote ?? "";
  if (!remote) {
    freshnessNote = `out/ ${assertOutFreshness("out", REPO_ROOT).reason ?? "fresh"}`;
    assert.ok(existsSync(join(OUT_DIR, "lab", "sr-03", "index.html")), "out/ has no /lab/sr-03/");
    ({ server, origin } = await startStaticServer(OUT_DIR));
  }
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const scratch = join(REPO_ROOT, "artifacts", "e2e-scratch", SUITE, logRunId);
  mkdirSync(scratch, { recursive: true });
  const failures: string[] = [];
  let examined = 0;
  try {
    for (const [engineName, engine] of [
      ["chromium", chromium],
      ["webkit", webkit],
    ] as const) {
      const browser: Browser = await engine.launch({ headless: true });
      try {
        for (const width of [390, 1440]) {
          for (const c of CASES) {
            if (!c.jsEnabled && engineName !== "chromium") continue;
            const lane = `${engineName}-${width}-${c.name}`;
            const context = await browser.newContext({
              viewport: { width, height: 900 },
              javaScriptEnabled: c.jsEnabled,
              ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
            });
            await context.tracing.start({ screenshots: true, snapshots: true });
            const page = await context.newPage();
            const consoleLines: string[] = [];
            const network: string[] = [];
            page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
            page.on("pageerror", (e) => consoleLines.push(`pageerror: ${String(e)}`));
            page.on("response", (r) => network.push(`${r.status()} ${r.url()}`));
            const start = performance.now();
            let found: string[] = [];
            let seen: Awaited<ReturnType<typeof readLab>> | null = null;
            try {
              await page.goto(`${origin}${ROUTE}${c.query}`, { waitUntil: "load" });
              if (c.query) {
                // A shared link fills the form; the reader opens the drawer and applies it.
                const drawer = page.locator('details:has(button[type="submit"]) > summary').first();
                if (!(await drawer.evaluate((s) => (s.parentElement as HTMLDetailsElement).open)))
                  await drawer.click();
                await page
                  .getByRole("button", { name: /apply settings/i })
                  .first()
                  .click();
                await page
                  .locator('[data-view-id="sr-03-strip-view"] .sr03-figure-note')
                  .first()
                  .filter({ hasText: `v = ${c.speed}c` })
                  .waitFor({ timeout: 10_000 });
              }
              seen = await readLab(page);
              found = problems(c, seen);
            } catch (error) {
              found = [`could not read the lab: ${String(error)}`];
            }
            examined++;
            // A failing lane keeps its evidence FIRST, and its event names the retained screenshot and
            // DOM snapshot: the log schema refuses a failed browser event without them, so logging
            // before capturing would throw and hide the reason the lane failed.
            let evidence: Record<string, string> | undefined;
            if (found.length > 0) {
              const base = join(scratch, lane);
              const capture = {
                screenshot: `${base}.png`,
                trace: `${base}.trace.zip`,
                dom: `${base}.dom.html`,
                console: `${base}.console.log`,
                network: `${base}.network.log`,
              };
              await page.screenshot({ path: capture.screenshot, fullPage: true }).catch(() => {});
              await context.tracing.stop({ path: capture.trace }).catch(() => {});
              writeFileSync(capture.dom, await page.content().catch(() => ""));
              writeFileSync(capture.console, consoleLines.join("\n"));
              writeFileSync(capture.network, network.join("\n"));
              const retained = await retainE2EEvidence(
                {
                  suite: SUITE,
                  logRunId,
                  testId: `sr03-rod-label-${c.name}`,
                  lane,
                  beadId: BEAD_ID,
                  outcome: "failed",
                  message: found.join("; "),
                },
                capture,
              );
              const kept = (source: string) =>
                retained.copied.find((copy) =>
                  copy.endsWith(source.slice(source.lastIndexOf("/"))),
                ) ?? source;
              evidence = Object.fromEntries(
                Object.entries(capture).map(([kind, source]) => [kind, kept(source)]),
              );
              failures.push(`${lane}: ${found.join("; ")}`);
            } else {
              await context.tracing.stop();
            }
            logger.log({
              testId: `sr03-rod-label-${c.name}`,
              beadId: BEAD_ID,
              paper: "special-relativity",
              instrumentId: "sr-03",
              expected: `rod in K ${c.rodK} ls; platform marks named; never "the rod's length there:"`,
              actual: seen ? `${seen.stripK} | ${seen.verdict} | ${seen.tableRow}` : "unread",
              comparisonKind: "formatted",
              outcome: found.length === 0 ? "passed" : "failed",
              durationMs: Math.round(performance.now() - start),
              browser: engineName,
              viewport: `${width}x900`,
              jsEnabled: c.jsEnabled,
              message: found.length === 0 ? `${lane}: rod labelled ${c.rodK} ls` : found.join("; "),
              ...(evidence ? { evidence } : {}),
            });
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    logger.flushSync();
    server?.close();
  }
  // Two engines at two widths with JavaScript, three cases each in Chromium: 10 readings.
  console.log(`[sr03 rod label] ${examined} readings examined (${freshnessNote})`);
  assert.equal(examined, 10, "a lane was not examined");
  assert.deepEqual(failures, []);
});
