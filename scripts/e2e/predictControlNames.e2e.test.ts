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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
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

test("no built page announces two prediction controls by the same name", () => {
  assertOutFreshness();
  assert.equal(existsSync(join(OUT_DIR, "index.html")), true, "run bun run build before this lane");

  let pagesWithControls = 0;
  let pagesWithSeveralPrompts = 0;
  let controls = 0;
  let unlabelled = 0;
  const offenders: string[] = [];

  for (const page of builtPages(OUT_DIR)) {
    const names = predictControlNames(readFileSync(page, "utf8"));
    if (names.length === 0) continue;
    pagesWithControls += 1;
    controls += names.length;
    unlabelled += names.filter((n) => !n.labelled).length;
    // Each prompt renders both controls, so more than two means more than one prompt.
    if (names.length > CONTROL_LABELS.length) pagesWithSeveralPrompts += 1;
    const duplicates = duplicateAccessibleNames(readFileSync(page, "utf8"));
    if (duplicates.length > 0) {
      offenders.push(`${page.slice(REPO_ROOT.length + 1)}: ${duplicates.join(", ")}`);
    }
  }

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
