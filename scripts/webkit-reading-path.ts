/**
 * The reading path in WebKit, which is a lane AGENTS.md names and nobody had ever run (dispatch 442).
 *
 * The lane matrix lists "a real WebKit/Safari lane" among eleven. Playwright ships WebKit and
 * 34a9c68c established that a real browser reaches a static export through a small node:http server
 * in about a second, so the cheapest unexamined lane on that list costs a script. The server, the
 * port fallback and the launch are that script's; node:http rather than Bun.serve because scripts/
 * is typechecked and the ambient Bun type declares only Bun.build.
 *
 * WHY WEBKIT AND NOT MORE CHROMIUM. Two of the properties below cannot be tested in Chromium at all
 * as this repository drives it: `prefers-color-scheme` and `prefers-reduced-motion` are Chromium
 * EMULATION there and real settings here, which was the stated limitation of dispatch 438's check.
 *
 * WHAT IT ASSERTS, all of them site properties:
 *   - every route on the reading path loads with no page error;
 *   - a real dark preference carries the dark theme and a dark computed background;
 *   - a real reduced-motion preference is seen by the page, which is the gate the laboratories read;
 *   - nothing takes keyboard focus while invisible or inside an aria-hidden subtree.
 *
 * WHAT IT RECORDS RATHER THAN ASSERTS, because it is a platform preference and not a defect: how
 * many of a page's focusable elements Tab actually reaches. Measured on /foundations/, which has 87
 * focusable elements: Chromium's Tab reached 12 of them in 12 presses and WEBKIT REACHED ONE, a
 * summary, because Safari's "Press Tab to highlight each item" is off by default and Tab then skips
 * links and buttons. A Safari reader on default settings therefore cannot reach this site's links by
 * keyboard, and no change here can alter that; asserting a number would be asserting a browser
 * setting. It is printed so the fact is on the record.
 *
 * Usage:
 *   bun scripts/webkit-reading-path.ts [--out <dir>] [--base-url http://host:port]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, webkit } from "playwright";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
}

const OUT = flag("--out") ?? join(ROOT, "out");

/** The path a reader takes, not a list of routes: the paper, a face, the foundations, a laboratory. */
const READING_PATH: readonly (readonly [string, string])[] = [
  ["the paper", "/papers/brownian-motion/"],
  ["the parallel face", "/papers/brownian-motion/view/parallel/"],
  ["the foundations", "/foundations/"],
  ["a laboratory", "/lab/bm-01/"],
];

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

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

const failures: string[] = [];
function check(claim: string, held: boolean, saw: string): void {
  console.log(`  ${held ? "ok  " : "FAIL"}  ${claim}  (${saw})`);
  if (!held) failures.push(`${claim}: ${saw}`);
}

/** Tab through the page and report any stop a reader cannot see. */
async function tabStops(
  page: Page,
  presses: number,
): Promise<{ reached: number; unseeable: string[] }> {
  const unseeable: string[] = [];
  let reached = 0;
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || !(el instanceof HTMLElement)) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        described: `<${el.tagName.toLowerCase()} class="${`${el.className}`.slice(0, 30)}">`,
        invisible: style.display === "none" || style.visibility === "hidden",
        zeroSize: rect.width < 1 || rect.height < 1,
        insideAriaHidden: el.closest('[aria-hidden="true"]') !== null,
      };
    });
    if (!stop) break;
    reached += 1;
    if (stop.invisible || stop.zeroSize || stop.insideAriaHidden)
      unseeable.push(
        `${stop.described} invisible=${stop.invisible} zeroSize=${stop.zeroSize} ariaHidden=${stop.insideAriaHidden}`,
      );
  }
  return { reached, unseeable };
}

async function main(): Promise<number> {
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "papers", "brownian-motion", "index.html"))) {
      console.error(`${OUT} holds no built reading path. Run a build, or pass --base-url.`);
      return 2;
    }
    for (const port of [47941, 47942, 47943]) {
      try {
        server = await serveExport(port);
        base = `http://127.0.0.1:${port}`;
        break;
      } catch {
        // A peer may hold the port; try the next.
      }
    }
    if (!server) {
      console.error("could not bind a local port to serve the export; pass --base-url instead.");
      return 2;
    }
  }

  let browser: Browser | undefined;
  const errors: string[] = [];
  try {
    browser = await webkit.launch();
    console.log(`WebKit ${browser.version()} against ${OUT}\n`);
    // A phone viewport with a device that really asks for dark and for reduced motion. In WebKit
    // these are the engine's own settings rather than Chromium's emulation.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${error.message}`.slice(0, 140)));

    for (const [label, route] of READING_PATH) {
      await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 40000 });
      await page.waitForTimeout(600);
      const seen = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        dark: matchMedia("(prefers-color-scheme: dark)").matches,
        reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
        background: getComputedStyle(document.body).backgroundColor,
        focusableInDom: document.querySelectorAll(
          "a[href],button,input,select,textarea,summary,[tabindex]",
        ).length,
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }));
      console.log(`\n${label}  ${route}`);
      check(
        "the dark preference is real here and the document carries the dark theme",
        seen.dark && seen.theme === "kramgasse-night",
        `media dark=${seen.dark}, data-theme=${seen.theme}`,
      );
      check(
        "the body's computed background is the dark one",
        seen.background === "rgb(28, 33, 40)",
        seen.background,
      );
      check(
        "the reduced-motion preference is real here, which is the gate the laboratories read",
        seen.reduce,
        `media reduce=${seen.reduce}`,
      );
      check(
        "the page does not scroll sideways at 390px",
        !seen.sideways,
        `sideways=${seen.sideways}`,
      );
      const tab = await tabStops(page, 25);
      check(
        "no keyboard stop is invisible or inside an aria-hidden subtree",
        tab.unseeable.length === 0,
        `${tab.reached} stops reached, ${tab.unseeable.length} unseeable`,
      );
      for (const bad of tab.unseeable) console.log(`        ${bad}`);
      // Recorded, not asserted: Tab's reach is a Safari setting, not a property of this site.
      console.log(
        `  note  Tab reached ${tab.reached} of ${seen.focusableInDom} focusable elements; Safari's default Tab skips links and buttons`,
      );
    }
    await context.close();
    check(
      "no page error on any route of the reading path",
      errors.length === 0,
      `${errors.length}`,
    );
    for (const error of errors.slice(0, 8)) console.log(`        ${error}`);
  } finally {
    await browser?.close();
    server?.close();
  }

  console.log(
    `\n${failures.length === 0 ? "the reading path holds in WebKit" : `${failures.length} failed`}`,
  );
  for (const failure of failures) console.log(`  ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

process.exit(await main());
