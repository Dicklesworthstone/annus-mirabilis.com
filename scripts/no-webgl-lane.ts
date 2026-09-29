/**
 * The no-WebGL lane (dispatch 449): the four laboratories AGENTS.md names as the Three.js set,
 * loaded with WebGL denied, against a built site. Server and launch from 34a9c68c; node:http rather
 * than Bun.serve because scripts/ is typechecked.
 *
 * The promise: "a no-WebGL device gets the static worked case and the textual equivalents", and "a
 * crash, context loss, or artifact mismatch pauses the laboratory while the book stays usable". A
 * laboratory that refuses honestly is passing; a blank rectangle, a canvas that never paints, or an
 * error is the defect.
 *
 * WHY THIS LANE PASSES, and it must be read with the reason attached or it says the wrong thing.
 * Measured 2026-09-28 on the build of 34a9c68c: these four pages create NO canvas, ask for a WebGL
 * context ZERO times, and behave identically whether WebGL is denied or available. There is no
 * WebGL path in the product to fall back FROM:
 *
 *   - `three` is in neither dependencies nor devDependencies, and node_modules/three is absent;
 *   - no built chunk contains THREE. or WebGLRenderer;
 *   - src/visuals/three/ThreeStudioScene.ts is the only file that imports "three", it has no
 *     non-test consumer, and its own test passes because it calls mock.module("three", ...).
 *
 * So the no-WebGL promise is currently met TRIVIALLY rather than by a fallback anyone built, and
 * this script's green means "nothing here needs WebGL", not "the fallback works". The day a
 * laboratory mounts a real scene, the assertions below start doing the work they are written for:
 * they check what a reader gets, not what the code intends.
 *
 * Usage:
 *   bun scripts/no-webgl-lane.ts [--out <dir>] [--base-url http://host:port]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
}

const OUT = flag("--out") ?? join(ROOT, "out");

/** The closed set AGENTS.md names: the SR-03 and SR-05 studio, SR-08's field lines, the 1906 box. */
const LABORATORIES: readonly (readonly [string, string])[] = [
  ["SR-03", "/lab/sr-03/"],
  ["SR-05", "/lab/sr-05/"],
  ["SR-08", "/lab/sr-08/"],
  ["ME-03", "/lab/me-03/"],
];

/** The public set of execution labels. A reader may see one of these and nothing else. */
const PUBLIC_LABELS: readonly string[] = [
  "Static worked example",
  "This experiment is unavailable on this device",
  "Ideal model, host calculation",
  "Ideal model, computed with FrankenSim",
];

/** Denied where a page actually asks: getContext returns null for every WebGL flavour. */
const DENY_WEBGL = `
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    if (typeof kind === "string" && /webgl/i.test(kind)) {
      window.__webglAsked = (window.__webglAsked || 0) + 1;
      return null;
    }
    return realGetContext.call(this, kind, ...rest);
  };
  delete window.WebGLRenderingContext;
  delete window.WebGL2RenderingContext;
`;

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

async function look(page: Page): Promise<{
  webglAsked: number;
  canvasesShown: number;
  blankCanvases: number;
  labels: string[];
  headings: number;
  links: number;
  bodyChars: number;
  spinners: number;
}> {
  return page.evaluate((labels: readonly string[]) => {
    const laidOut = (el: Element): boolean => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.getClientRects().length > 0;
    };
    const text = (document.body.textContent ?? "").replace(/\s+/g, " ");
    const shown = [...document.querySelectorAll("canvas")].filter(laidOut);
    // A laid-out canvas with real area and nothing painted is the blank rectangle to refuse.
    const blank = shown.filter((canvas) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return false;
      try {
        const context = (canvas as HTMLCanvasElement).getContext("2d");
        if (!context) return true;
        const data = context.getImageData(
          0,
          0,
          Math.min((canvas as HTMLCanvasElement).width, 40),
          Math.min((canvas as HTMLCanvasElement).height, 40),
        ).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
        return true;
      } catch {
        return true;
      }
    });
    return {
      webglAsked: (window as unknown as { __webglAsked?: number }).__webglAsked ?? 0,
      canvasesShown: shown.length,
      blankCanvases: blank.length,
      labels: labels.filter((label) => text.includes(label)),
      headings: [...document.querySelectorAll("h1,h2,h3")].filter(laidOut).length,
      links: [...document.querySelectorAll("a[href]")].filter(laidOut).length,
      bodyChars: text.trim().length,
      spinners: [
        ...document.querySelectorAll('[class*="spinner"], [class*="loading"], [aria-busy="true"]'),
      ].filter(laidOut).length,
    };
  }, PUBLIC_LABELS);
}

async function main(): Promise<number> {
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "lab", "sr-03", "index.html"))) {
      console.error(`${OUT} holds no built laboratories. Run a build, or pass --base-url.`);
      return 2;
    }
    for (const port of [47991, 47992, 47993]) {
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
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(DENY_WEBGL);
    const page = await context.newPage();

    for (const [name, route] of LABORATORIES) {
      const errors: string[] = [];
      page.removeAllListeners("pageerror");
      page.on("pageerror", (error) => errors.push(`${error.message}`.slice(0, 120)));
      {
        const opened = await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 40000 });
        const code = opened?.status();
        // A 404 body is twelve bytes: zero overflow, zero dark ink, zero missing labels. Without
        // this guard a route that MOVED reads exactly like a clean lane, and dispatch 445 cited
        // a pass on one (/foundations/random-walk/, where the route is random-walkS).
        if (code !== 200)
          throw new Error(
            `${page.url()} answered ${code ?? "no response"}: a 404 body measures as clean, so this is a failed citation and not a pass`,
          );
      }
      await page.waitForTimeout(1200);
      const seen = await look(page);
      console.log(`\n${name}  ${route}`);
      check(
        "the laboratory raises no page error with WebGL denied",
        errors.length === 0,
        `${errors.length} errors`,
      );
      for (const error of errors.slice(0, 4)) console.log(`        ${error}`);
      check(
        "a reader sees one of the public execution labels",
        seen.labels.length > 0,
        seen.labels.join(" | ") || "none of the public set",
      );
      check(
        "no blank rectangle stands in for a view",
        seen.blankCanvases === 0,
        `${seen.blankCanvases} blank of ${seen.canvasesShown} shown`,
      );
      check("nothing is left spinning or busy", seen.spinners === 0, `${seen.spinners}`);
      check(
        "the book survives on the page",
        seen.headings > 0 && seen.links > 0 && seen.bodyChars > 20000,
        `${seen.headings} headings, ${seen.links} links, ${seen.bodyChars} characters`,
      );
      // Recorded, not asserted: whether anything asked for WebGL at all. Zero here is the fact the
      // docblock explains, and it is what makes this lane's green mean less than it looks.
      console.log(
        `  note  WebGL was asked for ${seen.webglAsked} time(s); ${seen.canvasesShown} canvas elements are laid out`,
      );
    }
    await context.close();
  } finally {
    await browser?.close();
    server?.close();
  }

  console.log(
    `\n${failures.length === 0 ? "every laboratory holds with WebGL denied" : `${failures.length} failed`}`,
  );
  for (const failure of failures) console.log(`  ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

process.exit(await main());
