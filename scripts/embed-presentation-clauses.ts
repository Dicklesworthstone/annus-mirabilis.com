/**
 * The embed contract's presentation clauses, checked as a reader experiences them (dispatch 438).
 *
 * AGENTS.md states the contract in one line: "Embed at /embed/lab/[experiment] with attribution, a
 * link back, and respect for detail, theme, and reduced-motion parameters." Attribution and the link
 * back are markup and were already true. The other three were checked through the parsers, and that
 * is not the same claim: a parser accepting a word is not a reader seeing a reading. The gap was
 * stated in dispatch 435's report and this closes it.
 *
 * What made it cheap is 34a9c68c's finding, reused rather than re-invented: a real Playwright click
 * reaches React in the static export, served by a small node:http file server, with no dev server and
 * no build of its own. The server, the port fallback and the launch below are that script's.
 *
 * node:http rather than Bun.serve, for the reason 34a9c68c records: a script under scripts/ is
 * typechecked, and this repository's ambient Bun type declares only Bun.build, so referencing an
 * undeclared member breaks `bun run check:types` for every pane.
 *
 * WHAT IT ASSERTS, and each is a computed or laid-out fact rather than a parsed one:
 *   - ?detail=overview|full|steps sets data-detail and the MATCHING reading is the one laid out;
 *   - ?theme=dark|light sets data-theme and the body's computed background actually changes, and an
 *     explicit theme beats a device asking for the other one;
 *   - ?motion=reduce sets data-reduced-motion, which is the gate a laboratory's animation loop asks
 *     (src/a11y/reducedMotion.ts), on a device that asks for nothing;
 *   - an unrecognised value or key REFUSES: the notice is shown, the instrument is not, and no
 *     presentation is installed, so nothing is rendered approximately.
 *
 * Usage:
 *   bun scripts/embed-presentation-clauses.ts [--out <dir>] [--base-url http://host:port] [--lab bm-01]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

/** A flag's value, or undefined. indexOf returns -1 when absent and argv[0] is the interpreter. */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
}

const OUT = flag("--out") ?? join(ROOT, "out");
const LAB = flag("--lab") ?? "bm-01";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

/** The exported site, served as a static host serves it: a directory is its index.html. */
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

type Seen = {
  dataDetail: string | null;
  dataTheme: string | null;
  dataEmbedMotion: string | null;
  dataReducedMotion: string | null;
  background: string;
  instrumentShown: boolean;
  refusalShown: boolean;
  refusalText: string;
  readingCount: number;
  visibleLevels: string[];
  guidanceOpen: boolean[];
};

async function observe(page: Page, base: string, query: string): Promise<Seen> {
  {
    const opened = await page.goto(`${base}/embed/lab/${LAB}/${query}`, {
      waitUntil: "load",
      timeout: 30000,
    });
    const code = opened?.status();
    // A 404 body is twelve bytes: zero overflow, zero dark ink, zero missing labels. Without
    // this guard a route that MOVED reads exactly like a clean lane, and dispatch 445 cited
    // a pass on one (/foundations/random-walk/, where the route is random-walkS).
    if (code !== 200)
      throw new Error(
        `${page.url()} answered ${code ?? "no response"}: a 404 body measures as clean, so this is a failed citation and not a pass`,
      );
  }
  await page
    .waitForSelector('[data-embed-ready="true"], [data-embed-invalid]', { timeout: 15000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const root = document.documentElement;
    /*
      The `hidden` ATTRIBUTE is only a default display:none and reader.css overrides it to reveal the
      matching reading, so consulting the attribute reports a visible R2 paragraph as hidden. Computed
      style and layout are the only authorities. That mistake is why this comment exists.
    */
    const laidOut = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.getClientRects().length > 0;
    };
    const readings = [...document.querySelectorAll("[data-detail]")];
    const refusal = document.querySelector("[data-embed-invalid]");
    return {
      dataDetail: root.getAttribute("data-detail"),
      dataTheme: root.getAttribute("data-theme"),
      dataEmbedMotion: root.getAttribute("data-embed-motion"),
      dataReducedMotion: root.getAttribute("data-reduced-motion"),
      background: getComputedStyle(document.body).backgroundColor,
      instrumentShown: Boolean(document.querySelector(".embed-instrument")),
      refusalShown: refusal instanceof HTMLElement ? laidOut(refusal) : false,
      refusalText: (refusal?.textContent ?? "").replace(/\s+/g, " ").trim(),
      readingCount: readings.length,
      // Only the paragraph-level readings: <html> also carries data-detail and is always laid out.
      visibleLevels: readings
        .filter((el) => el.tagName.toLowerCase() === "p" && laidOut(el))
        .map((el) => el.getAttribute("data-detail") ?? ""),
      guidanceOpen: [...document.querySelectorAll(".embed-guidance details")].map((d) =>
        d.hasAttribute("open"),
      ),
    };
  });
}

const failures: string[] = [];
function check(claim: string, held: boolean, saw: string): void {
  if (held) console.log(`  ok    ${claim}  (${saw})`);
  else {
    console.log(`  FAIL  ${claim}  (${saw})`);
    failures.push(`${claim}: ${saw}`);
  }
}

async function main(): Promise<number> {
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "embed", "lab", LAB, "index.html"))) {
      console.error(
        `${join(OUT, "embed", "lab", LAB, "index.html")} is absent: this reads a built site. Run a build, or pass --base-url.`,
      );
      return 2;
    }
    for (const port of [47931, 47932, 47933]) {
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
  try {
    browser = await chromium.launch();
    console.log(`embed /embed/lab/${LAB}/ from ${OUT}\n`);

    // A device that asks for nothing, so only the parameter can be doing the work.
    const quiet = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    const page = await quiet.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    console.log("device asks for nothing:");
    const base0 = await observe(page, base, "");
    // Non-vacuity: without readings on the page the detail checks below would prove nothing.
    check(
      "the embed carries the site's readings at more than one level",
      base0.readingCount >= 4,
      `${base0.readingCount} elements carry data-detail`,
    );
    check(
      "with no query the reader sees the full explanation",
      base0.dataDetail === "1" && base0.visibleLevels.includes("1"),
      `data-detail=${base0.dataDetail}, visible paragraph levels ${JSON.stringify(base0.visibleLevels)}`,
    );

    for (const [word, level] of [
      ["overview", "0"],
      ["full", "1"],
      ["steps", "2"],
    ] as const) {
      const seen = await observe(page, base, `?detail=${word}`);
      check(
        `?detail=${word} lays out the level-${level} reading and no other`,
        seen.dataDetail === level && seen.visibleLevels.join(",") === level,
        `data-detail=${seen.dataDetail}, visible paragraph levels ${JSON.stringify(seen.visibleLevels)}`,
      );
    }
    const steps = await observe(page, base, "?detail=steps");
    check(
      "?detail=steps also opens both guidance disclosures",
      steps.guidanceOpen.length === 2 && steps.guidanceOpen.every(Boolean),
      `open flags ${JSON.stringify(steps.guidanceOpen)}`,
    );

    const dark = await observe(page, base, "?theme=dark");
    check(
      "?theme=dark carries the dark theme and the body's background actually changes",
      dark.dataTheme === "kramgasse-night" && dark.background !== base0.background,
      `data-theme=${dark.dataTheme}, background ${dark.background} against ${base0.background} unasked`,
    );

    const reduce = await observe(page, base, "?motion=reduce");
    check(
      "?motion=reduce sets the gate a laboratory's animation asks, on a device asking nothing",
      reduce.dataReducedMotion === "true" && reduce.dataEmbedMotion === "reduce",
      `data-reduced-motion=${reduce.dataReducedMotion}, data-embed-motion=${reduce.dataEmbedMotion}`,
    );
    check(
      "and with no query on the same device it does not reduce",
      base0.dataReducedMotion === null,
      `data-reduced-motion=${base0.dataReducedMotion}`,
    );

    for (const bad of ["?detail=everything", "?tape=abc"]) {
      const seen = await observe(page, base, bad);
      check(
        `${bad} refuses rather than rendering something approximate`,
        seen.refusalShown && !seen.instrumentShown && seen.dataEmbedMotion === null,
        `refusal shown ${seen.refusalShown}, instrument shown ${seen.instrumentShown}, presentation installed ${seen.dataEmbedMotion !== null}`,
      );
    }
    await quiet.close();

    // A device that asks for both, to show the parameter is not the only path and does not lose.
    const asking = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    const page2 = await asking.newPage();
    page2.on("pageerror", (error) => errors.push(error.message));
    console.log("\ndevice asks for dark and reduced motion:");
    const followed = await observe(page2, base, "");
    check(
      "with no query the embed follows the device on both",
      followed.dataTheme === "kramgasse-night" && followed.dataReducedMotion === "true",
      `data-theme=${followed.dataTheme}, data-reduced-motion=${followed.dataReducedMotion}`,
    );
    const beats = await observe(page2, base, "?theme=light");
    check(
      "an explicit theme beats the device, and motion stays reduced because the device asked",
      beats.dataTheme === "annalen" && beats.dataReducedMotion === "true",
      `data-theme=${beats.dataTheme}, data-reduced-motion=${beats.dataReducedMotion}`,
    );
    await asking.close();

    check(
      "no page errors on any of the pages driven",
      errors.length === 0,
      `${errors.length} errors`,
    );
  } finally {
    await browser?.close();
    server?.close();
  }

  console.log(`\n${failures.length === 0 ? "every clause held" : `${failures.length} failed`}`);
  for (const failure of failures) console.log(`  ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

process.exit(await main());
