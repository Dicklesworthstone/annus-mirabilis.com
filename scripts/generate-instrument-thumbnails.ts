/**
 * Pictures of each instrument's worked default for the /instruments/ catalogue, so a reader sees what
 * an instrument looks like before opening it (TanElk dispatch 95).
 *
 * WHAT IT READS. A served static export (`out/`, e.g. `python3 -m http.server 4135 -d out`). For
 * every registered catalogue id it loads /lab/<id>/ at 1440x900 in the light theme, waits for the
 * page to settle, and photographs the instrument's main drawing: the first visible <svg> or
 * <canvas> inside the laboratory that is at least 240x140 CSS px. Some instruments draw nothing and
 * answer with a panel of words, numbers and bars. Those get no picture, and the catalogue shows
 * their question alone: a panel shown at 20rem is its text at about a quarter of its size, grey
 * noise rather than a picture of the instrument. That was found first for tables and then, on
 * 2026-09-23, for the text panels of lq-06, sr-07 and the three shelf instruments, whose pictures
 * were unreadable lines of type. Nothing is computed here; the picture is whatever the built page
 * shows for its own worked example.
 *
 * AN INSTRUMENT THAT ANSWERS WITH A TABLE is not photographed. Its first visible table is read
 * instead: the names of the columns of values it compares and the first rows' labels, as text, with any
 * superscript or subscript kept as such (e^{−x} is not "e−x"). No value is copied, so the plate
 * cannot show a number that has since changed. The catalogue sets those words as a small table
 * of its own, legible at the plate's size, where a photograph of the same table was grey noise.
 *
 * WHAT IT WRITES. public/figures/instruments/<id>.webp, 640px wide (the catalogue shows it about
 * 20rem wide, so this is sharp at 2x), converted with ImageMagick, and manifest.json listing the
 * ids pictured in this run with the kind of picture, and under "tables" the words read from each
 * table-answering instrument. The catalogue shows a picture only for an id the manifest lists, so
 * a file left from an earlier run, such as a table photographed before tables were refused, is not
 * shown. An id with neither a picture nor a table is reported.
 *
 * WHEN TO RE-RUN. After a build that changes how a laboratory draws its default. The pictures are a
 * record of a build, not a live render, and they go stale the way any screenshot does.
 *
 * Usage: bun scripts/generate-instrument-thumbnails.ts [--base http://127.0.0.1:4135] [--only <id>,...]
 *        [--out <dir>]   (default public/figures/instruments; point it elsewhere to review first)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../src/experiments/catalogue.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WIDTH = 640;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const base = arg("--base") ?? "http://127.0.0.1:4135";
const only = arg("--only")?.split(",");
const OUT_DIR = arg("--out") ?? join(ROOT, "public/figures/instruments");
const ids = CATALOGUE_IDS.filter(
  (id) => CATALOGUE_STATUS[id] === "registered" && (!only || only.includes(id)),
);

mkdirSync(OUT_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "instrument-thumbs-"));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  reducedMotion: "reduce",
  // The repository's rule for any web request, which this is when --base is the live site.
  userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0",
});
const written: string[] = [];
const tabled: string[] = [];
const missing: string[] = [];
/** One stretch of a label: plain text, or text the page sets as a superscript or a subscript. */
type Run = { t: string; s?: "sup" | "sub" };
/** What a table-answering instrument's plate shows: the columns of values it compares, and its rows' labels. */
type TableWords = { head: Run[][]; rows: Run[][] };
// The manifest carries over ids this run does not examine (an --only run) and is rewritten for
// every id it does: pictured, or removed when this run found no usable picture.
const manifestPath = join(OUT_DIR, "manifest.json");
const previous = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as {
      pictures: Record<string, "drawing" | "results">;
      tables?: Record<string, TableWords>;
    })
  : { pictures: {}, tables: {} };
const manifest: Record<string, "drawing" | "results"> = previous.pictures;
const tables: Record<string, TableWords> = previous.tables ?? {};
/** The first rows are enough to say what a table is about; the plate has room for about four. */
const ROWS = 4;
for (const id of ids) {
  const page = await context.newPage();
  await page.goto(`${base}/lab/${id}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const handle = await page.evaluateHandle(() => {
    const main = document.querySelector("main");
    const root =
      main?.querySelector("[data-instrument-id], .laboratory, .laboratory-shell") ?? main;
    const intro = main?.querySelector(".page-intro");
    const visible = (el: Element, minHeight: number) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width >= 240 &&
        r.height >= minHeight &&
        s.visibility !== "hidden" &&
        !el.closest("details:not([open]) > :not(summary)") &&
        !intro?.contains(el)
      );
    };
    const drawing = [...(root?.querySelectorAll("svg, canvas") ?? [])].find(
      (el) =>
        !(el.tagName.toLowerCase() === "svg" && el.parentElement?.closest("svg")) &&
        visible(el, 140),
    );
    return drawing ? { el: drawing, kind: "drawing" } : null;
  });
  const found = await handle.evaluate((v) => (v ? v.kind : null));
  const el = found ? (await handle.getProperty("el")).asElement() : null;
  if (!el) {
    delete manifest[id];
    const words = await page.evaluate((rowLimit) => {
      const main = document.querySelector("main");
      const root =
        main?.querySelector("[data-instrument-id], .laboratory, .laboratory-shell") ?? main;
      const intro = main?.querySelector(".page-intro");
      const table = [...(root?.querySelectorAll("table") ?? [])].find((t) => {
        const r = t.getBoundingClientRect();
        return (
          r.width >= 240 &&
          getComputedStyle(t).visibility !== "hidden" &&
          !t.closest("details:not([open])") &&
          !intro?.contains(t)
        );
      });
      if (!table) return null;
      // A cell's words as runs. <sup> and <sub> keep their role; a <small> is a cell's second,
      // quieter line (avogadro-lab's route under its method) and is left out; anything else is
      // read for its text.
      const runs = (cell: Element) => {
        const out: { t: string; s?: "sup" | "sub" }[] = [];
        const walk = (node: Node) => {
          for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              out.push({ t: child.textContent ?? "" });
            } else if (child instanceof Element) {
              const tag = child.tagName.toLowerCase();
              if (tag === "small") continue;
              if (tag === "sup" || tag === "sub") out.push({ t: child.textContent ?? "", s: tag });
              else walk(child);
            }
          }
        };
        walk(cell);
        const merged: typeof out = [];
        for (const run of out) {
          const last = merged[merged.length - 1];
          if (last && last.s === run.s) last.t += run.t;
          else merged.push({ ...run });
        }
        return merged
          .map((run) => ({ ...run, t: run.t.replace(/\s+/g, " ") }))
          .map((run, i, all) => {
            let t = run.t;
            if (i === 0) t = t.trimStart();
            if (i === all.length - 1) t = t.trimEnd();
            return { ...run, t };
          })
          .filter((run) => run.t.length > 0);
      };
      const bodyRows = [...table.querySelectorAll("tbody tr")].slice(0, rowLimit);
      // A heading names a compared column only when that column holds values: a digit in more
      // than half of the rows read. "Unit" over Hz, J, J and 1, or "Role in this paper" over
      // words, is furniture.
      const holdsValues = (column: number) =>
        bodyRows.filter((tr) => /\d/.test(tr.children[column]?.textContent ?? "")).length * 2 >
        bodyRows.length;
      const headRow = table.querySelector("thead tr");
      const head = headRow
        ? [...headRow.children]
            .map((cell, column) => ({ cell, column }))
            .filter(({ column }) => column > 0 && holdsValues(column))
            .map(({ cell }) => runs(cell))
        : [];
      const rows = bodyRows
        .map((tr) => (tr.firstElementChild ? runs(tr.firstElementChild) : []))
        .filter((label) => label.length > 0);
      return rows.length > 0 ? { head, rows } : null;
    }, ROWS);
    if (words) {
      tables[id] = words;
      tabled.push(`${id} table: ${words.head.length} compared columns, ${words.rows.length} rows`);
    } else {
      delete tables[id];
      missing.push(id);
    }
    await page.close();
    continue;
  }
  delete tables[id];
  await el.scrollIntoViewIfNeeded();
  const png = join(work, `${id}.png`);
  await el.screenshot({ path: png });
  const webp = join(OUT_DIR, `${id}.webp`);
  execFileSync("magick", [png, "-resize", `${WIDTH}x`, "-quality", "78", webp]);
  written.push(`${id} ${found} ${statSync(webp).size} B`);
  manifest[id] = "drawing";
  await page.close();
}
await browser.close();
const byId = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  manifestPath,
  `${JSON.stringify({ source: base, pictures: byId(manifest), tables: byId(tables) }, null, 2)}\n`,
);
console.log(
  `examined ${ids.length} registered ids; pictured ${written.length}; read ${tabled.length} tables; neither for ${missing.length}`,
);
for (const line of [...written, ...tabled]) console.log(`  ${line}`);
if (missing.length) console.log(`  neither a picture nor a table: ${missing.join(", ")}`);
