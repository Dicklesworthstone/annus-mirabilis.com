/**
 * NO TWO PREDICTION CONTROLS SHARE AN ACCESSIBLE NAME ON ONE PAGE (am-svdj).
 *
 * THE DEFECT, as that bead measured it on 2026-10-07 and as this lane reproduces below: both of a
 * prediction prompt's controls were named once, in `PredictPanel.tsx`, so every prompt on a page
 * rendered the same pair. Over the 58 built pages carrying a prompt, 22 carry more than one (19 with
 * two, 3 with three), and on those a reader navigating by control name met "Skip prediction" two or
 * three times with nothing in any name to say which prediction it acts on. A sighted reader tells
 * them apart by the fieldset above each button; a reader using a control list, a rotor or voice
 * control has only the name.
 *
 * THE NAMES WERE DISTINGUISHED IN `9df610004`, which is why this lane exists rather than a fix: the
 * repair is authored text ("Skip prediction for <that prompt's question>"), and nothing in the
 * repository could have caught the defect or can catch its return. Duplicate accessible names on
 * distinct controls are NOT an axe violation, so all 22 pages pass the browser lane's AxeBuilder
 * scans today and passed them while the defect was live.
 *
 * IT READS THE AX TREE, NOT THE DOM (criterion 5), because that is the instrument the defect was
 * found with: a Playwright `getByRole({ name, exact: true })` strict-mode violation. Chromium's own
 * tree is read over CDP `Accessibility.getFullAXTree`, so the name compared here is the name the
 * browser computes and exposes, not an `aria-label` attribute read off an element. The two differ in
 * both directions -- a label on an ignored node is not exposed, and a node with no label carries the
 * name its contents compute -- and the second direction is the one that matters, since stripping the
 * labels does not leave these buttons nameless, it leaves them sharing "Skip prediction".
 *
 *   Playwright 1.62 has no `page.accessibility`; it was deprecated and removed. CDP is not a
 *   workaround for its absence, it is the better instrument, and `DOM.getDocument` is read in the
 *   same session so each AX node's `backendDOMNodeId` can be attributed to its owning prompt.
 *
 * WHAT IT ASSERTS IS EXACTLY THE BEAD'S RULE AND NOT MORE: two enabled controls sharing one name
 * while acting on DIFFERENT prompts. A page-wide duplicate-name count is REPORTED beside it, because
 * the wider surface is worth seeing and is not what this bead measured; asserting it here would make
 * the gate stricter than the rule it audits, which has cost this repository four false findings
 * before.
 *
 * THE PLANT RUNS IN BOTH DIRECTIONS (criterion 3), and the second direction is the one that proves
 * this is a duplication check rather than a label-presence check:
 *
 *   --plant strip-labels           removes the authored aria-label from every prompt control on the
 *                                  page, which is the pre-9df610004 markup exactly. On a page with
 *                                  two prompts the lane must go RED and name the shared name.
 *   --plant strip-labels-one-prompt the same removal on a page with ONE prompt, which must stay
 *                                  GREEN: one "Skip prediction" on a page collides with nothing, and
 *                                  a check that reddened here would be asserting that the labels
 *                                  exist rather than that the names are distinct.
 *
 * The plant is applied to the live DOM after hydration rather than to the served bytes, deliberately
 * and with its limit stated: these panels are hydrated React, and React restores mismatched server
 * HTML during hydration (error #418), so an in-flight rewrite of the response cannot plant an
 * attribute defect in a page like this. What the plant therefore establishes is that the DETECTOR
 * reaches the predicate on a real page's real AX tree. That the shipped markup carries the labels is
 * a separate claim, and it is the one the unplanted run over all 58 pages makes.
 *
 * Usage:
 *   bun scripts/predict-prompt-names-lane.ts [--out <dir>] [--base-url http://host:port]
 *   bun scripts/predict-prompt-names-lane.ts --plant strip-labels
 *   bun scripts/predict-prompt-names-lane.ts --plant strip-labels-one-prompt
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { retainLaneRun } from "./gate-census/laneEvidence.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const OUT = flag("--out") ?? join(ROOT, "out");
const PLANT = flag("--plant");

/** The page each plant mode acts on, chosen by its prompt count rather than by its subject. */
const PLANT_PAGE: Readonly<Record<string, string>> = {
  "strip-labels": "/lab/me-02/",
  "strip-labels-one-prompt": "/embed/lab/bm-02/",
};

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

/**
 * Every built page carrying a prediction prompt, with how many distinct prompts it carries.
 *
 * Read off the built HTML rather than from a list, because the population is the point: a lane that
 * visited a hand-written set of routes would keep passing as prompts landed on new pages, which is
 * the shape this repository records as a wrong population.
 */
function promptPages(dir: string): readonly Readonly<{ route: string; prompts: number }>[] {
  const found: { route: string; prompts: number }[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== "index.html") continue;
      const html = readFileSync(full, "utf8");
      const ids = new Set([...html.matchAll(/data-predict-prompt="([^"]*)"/g)].map((m) => m[1]));
      if (ids.size === 0) continue;
      const route = `${full.slice(dir.length, -"index.html".length)}`;
      found.push({ route: route.startsWith("/") ? route : `/${route}`, prompts: ids.size });
    }
  };
  walk(dir);
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

/** The roles a reader reaches by name in a control list, a rotor, or by voice. */
const INTERACTIVE = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "textbox",
  "combobox",
  "slider",
  "spinbutton",
  "menuitem",
  "tab",
  "switch",
]);

type Control = Readonly<{ name: string; role: string; prompt: string | undefined }>;

/**
 * Chromium's exposed, enabled, interactive controls, each attributed to its owning prompt.
 *
 * `ignored` nodes are dropped because a reader never reaches them, and a disabled control is dropped
 * because the bead's rule names enabled ones: a disabled "Skip prediction" is not a control a reader
 * can act on, so two of them are not two ways to do different things.
 */
async function exposedControls(page: Page): Promise<readonly Control[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("Accessibility.enable");
    const doc = (await cdp.send("DOM.getDocument", { depth: -1, pierce: true })) as {
      root: DomNode;
    };
    const promptOf = new Map<number, string>();
    const walk = (node: DomNode, prompt: string | undefined): void => {
      let owner = prompt;
      const attrs = node.attributes ?? [];
      for (let i = 0; i + 1 < attrs.length; i += 2)
        if (attrs[i] === "data-predict-prompt") owner = attrs[i + 1];
      if (owner !== undefined && node.backendNodeId !== undefined)
        promptOf.set(node.backendNodeId, owner);
      for (const child of node.children ?? []) walk(child, owner);
      if (node.contentDocument) walk(node.contentDocument, owner);
      for (const child of node.shadowRoots ?? []) walk(child, owner);
    };
    walk(doc.root, undefined);

    const tree = (await cdp.send("Accessibility.getFullAXTree")) as { nodes: readonly AxNode[] };
    const controls: Control[] = [];
    for (const node of tree.nodes) {
      if (node.ignored) continue;
      const role = node.role?.value;
      if (typeof role !== "string" || !INTERACTIVE.has(role)) continue;
      const name = typeof node.name?.value === "string" ? node.name.value.trim() : "";
      if (name === "") continue;
      const disabled = (node.properties ?? []).some(
        (p) => p.name === "disabled" && p.value?.value === true,
      );
      if (disabled) continue;
      controls.push({
        name,
        role,
        prompt:
          node.backendDOMNodeId === undefined ? undefined : promptOf.get(node.backendDOMNodeId),
      });
    }
    return controls;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

type DomNode = {
  backendNodeId?: number;
  attributes?: readonly string[];
  children?: readonly DomNode[];
  contentDocument?: DomNode;
  shadowRoots?: readonly DomNode[];
};
type AxNode = {
  ignored?: boolean;
  role?: { value?: unknown };
  name?: { value?: unknown };
  backendDOMNodeId?: number;
  properties?: readonly { name?: string; value?: { value?: unknown } }[];
};

/** Names shared by controls acting on two or more different prompts, which is the bead's rule. */
function collisions(
  controls: readonly Control[],
): readonly Readonly<{ name: string; prompts: readonly string[] }>[] {
  const byName = new Map<string, Set<string>>();
  for (const control of controls) {
    if (control.prompt === undefined) continue;
    const seen = byName.get(control.name) ?? new Set<string>();
    seen.add(control.prompt);
    byName.set(control.name, seen);
  }
  return [...byName.entries()]
    .filter(([, prompts]) => prompts.size > 1)
    .map(([name, prompts]) => ({ name, prompts: [...prompts].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The pre-9df610004 markup: both controls named once, for every prompt on the page. */
async function stripPromptLabels(page: Page): Promise<number> {
  return page.evaluate(() => {
    let removed = 0;
    for (const el of document.querySelectorAll("[data-predict-prompt] [aria-label]")) {
      const label = el.getAttribute("aria-label") ?? "";
      if (!/^(Skip prediction|I have one in mind) for /.test(label)) continue;
      el.removeAttribute("aria-label");
      removed += 1;
    }
    return removed;
  });
}

async function main(): Promise<number> {
  if (PLANT !== undefined && !(PLANT in PLANT_PAGE)) {
    console.error(`--plant takes one of: ${Object.keys(PLANT_PAGE).join(", ")}`);
    return 2;
  }
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "lab", "me-02", "index.html"))) {
      console.error(`${OUT} holds no built laboratory pages. Run a build, or pass --base-url.`);
      return 2;
    }
    for (const port of [48041, 48042, 48043]) {
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

  const all = promptPages(OUT);
  const routes = PLANT === undefined ? all : all.filter((p) => p.route === PLANT_PAGE[PLANT]);
  if (PLANT !== undefined && routes.length === 0) {
    console.error(`${PLANT_PAGE[PLANT]} carries no prediction prompt in ${OUT}.`);
    return 2;
  }
  const spread = new Map<number, number>();
  for (const page of all) spread.set(page.prompts, (spread.get(page.prompts) ?? 0) + 1);
  console.log(
    `${all.length} built pages carry a prediction prompt; ` +
      `${all.filter((p) => p.prompts > 1).length} carry more than one ` +
      `(${[...spread.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, pages]) => `${pages} with ${n}`)
        .join(", ")})`,
  );
  if (PLANT !== undefined)
    console.log(
      `PLANT ${PLANT}: visiting only ${PLANT_PAGE[PLANT]}, which carries ${routes[0]?.prompts} prompt(s)`,
    );

  let browser: Browser | undefined;
  const failures: string[] = [];
  let visited = 0;
  let controlsRead = 0;
  const pageWideDuplicates: string[] = [];
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    for (const target of routes) {
      const opened = await page.goto(`${base}${target.route}`, {
        waitUntil: "load",
        timeout: 40000,
      });
      const code = opened?.status();
      if (code !== 200) {
        // A 404 body exposes no controls at all, so it measures as clean. Treated as a failed
        // citation rather than a pass.
        failures.push(`${target.route} answered ${code ?? "no response"}`);
        continue;
      }
      // The labels are in the served HTML, but the panel is hydrated React and a prompt already
      // answered on this device renders no controls; waiting for the first control settles both.
      await page
        .locator("[data-predict-prompt]")
        .first()
        .waitFor({ timeout: 20000 })
        .catch(() => {});
      if (PLANT !== undefined) {
        const removed = await stripPromptLabels(page);
        // Print what landed before reading the verdict: a plant that changed nothing is a finding
        // about the plant, and would otherwise read as a clean page.
        console.log(`  [plant] ${target.route}: removed ${removed} authored aria-label(s)`);
        if (removed === 0) {
          failures.push(`${target.route}: the plant removed no label, so it proves nothing`);
          continue;
        }
      }
      const controls = await exposedControls(page);
      visited += 1;
      controlsRead += controls.length;
      const clashes = collisions(controls);
      for (const clash of clashes)
        failures.push(
          `${target.route}: "${clash.name}" names enabled controls on ${clash.prompts.length} different prompts (${clash.prompts.join(", ")})`,
        );

      // Reported, not asserted: the same question asked of the whole page rather than of its
      // prompts. The bead measured the prompt case and this lane judges that; a name shared by two
      // controls elsewhere on a page may be correct (two "Read recorded walkthroughs" links go to
      // one place), so a finding here would be stricter than the rule.
      const wide = new Map<string, number>();
      for (const control of controls) wide.set(control.name, (wide.get(control.name) ?? 0) + 1);
      const repeated = [...wide.entries()].filter(([, n]) => n > 1);
      if (repeated.length > 0)
        pageWideDuplicates.push(
          `${target.route}: ${repeated.length} name(s) on more than one enabled control` +
            ` (${repeated
              .slice(0, 3)
              .map(([name, n]) => `"${name.slice(0, 40)}" x${n}`)
              .join(", ")})`,
        );
      const prompted = controls.filter((c) => c.prompt !== undefined).length;
      console.log(
        `  ${target.route.padEnd(40)} ${String(prompted).padStart(3)} prompt control(s), ` +
          `${String(controls.length).padStart(3)} exposed on the page` +
          (clashes.length > 0 ? `  <- ${clashes.length} SHARED NAME(S)` : ""),
      );
    }
    await context.close();
  } catch (error) {
    // A thrown guard still retains its evidence: the run that stopped is the one worth reading.
    failures.push(`lane stopped: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close();
    server?.close();
  }

  if (pageWideDuplicates.length > 0) {
    console.log(
      `\nNOT ASSERTED, reported: ${pageWideDuplicates.length} of ${visited} pages carry some ` +
        `accessible name on more than one enabled control, counting the whole page rather than ` +
        `its prompts. The first few:`,
    );
    for (const line of pageWideDuplicates.slice(0, 5)) console.log(`  ${line}`);
  }

  const { vacuous } = retainLaneRun({
    lane: "predict-prompt-names",
    root: ROOT,
    examined: visited,
    noun: "built pages carrying a prediction prompt",
    // A plant visits one page on purpose, so its floor is that one page; the live run is held to
    // the corpus, where 58 pages carry a prompt and a floor of 50 notices a lost directory.
    minimum: PLANT === undefined ? 50 : 1,
    failures,
    baseUrl: base,
    export: OUT,
    extra: {
      plant: PLANT ?? null,
      promptPages: all.length,
      pagesWithSeveralPrompts: all.filter((p) => p.prompts > 1).length,
      promptSpread: Object.fromEntries([...spread.entries()].map(([n, pages]) => [n, pages])),
      exposedControlsRead: controlsRead,
      pageWideDuplicateNames: pageWideDuplicates.length,
    },
  });

  if (failures.length === 0) {
    console.log(
      `\nno two enabled controls share an accessible name across different prompts on any of ` +
        `${visited} page(s); ${controlsRead} exposed controls read from Chromium's AX tree`,
    );
  } else {
    console.error(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.error(`  ${failure}`);
  }
  return failures.length === 0 && !vacuous ? 0 : 1;
}

process.exit(await main());
