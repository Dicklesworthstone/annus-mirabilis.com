/**
 * EVERY JOURNEY'S "THE MOVE" LINK LANDS SOMEWHERE A READER CAN SEE (am-4k0m).
 *
 * The move is the one non-obvious step each discovery route names as such, and `MOVE_HREF` is the
 * link out of the route into the paper where it happens. Nothing checked that link. The skeleton
 * census (`src/discovery/checks/journeySkeletonCensus.test.ts`) asserts that `MOVE_HREF` is
 * EXPORTED, which is a different claim: a journey could export a link to an anchor that no page
 * carries and stay green, and the reader would arrive at the top of a section with no idea which
 * sentence was meant.
 *
 * So this reads the built pages. Measured 2026-10-07: all four resolve, each anchor appearing
 * exactly once on its target page. That is the state this file freezes.
 *
 * IT ALSO PINS THE GAP am-4k0m'S FOURTH DRIFT ITEM NAMES, which is NOT a broken link and should not
 * be confused with one. Only brownian-motion's href carries `?open=derivation-step:`, the form that
 * opens the marked step itself; the other three land on the argument passage with the move not
 * openable as a step. `content/equations/derivations/` holds one chain, `bm-variance.yaml`, with one
 * `isMove: true`. The three named below are a tightening pawl: author a chain for one of them and
 * this file goes red until its name is removed, so the ceiling comes down with the work.
 *
 * Node lane, because it reads `out/`. bunfig excludes `scripts/e2e` and the e2e glob from `bun test`
 * and the node lane derives its list from those same patterns, so membership here is the filename.
 *
 * IT READS FILES RATHER THAN IMPORTING THE JOURNEY MODULES, and not by preference: importing
 * `realJourneys.ts` under `node --experimental-strip-types` fails with ERR_IMPORT_ATTRIBUTE_MISSING,
 * because something in that graph imports JSON and node requires `with { type: "json" }` where bun
 * does not. Reading the module text and the emitted records is also the better instrument here, since
 * a check on inputs should read the inputs rather than a layer that has already resolved them.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The move link per paper, read from the journey modules the pages render from, so this cannot
 * drift from what a reader clicks.
 */
const MOVE_HREFS: Readonly<Record<string, string>> = {
  "light-quanta": "/papers/light-quanta/s6/#arg-lq-entropy-correspondence",
  "brownian-motion":
    "/papers/brownian-motion/s4/?open=derivation-step:bm-variance-cross#arg-bm-independent-steps",
  "special-relativity": "/papers/special-relativity/s1/#arg-sr-synchronization",
  "mass-energy": "/papers/mass-energy/#me-the-move",
};

/**
 * The papers whose move is NOT yet openable as a derivation step, with the bead that owns it.
 * Remove a name when its chain lands; the test below fails until you do.
 */
const MOVE_NOT_OPENABLE_AS_A_STEP: readonly string[] = Object.freeze([
  "light-quanta",
  "special-relativity",
  "mass-energy",
]);

/** The module that declares each paper's skeleton, and the record emitted from it. */
const JOURNEY_MODULES: Readonly<Record<string, string>> = {
  "light-quanta": "src/discovery/lightQuanta/journeyI.ts",
  "brownian-motion": "src/discovery/brownian/journeyII.ts",
  "special-relativity": "src/discovery/relativity/journeyIII.ts",
  "mass-energy": "src/discovery/massEnergy/journeyIV.ts",
};

/** `export const MOVE_HREF = "..."`, however it is wrapped across lines. */
function moveHrefOf(relativePath: string): string {
  const text = readFileSync(join(REPO_ROOT, relativePath), "utf8");
  const match = /export const MOVE_HREF\s*=\s*\n?\s*"([^"]+)"/.exec(text);
  assert.ok(match, `${relativePath} exports a string MOVE_HREF`);
  return match?.[1] ?? "";
}

/** `move:` `chainId:` / `stepId:` from the emitted record, read as text to avoid a YAML dependency. */
function moveOf(paper: string): Readonly<{ chainId: string; stepId: string }> {
  const text = readFileSync(join(REPO_ROOT, "content/journeys", `${paper}.yaml`), "utf8");
  const block = /^move:\n((?:[ \t]+.*\n)+)/m.exec(text);
  assert.ok(block, `content/journeys/${paper}.yaml carries a move block`);
  const body = block?.[1] ?? "";
  const chainId = /^\s+chainId:\s*(\S+)/m.exec(body)?.[1] ?? "";
  const stepId = /^\s+stepId:\s*(\S+)/m.exec(body)?.[1] ?? "";
  return { chainId, stepId };
}

type ParsedHref = Readonly<{ path: string; openParam: string | null; anchor: string }>;

function parseHref(href: string): ParsedHref {
  const url = new URL(href, "https://annus-mirabilis.com");
  return {
    path: url.pathname,
    openParam: url.searchParams.get("open"),
    anchor: url.hash.replace(/^#/, ""),
  };
}

/** The built file a path serves, following the export's directory-index shape. */
function builtFileFor(path: string): string {
  return join(REPO_ROOT, "out", path.replace(/^\/+/, ""), "index.html");
}

test("the four move links are the ones the journey modules export, so this file cannot drift", () => {
  // If a module's MOVE_HREF changes and the table above does not, every assertion below would be
  // checking a link nobody can click. Read it back out of the module that declares it.
  assert.deepEqual(Object.keys(MOVE_HREFS).sort(), Object.keys(JOURNEY_MODULES).sort());
  assert.equal(Object.keys(MOVE_HREFS).length, 4);
  for (const [paper, modulePath] of Object.entries(JOURNEY_MODULES)) {
    assert.equal(
      moveHrefOf(modulePath),
      MOVE_HREFS[paper],
      `${paper}: MOVE_HREF matches ${modulePath}`,
    );
    const move = moveOf(paper);
    assert.ok(move.chainId, `${paper}'s move names a chain`);
    assert.ok(move.stepId, `${paper}'s move names a step`);
  }
});

test("every move link lands on an element that exists, exactly once, on the page it names", () => {
  assertOutFreshness("out", REPO_ROOT);
  const landed: string[] = [];
  for (const [paper, href] of Object.entries(MOVE_HREFS)) {
    const { path, anchor } = parseHref(href);
    assert.ok(anchor, `${paper}: the move link carries an anchor`);
    const file = builtFileFor(path);
    assert.ok(existsSync(file), `${paper}: ${path} is built (looked for ${file})`);
    const html = readFileSync(file, "utf8");
    const count = html.split(`id="${anchor}"`).length - 1;
    // Exactly one: zero is a link into nothing, and two is an ambiguous target where the browser
    // picks the first and an editor cannot tell which was meant.
    assert.equal(count, 1, `${paper}: id="${anchor}" appears ${count} times in ${path}`);
    landed.push(paper);
  }
  // Non-vacuity: an empty table would have made the loop above a silent pass.
  assert.equal(landed.length, 4, `checked ${landed.length} move links`);
  console.log(`[journey moves] 4 move links checked; ${landed.length} land on a unique element`);
});

test("only brownian-motion's move opens the marked derivation step, and the other three are named", () => {
  const openable = Object.entries(MOVE_HREFS)
    .filter(([, href]) => parseHref(href).openParam?.startsWith("derivation-step:"))
    .map(([paper]) => paper)
    .sort();
  const notOpenable = Object.keys(MOVE_HREFS)
    .filter((paper) => !openable.includes(paper))
    .sort();
  console.log(
    `[journey moves] ${openable.length} of 4 open the marked step (${openable.join(", ") || "none"}); ` +
      `${notOpenable.length} land on the passage only (${notOpenable.join(", ")})`,
  );
  // The pawl. Authoring a chain for one of these and pointing its href at the step fails here until
  // the name comes out, which is what stops a declared gap outliving its reason.
  assert.deepEqual(notOpenable, [...MOVE_NOT_OPENABLE_AS_A_STEP].sort());
  assert.deepEqual(openable, ["brownian-motion"]);
});

test("the one openable move names a chain step that exists and is marked as the move", () => {
  const { openParam } = parseHref(MOVE_HREFS["brownian-motion"] as string);
  const stepId = (openParam ?? "").slice("derivation-step:".length);
  assert.equal(stepId, "bm-variance-cross");
  const move = moveOf("brownian-motion");
  assert.equal(move.stepId, stepId, "the link and the record name the same step");
  const chainId = move.chainId;
  const chain = join(REPO_ROOT, "content/equations/derivations", `${chainId}.yaml`);
  assert.ok(existsSync(chain), `the chain record ${chainId}.yaml exists`);
  // These records carry a .yaml extension and hold JSON; scripts/audit-derivation-tools.ts reads
  // them with parseContentJson for the same reason. Parsed rather than grepped, because the marker
  // has to be on THIS step: the chain has four steps and three of them carry `isMove: false`, so a
  // file-wide pattern would pass with the move marked on the wrong line.
  const record = JSON.parse(readFileSync(chain, "utf8")) as {
    chain?: { steps?: { id?: string; isMove?: boolean; moveLabel?: string }[] };
  };
  const steps = record.chain?.steps ?? [];
  assert.ok(steps.length > 1, `${chainId}.yaml holds a chain of steps`);
  const marked = steps.filter((step) => step.isMove === true).map((step) => step.id);
  assert.deepEqual(marked, [stepId], `${chainId}.yaml marks exactly the linked step as the move`);
  const step = steps.find((candidate) => candidate.id === stepId);
  // A marked step with no label opens a derivation and never says what the non-obvious move was.
  assert.ok(step?.moveLabel?.trim(), `${stepId} carries a moveLabel`);
  console.log(`[journey moves] ${chainId} marks ${stepId}: "${step?.moveLabel}"`);
});
