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
 * WHAT IT WRITES. public/figures/instruments/<id>.webp, 640px wide (the catalogue shows it about
 * 20rem wide, so this is sharp at 2x), converted with ImageMagick, and manifest.json listing the
 * ids pictured in this run with the kind of picture. The catalogue shows a picture only for an id
 * the manifest lists, so a file left from an earlier run, such as a table photographed before
 * tables were refused, is not shown. An id with no usable picture is reported.
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
const missing: string[] = [];
// The manifest carries over ids this run does not examine (an --only run) and is rewritten for
// every id it does: pictured, or removed when this run found no usable picture.
const manifestPath = join(OUT_DIR, "manifest.json");
const manifest: Record<string, "drawing" | "results"> = existsSync(manifestPath)
  ? (
      JSON.parse(readFileSync(manifestPath, "utf8")) as {
        pictures: Record<string, "drawing" | "results">;
      }
    ).pictures
  : {};
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
    missing.push(id);
    delete manifest[id];
    await page.close();
    continue;
  }
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
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(manifestPath, `${JSON.stringify({ source: base, pictures: sorted }, null, 2)}\n`);
console.log(
  `examined ${ids.length} registered ids; wrote ${written.length}; no usable picture for ${missing.length}`,
);
for (const line of written) console.log(`  ${line}`);
if (missing.length) console.log(`  no usable picture: ${missing.join(", ")}`);
