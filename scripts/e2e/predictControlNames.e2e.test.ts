/**
 * EVERY PREDICTION CONTROL ON A PAGE HAS ITS OWN ACCESSIBLE NAME (am-svdj).
 *
 * A page may hold several prediction prompts, and until 9df61000 every prompt rendered the same two
 * control names. Measured in the built site at the time: of the 58 pages carrying a prediction
 * prompt, 22 carried two or three controls with IDENTICAL accessible names, 19 pages with two and 3
 * with three, for both "Skip prediction" and "I have one in mind". A sighted reader tells the
 * prompts apart by the fieldset above each button; a control list, a rotor and voice control have
 * only the name.
 *
 * WHY THIS READS THE BUILT SITE AND NOT THE COMPONENT. The duplication does not exist in the
 * component at all -- `PredictPanel` renders one pair, correctly -- it exists only once a PAGE
 * renders several prompts. A source test cannot see it. This is the layer the defect lives in, and
 * AGENTS.md's rule is that a check on inputs reads the inputs.
 *
 * WHY AXE DID NOT CATCH IT. Duplicate accessible names on DISTINCT controls are not an axe
 * violation, so the browser lane's automated accessibility passes were green on all 22 pages. That
 * is why this is an explicit assertion rather than a reliance on the generic scan.
 *
 * THE PREDICATE IS A PURE FUNCTION AND IS PLANTED IN BOTH DIRECTIONS BELOW, which is the half of
 * the proof that does not depend on what happens to be committed in `out/`. The corpus has zero
 * duplicates now, so a sweep over it alone could not fail and would be green over a population that
 * cannot disagree.
 */

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(REPO_ROOT, "out");

/** The visible labels of the controls a prompt renders. Their text is the reader's own vocabulary. */
const CONTROL_LABELS = ["Skip prediction", "I have one in mind"] as const;

export type ControlName = Readonly<{ visible: string; accessible: string; labelled: boolean }>;

/**
 * Every prediction control in one page's HTML, with the name an assistive technology would announce:
 * `aria-label` when present, else the button's own text. Both forms are returned so a page that LOST
 * its label is not silently counted as unique.
 */
export function predictControlNames(html: string): readonly ControlName[] {
  const found: ControlName[] = [];
  for (const match of html.matchAll(/<button\b([^>]*)>([^<]*)/g)) {
    const attrs = match[1] ?? "";
    const visible = (match[2] ?? "").trim();
    if (!CONTROL_LABELS.includes(visible as (typeof CONTROL_LABELS)[number])) continue;
    const label = /aria-label="([^"]*)"/.exec(attrs);
    found.push({
      visible,
      accessible: label?.[1] ?? visible,
      labelled: label !== null,
    });
  }
  return found;
}

/** The accessible names that more than one control on this page would announce. */
export function duplicateAccessibleNames(html: string): readonly string[] {
  const seen = new Map<string, number>();
  for (const control of predictControlNames(html)) {
    seen.set(control.accessible, (seen.get(control.accessible) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, n]) => n > 1)
    .map(([name]) => name)
    .sort();
}

function builtPages(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "_next") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "index.html") out.push(full);
    }
  };
  walk(root);
  return out;
}

test("PLANTED: two controls with one name are found, and distinct names are not", () => {
  // The lane-independent half. The committed corpus has zero duplicates, so without this the sweep
  // below is green over a population that cannot fail.
  const duplicated = `
    <button type="button" aria-label="Skip prediction for Q">Skip prediction</button>
    <button type="button" aria-label="Skip prediction for Q">Skip prediction</button>
  `;
  assert.deepEqual(duplicateAccessibleNames(duplicated), ["Skip prediction for Q"]);

  const distinct = `
    <button type="button" aria-label="Skip prediction for Q one">Skip prediction</button>
    <button type="button" aria-label="Skip prediction for Q two">Skip prediction</button>
  `;
  assert.deepEqual(duplicateAccessibleNames(distinct), []);

  // THE DEFECT'S OWN SHAPE: two prompts, no aria-label at all, which is what 22 pages served. The
  // fallback to button text is what makes this detectable rather than invisible.
  const unlabelled = `
    <button type="button" class="secondary">Skip prediction</button>
    <button type="button" class="secondary">Skip prediction</button>
  `;
  assert.deepEqual(duplicateAccessibleNames(unlabelled), ["Skip prediction"]);
  assert.equal(
    predictControlNames(unlabelled).every((c) => !c.labelled),
    true,
  );

  // A single prompt is not a finding, and must not be made one.
  assert.deepEqual(duplicateAccessibleNames('<button type="button">Skip prediction</button>'), []);
  // And an unrelated button is not a prediction control.
  assert.deepEqual(
    duplicateAccessibleNames(
      '<button type="button">Apply trial settings</button><button type="button">Apply trial settings</button>',
    ),
    [],
  );
});

export type Sweep = Readonly<{
  pagesWithControls: number;
  pagesWithSeveralPrompts: number;
  controls: number;
  unlabelled: number;
  offenders: readonly string[];
}>;

/**
 * The sweep, over ANY root. Taking the root as an argument is what lets the page-level plant below
 * run the real predicate over a directory built for the purpose: a plant that exercises only the
 * string function would not show that the walk, the per-page grouping and the reporting work.
 */
export function sweepRoot(root: string): Sweep {
  let pagesWithControls = 0;
  let pagesWithSeveralPrompts = 0;
  let controls = 0;
  let unlabelled = 0;
  const offenders: string[] = [];
  for (const page of builtPages(root)) {
    const html = readFileSync(page, "utf8");
    const names = predictControlNames(html);
    if (names.length === 0) continue;
    pagesWithControls += 1;
    controls += names.length;
    unlabelled += names.filter((n) => !n.labelled).length;
    // Each prompt renders both controls, so more than two means more than one prompt.
    if (names.length > CONTROL_LABELS.length) pagesWithSeveralPrompts += 1;
    const duplicates = duplicateAccessibleNames(html);
    if (duplicates.length > 0) {
      offenders.push(`${page.slice(root.length + 1)}: ${duplicates.join(", ")}`);
    }
  }
  return { pagesWithControls, pagesWithSeveralPrompts, controls, unlabelled, offenders };
}

test("PLANTED AT PAGE LEVEL: a two-prompt page with undistinguished names fails the real sweep", () => {
  // Acceptance item 3 asks for exactly this, and the pure-function plant above does not give it:
  // "a second prompt added to a page that had one makes the check fail before the names are
  // distinguished, and pass after. A page that legitimately has one prompt must not be made to
  // fail." So the real `sweepRoot` runs over a root written here.
  //
  // The directory is left in place rather than removed. RULE 1 of this repository's AGENTS.md
  // forbids deleting a file without express permission, including one the agent created, and the
  // operating system owns its own temp directory.
  const root = mkdtempSync(join(tmpdir(), "predict-control-names-"));
  const page = (dir: string, body: string): void => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(
      join(root, dir, "index.html"),
      `<!doctype html><html><body>${body}</body></html>`,
    );
  };
  const prompt = (label: string | null): string =>
    label === null
      ? '<button type="button">Skip prediction</button><button type="button">I have one in mind</button>'
      : `<button type="button" aria-label="Skip prediction for ${label}">Skip prediction</button>` +
        `<button type="button" aria-label="I have one in mind for ${label}">I have one in mind</button>`;

  // ONE prompt, undistinguished: legitimate, and must NOT be reported.
  page("one-prompt", prompt(null));
  const single = sweepRoot(root);
  assert.equal(single.pagesWithControls, 1);
  assert.equal(single.pagesWithSeveralPrompts, 0);
  assert.deepEqual(single.offenders, []);

  // A SECOND prompt added to that page, still undistinguished: the defect's exact shape.
  page("one-prompt", prompt(null) + prompt(null));
  const planted = sweepRoot(root);
  assert.equal(planted.pagesWithSeveralPrompts, 1);
  assert.equal(planted.offenders.length, 1);
  assert.match(planted.offenders[0] ?? "", /one-prompt/);
  assert.match(planted.offenders[0] ?? "", /Skip prediction/);
  assert.match(planted.offenders[0] ?? "", /I have one in mind/);
  assert.equal(planted.unlabelled, 4);

  // The same two prompts with names distinguished: passes, which is the "and pass after" half.
  page("one-prompt", prompt("the first question") + prompt("the second question"));
  const repaired = sweepRoot(root);
  assert.equal(repaired.pagesWithSeveralPrompts, 1);
  assert.equal(repaired.unlabelled, 0);
  assert.deepEqual(repaired.offenders, []);
});

test("no built page announces two prediction controls by the same name", () => {
  assertOutFreshness();
  assert.equal(existsSync(join(OUT_DIR, "index.html")), true, "run bun run build before this lane");

  const { pagesWithControls, pagesWithSeveralPrompts, controls, unlabelled, offenders } =
    sweepRoot(OUT_DIR);

  // Reported with its denominator, so a later reader can tell a repair from a change in how many
  // prompts the site has. Measured 2026-10-07: 58 pages, 22 of them with several prompts, 166
  // controls, 0 unlabelled, 0 offenders.
  console.log(
    `[census] predict-control-names examined ${pagesWithControls} pages carrying prediction controls, ` +
      `${pagesWithSeveralPrompts} of them with several prompts, ${controls} controls, ${unlabelled} without aria-label`,
  );

  // Non-vacuity on purpose: a corpus with no multi-prompt page could not exhibit the defect, so a
  // clean sweep over it would establish nothing. These floors are below the measured values and far
  // enough above zero that an empty or mis-rooted walk fails here instead of passing.
  assert.ok(pagesWithControls >= 20, `only ${pagesWithControls} pages carried prediction controls`);
  assert.ok(
    pagesWithSeveralPrompts >= 5,
    `only ${pagesWithSeveralPrompts} pages carried several prompts, so this sweep could not have found the defect`,
  );
  assert.deepEqual(offenders, []);
});

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const direct = resolve(OUT_DIR, `.${requested}`);
    if (direct !== OUT_DIR && !direct.startsWith(`${OUT_DIR}/`)) {
      res.writeHead(400, { "content-type": CONTENT_TYPES[".txt"] as string });
      res.end("path escapes the build directory");
      return;
    }
    for (const candidate of [direct, `${direct}.html`, join(direct, "index.html")]) {
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        try {
          // READ BEFORE WRITING THE HEADERS. Reversing these two is a real bug and this file had
          // it: a candidate that is a directory makes readFileSync throw, and if the 200 has
          // already been sent the 404 below then fails with ERR_HTTP_HEADERS_SENT instead of
          // serving the next candidate. The helper this was copied from reads first for that
          // reason.
          const body = readFileSync(candidate);
          res.writeHead(200, {
            "content-type": CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
          });
          res.end(body);
          return;
        } catch {
          // a directory: try the next candidate
        }
      }
    }
    res.writeHead(404, { "content-type": CONTENT_TYPES[".txt"] as string });
    res.end("Not Found");
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      done({ baseUrl: `http://127.0.0.1:${port}`, server });
    });
  });
}

test("AX TREE: on a two-prompt page each control resolves to exactly one, by role and name", async () => {
  /*
    Acceptance item 5: "checked against the AX tree rather than the DOM, since that is the
    instrument the defect was found with." The sweep above reads HTML, which is the layer the
    duplication lives in but NOT the layer an assistive technology sees. A role-and-name query is
    that layer: Playwright resolves it through the accessibility tree, and it is literally the query
    that surfaced this defect, as a strict-mode violation reporting "resolved to 2 elements".

    So this asserts three things on /lab/me-02/, which carries two prompts:
      - each full accessible name resolves to EXACTLY ONE control;
      - the two names are distinct;
      - the OLD bare name resolves to ZERO under an exact match, which is what changed, while a
        non-exact match still finds both, which proves they remain siblings on one page and that
        the first assertion is not passing because the page lost a control.
  */
  assertOutFreshness();
  const { baseUrl, server } = await startStaticServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/lab/me-02/`, { waitUntil: "load" });

    const prompts = await page.locator("[data-predict-prompt]").count();
    assert.ok(
      prompts >= 2,
      `/lab/me-02/ carried ${prompts} prompts, so this cannot test the defect`,
    );

    for (const visible of CONTROL_LABELS) {
      // Read the names from the page, so this cannot drift from whatever the prompts' questions are.
      const names = await page
        .locator(`[data-predict-prompt] button[aria-label^="${visible}"]`)
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
      assert.equal(
        names.length,
        prompts,
        `${visible}: ${names.length} controls for ${prompts} prompts`,
      );
      assert.equal(
        new Set(names).size,
        names.length,
        `${visible}: names repeat: ${names.join(" | ")}`,
      );

      for (const name of names) {
        assert.equal(
          await page.getByRole("button", { name, exact: true }).count(),
          1,
          `the AX tree resolves "${name}" to more than one control`,
        );
      }

      // What changed, and what did not.
      assert.equal(
        await page.getByRole("button", { name: visible, exact: true }).count(),
        0,
        `"${visible}" still resolves as a whole accessible name, so nothing was distinguished`,
      );
      assert.equal(
        await page.getByRole("button", { name: visible }).count(),
        prompts,
        `"${visible}" no longer matches every prompt's control, so a control was lost rather than renamed`,
      );
    }
    console.log(
      `[census] predict-control-names AX tree: /lab/me-02/ resolved ${prompts} prompts x ${CONTROL_LABELS.length} controls uniquely by role and name`,
    );
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
