/**
 * THE INSTRUMENT FIRST, AND ONE QUIET STATUS LINE (dispatch 259).
 *
 * Measured on live on 2026-09-26: LQ-08's instrument began about 520px down at 1440, under a large
 * hero, and above it sat three bordered boxes (the execution label, a currency chip reading
 * "Current. These numbers match the current settings." and a boxed "Model note"). At 390 the first
 * screen held no instrument at all.
 *
 * This serves a static build (`out/`, or the directory after `--out`) and measures every
 * laboratory under src/app/lab at 1440x900 and 390x844. For each it records:
 * - the instrument's top: the first plot, scene or table (an svg, canvas or table at least 120 by
 *   60 CSS px) inside `[data-instrument-id]`, in page coordinates. Predict mode hides the response
 *   plot until the reader predicts (0 by 0 on SR-01, ME-01, BM-03 and BM-04 when probed), so the prediction or control
 *   fieldset that stands in for it counts too: it is the instrument's first working surface.
 *   Anything inside a closed <details> or a [hidden] ancestor does not;
 * - how many bordered boxes inside <main> end above that top;
 * - whether a currency notice is visible in the default state, and in which state;
 * - whether the execution label or the model note is drawn as a box.
 *
 * It FAILS when:
 * - a laboratory with an instrument root has no plot, scene, table or fieldset the measure can
 *   find (so a missed selector cannot read as a pass);
 * - at 1440 an instrument begins more than 600px down;
 * - a currency notice is visible in the accepted state. Only running, refused and stale carry
 *   news; "these numbers are current" is not news;
 * - the execution label or the model note carries a border;
 * - BM-06, driven into its FTCS refusal, does not show the refused notice. That is the positive
 *   control: a gate that hid every notice would pass the accepted-state check.
 *
 * Every row prints as it is measured, and every navigation has a timeout.
 *
 *   bun scripts/test-lab-chrome-browser.mjs [--out <static build dir>]
 */
import { readdirSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";

const argOut = process.argv.indexOf("--out");
const root = resolve(argOut > 0 ? process.argv[argOut + 1] : "out");
const LAB_SOURCE = resolve("src/app/lab");
const labs = readdirSync(LAB_SOURCE)
  .filter((name) => statSync(join(LAB_SOURCE, name)).isDirectory())
  .sort();

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];
const TOP_LIMIT_1440 = 600;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
    );
    if (file !== root && !file.startsWith(root + sep)) throw new Error("outside root");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}`;

/** Runs in the page: the measurements for one laboratory. */
function measure() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const bordered = (el) => {
    const cs = getComputedStyle(el);
    return ["Top", "Right", "Bottom", "Left"].some(
      (side) =>
        Number.parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== "none",
    );
  };
  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const instrument = document.querySelector("[data-instrument-id]");
  // The highest candidate on the page, not the first in document order: in a two-column lab the
  // plot in the right column can sit above the prediction in the left one (LQ-08: 765 against 917).
  let first = null;
  if (instrument) {
    for (const el of instrument.querySelectorAll("svg, canvas, table, fieldset")) {
      if (el.closest("details:not([open]), [hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 60 || !visible(el)) continue;
      if (first === null || r.top < first.getBoundingClientRect().top) first = el;
    }
  }
  const top = first ? Math.round(pageTop(first)) : null;
  const main = document.querySelector("main") ?? document.body;
  let boxesAbove = 0;
  if (top !== null) {
    for (const el of main.querySelectorAll("*")) {
      if (!visible(el) || !bordered(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom + window.scrollY <= top) boxesAbove++;
    }
  }
  const notices = [...document.querySelectorAll(".execution-currency")]
    .filter(visible)
    .map((el) => el.getAttribute("data-currency-state"));
  const chromeBoxed = [...document.querySelectorAll(".execution-label, .model-note")]
    .filter((el) => visible(el) && bordered(el))
    .map((el) => el.className);
  return {
    instrumentId: instrument?.getAttribute("data-instrument-id") ?? null,
    firstKind: first ? first.tagName.toLowerCase() : null,
    top,
    boxesAbove,
    notices,
    chromeBoxed,
  };
}

const browser = await chromium.launch();
const rows = [];
const failures = [];
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    for (const lab of labs) {
      let row;
      try {
        await page.goto(`${url}/lab/${lab}/`, { waitUntil: "load", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(300);
        row = { lab, viewport: viewport.name, ...(await page.evaluate(measure)) };
      } catch (error) {
        row = { lab, viewport: viewport.name, error: String(error).slice(0, 160) };
      }
      rows.push(row);
      console.log(JSON.stringify(row));
      const at = `${lab} at ${viewport.name}`;
      if (row.error) failures.push(`${at}: did not load (${row.error})`);
      else if (row.instrumentId && row.top === null)
        failures.push(
          `${at}: instrument ${row.instrumentId} has no plot, scene, table or fieldset found`,
        );
      if (viewport.name === "1440" && row.top !== null && row.top > TOP_LIMIT_1440)
        failures.push(`${at}: the instrument begins ${row.top}px down (limit ${TOP_LIMIT_1440})`);
      if (row.notices?.includes("accepted"))
        failures.push(`${at}: a currency notice is visible in the accepted state`);
      if (row.chromeBoxed?.length)
        failures.push(`${at}: boxed chrome: ${row.chromeBoxed.join(", ")}`);
    }
    await context.close();
  }

  // Positive control: a refusal must still show its notice.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${url}/lab/bm-06/`, { waitUntil: "load", timeout: 30000 });
  const lab = page.locator('[data-instrument-id="bm-06"]').first();
  const apply = lab.getByRole("button", { name: "Apply settings", exact: true });
  await apply.waitFor();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  await lab.locator("details.experiment-settings > summary").click();
  await lab.getByRole("button", { name: "Try a step that is too large", exact: true }).click();
  await apply.click();
  const refused = lab.locator('.execution-currency[data-currency-state="refused"]');
  const shown = await refused
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  console.log(JSON.stringify({ control: "bm-06 refusal", refusedNoticeVisible: shown }));
  if (!shown) failures.push("bm-06: driven into its FTCS refusal, no refused notice is visible");
  await context.close();
} finally {
  await browser.close();
  server.close();
}

// The table, with its denominators.
const measured = rows.filter((r) => !r.error);
const withTop = measured.filter((r) => r.top !== null);
console.log(`\nlab | viewport | instrument top | boxes above | notice | boxed chrome`);
for (const r of rows)
  console.log(
    r.error
      ? `${r.lab} | ${r.viewport} | error`
      : `${r.lab} | ${r.viewport} | ${r.top ?? "none"} | ${r.boxesAbove} | ${r.notices.join("+") || "-"} | ${r.chromeBoxed.length}`,
  );
for (const viewport of VIEWPORTS) {
  const v = withTop.filter((r) => r.viewport === viewport.name);
  const tops = v.map((r) => r.top).sort((a, b) => a - b);
  const notice = measured.filter(
    (r) => r.viewport === viewport.name && r.notices.includes("accepted"),
  ).length;
  console.log(
    `[lab chrome] ${viewport.name}: ${labs.length} labs / ${v.length} instruments measured; top median ${tops[Math.floor(tops.length / 2)] ?? "-"}px, max ${tops.at(-1) ?? "-"}px; ${v.filter((r) => r.top <= TOP_LIMIT_1440).length} within ${TOP_LIMIT_1440}px; accepted notice visible on ${notice}`,
  );
}
if (failures.length) {
  console.log(`\n${failures.length} failures:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nlab chrome: every check passed");
