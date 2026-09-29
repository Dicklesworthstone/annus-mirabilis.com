/**
 * Keyboard only (dispatch 453): can a reader who never touches a pointer perform the reasoning?
 *
 * Server and launch from 34a9c68c; node:http rather than Bun.serve because scripts/ is typechecked.
 * Every interaction is a key press. No click() anywhere, deliberately: element.click() skips the
 * path a reader takes, which this repository has recorded costing a false pass before.
 *
 * The clause this exists for is the accessibility chapter's own: acceptance asks whether the visitor
 * can "perform the intended reasoning", not whether an element received focus. So each assertion
 * below ends in a state change a reader could see, or in focus landing where a reader needs it.
 *
 * THREE PREDICATES THAT WERE WRONG FIRST, recorded so the numbers are not re-read as defects:
 *   - a term "chip" was sought as a focusable control. The 990 data-term nodes are SPANS, and
 *     AGENTS.md says "not every glyph is a tab stop: a formula reads as a whole". Not a defect.
 *   - a foundation trigger was sought as a <button>. All 204 are <a> links, which is the
 *     no-JavaScript contract ("real links, never hydration-dependent buttons").
 *   - a parameter field was sought as input[type=number|range|text] on BM-01, and matched the
 *     share-permalink text field. That laboratory is operated by named buttons.
 *
 * TWO THINGS THIS LANE CANNOT SETTLE, recorded rather than asserted:
 *   - /papers/brownian-motion/s4/ carries NO paragraph-level reading: the only element with
 *     data-detail is <html> itself. So "changing the detail level changes the reading a reader
 *     sees" has nothing to act on there and is unverifiable on that surface rather than false.
 *     Whether a section page should render R0 to R3 per paragraph is a reader question for the
 *     owner of src/reader/, and it is reported, not resolved here.
 *   - the detail control is a native <select>, whose dropdown is browser chrome; ArrowDown and
 *     Enter did not move data-detail off "1" in headless Chromium, which is a limit of headless
 *     keyboard emulation as much as a claim about the control.
 *
 * Usage:
 *   bun scripts/keyboard-only-lane.ts [--out <dir>] [--base-url http://host:port]
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

type Stop = {
  tag: string;
  name: string;
  dataFoundation: string;
  inDialog: boolean;
  lost: boolean;
  presses?: number;
};

function activeStop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body)
      return { tag: "BODY", name: "", dataFoundation: "", inDialog: false, lost: true };
    return {
      tag: el.tagName.toLowerCase(),
      name: (el.getAttribute("aria-label") ?? el.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50),
      dataFoundation: el.getAttribute("data-foundation") ?? "",
      inDialog: el.closest("dialog, [role=dialog]") !== null,
      lost: false,
    };
  });
}

async function tabUntil(
  page: Page,
  limit: number,
  holds: (s: Stop) => boolean,
): Promise<Stop | null> {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const stop = await activeStop(page);
    if (!stop.lost && holds(stop)) return { ...stop, presses: i + 1 };
  }
  return null;
}

const failures: string[] = [];
function check(claim: string, held: boolean, saw: string): void {
  console.log(`  ${held ? "ok  " : "FAIL"}  ${claim}  (${saw})`);
  if (!held) failures.push(`${claim}: ${saw}`);
}

async function main(): Promise<number> {
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "papers", "brownian-motion", "s4", "index.html"))) {
      console.error(`${OUT} holds no built reading path. Run a build, or pass --base-url.`);
      return 2;
    }
    for (const port of [48021, 48022, 48023]) {
      try {
        server = await serveExport(port);
        base = `http://127.0.0.1:${port}`;
        break;
      } catch {
        // A peer may hold the port; try the next.
      }
    }
    if (!server) {
      console.error("could not bind a local port; pass --base-url instead.");
      return 2;
    }
  }

  let browser: Browser | undefined;
  const errors: string[] = [];
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${error.message}`.slice(0, 120)));

    console.log("\narriving on a paper section");
    await page.goto(`${base}/papers/brownian-motion/s4/`, { waitUntil: "load", timeout: 40000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("Tab");
    const first = await activeStop(page);
    check(
      "the first Tab is the skip link",
      first.name.startsWith("Skip to the content"),
      `<${first.tag}> "${first.name}"`,
    );
    const search = await tabUntil(page, 12, (s) => /Search/.test(s.name));
    check(
      "the search launcher comes early in the order",
      Boolean(search),
      search ? `stop ${search.presses}: "${search.name}"` : "not in 12 presses",
    );
    const theme = await tabUntil(page, 6, (s) => /Switch to (dark|light) theme/.test(s.name));
    check(
      "the theme control follows it",
      Boolean(theme),
      theme ? `"${theme.name}"` : "not found within 6 more presses",
    );

    console.log("\na foundation: opened and left with keys only");
    const trigger = await tabUntil(page, 200, (s) => s.dataFoundation.length > 0);
    check(
      "a foundation link is reachable by Tab",
      Boolean(trigger),
      trigger
        ? `stop ${trigger.presses}: <${trigger.tag}> "${trigger.name}"`
        : "none in 200 presses",
    );
    if (trigger) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
      const inside = await activeStop(page);
      check(
        "Enter moves focus into the dialog",
        inside.inDialog,
        `focus <${inside.tag}> "${inside.name}"`,
      );
      let left = false;
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        const stop = await activeStop(page);
        if (!stop.lost && !stop.inDialog) {
          left = true;
          break;
        }
      }
      check(
        "focus is held inside the dialog while it is open",
        !left,
        left ? "focus escaped" : "25 presses stayed inside",
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      const back = await activeStop(page);
      check(
        "Escape restores focus to the link that opened it, not the document",
        !back.lost && back.dataFoundation === trigger.dataFoundation,
        `focus <${back.tag}> "${back.name}" data-foundation=${back.dataFoundation || "(none)"}`,
      );
    }

    console.log("\na laboratory: change something and read the result");
    await page.goto(`${base}/lab/bm-01/`, { waitUntil: "load", timeout: 40000 });
    await page.waitForTimeout(900);
    const skip = await tabUntil(
      page,
      30,
      (s) => s.tag === "button" && /Skip prediction/.test(s.name),
    );
    check(
      "the prediction can be skipped from the keyboard",
      Boolean(skip),
      skip ? `stop ${skip.presses}` : "not found",
    );
    if (skip) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
    }
    const before = await page.evaluate(
      () => document.body.textContent?.replace(/\s+/g, " ").length ?? 0,
    );
    const observe = await tabUntil(
      page,
      40,
      (s) => s.tag === "button" && /Observe at \d/.test(s.name),
    );
    check(
      "an observation control is reachable by Tab",
      Boolean(observe),
      observe ? `stop ${observe.presses}: "${observe.name}"` : "none in 40 presses",
    );
    if (observe) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1800);
      const after = await page.evaluate(
        () => document.body.textContent?.replace(/\s+/g, " ").length ?? 0,
      );
      check(
        "operating it from the keyboard changes what the laboratory reports",
        after !== before,
        `page text ${before} to ${after} characters`,
      );
      const still = await activeStop(page);
      check(
        "focus stays on the control afterwards, not lost to the document",
        !still.lost,
        `focus <${still.tag}> "${still.name}"`,
      );
    }
    check("no page error across the keyboard run", errors.length === 0, `${errors.length}`);
    for (const error of errors.slice(0, 5)) console.log(`        ${error}`);
    await context.close();
  } finally {
    await browser?.close();
    server?.close();
  }

  console.log(
    `\n${failures.length === 0 ? "every keyboard action could be performed" : `${failures.length} could not`}`,
  );
  for (const failure of failures) console.log(`  ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

process.exit(await main());
