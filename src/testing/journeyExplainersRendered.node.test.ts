/**
 * A READER OF EACH DISCOVER PAGE CAN REACH THE WORDS (am-hk4b criterion 5).
 *
 * 739 lines and 39 authored entries sat in `content/journey-explanations/` with no loader, no
 * renderer and no reader. The compile and the payload are judged by
 * `src/content/journeyExplanations.test.ts` and the registered `journey-explanations` gate; this is
 * the half that reads the BUILT PAGES, because a payload that compiles and a panel a reader meets
 * are different claims, and this campaign has already recorded a gate green over a record no page
 * drew.
 *
 * IN THE NODE LANE, because it reads `out/`. That lane refuses to start against a stale build and
 * says so, which is the precondition this needs and the wrong thing to re-invent: a bun-lane
 * version would have to choose between failing for everyone without a fresh build and skipping
 * silently, and a silent skip is a vacuous pass.
 *
 * IT ASSERTS BOTH HALVES OF THE READER'S ROUTE, and the second is here because the first was once
 * green while the second was broken. The panel's control is a REAL ANCHOR to
 * `/equations/[paper]/[id]/`, which is what AGENTS.md requires of a no-JavaScript reader rather than
 * a hydration-dependent button. On the first build of this feature all 39 panels rendered and every
 * one of those routes was a 404, because the explainers had not been added to the payload
 * `everyExplanationRoute()` generates from. A broken link reads as a broken site rather than as a
 * gap, so the page's panel alone is not the claim.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import payload from "../generated/journey-explanations.json" with { type: "json" };
import { assertOutFreshness } from "./outFreshness.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT = join(ROOT, "out");

type Levels = Readonly<{
  paper: string;
  display?: string;
  equation?: string;
  inWords: readonly Readonly<{ text: string }>[];
  levels?: readonly string[];
}>;
const PAGES = (payload as unknown as { pages: Record<string, Record<string, Levels>> }).pages;

/** The six pages the records declare, read from the payload rather than listed here. */
const ROUTES = Object.keys(PAGES).sort();

function html(route: string): string {
  const file = join(OUT, route, "index.html");
  assert.ok(existsSync(file), `${route} was not built; ${file} is absent`);
  return readFileSync(file, "utf8");
}

/** Tags stripped and whitespace collapsed, so an assertion reads what a reader reads. */
function readable(markup: string): string {
  return markup
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

test("the payload names six pages and 39 formulas, so this test has a population", () => {
  // A census, not a budget: the number is what the records declare, and zero pages would make every
  // assertion below pass over nothing.
  const total = Object.values(PAGES).reduce((n, byLatex) => n + Object.keys(byLatex).length, 0);
  console.log(
    `[journey explainers rendered] ${ROUTES.length} pages, ${total} formulas: ${ROUTES.join(", ")}`,
  );
  assert.equal(ROUTES.length, 6);
  assert.equal(total, 39);
});

test("every page draws a panel for each of its formulas", () => {
  assertOutFreshness();
  for (const route of ROUTES) {
    const markup = html(route);
    const expected = Object.keys(PAGES[route] ?? {}).length;
    // Counted by the explainer's own identity rather than by the wrapper, because a wrapper appears
    // once per pair while an id appears once per explanation.
    const drawn = new Set(
      [...markup.matchAll(/data-explains="(journey-[^"]+|eq-[^"]+)"/g)].map((m) => m[1]),
    );
    assert.ok(
      drawn.size >= expected,
      `${route}: ${expected} formulas have an explainer in the payload and the page draws ${drawn.size}`,
    );
    assert.match(markup, /data-journey-formula-explained="/);
  }
});

test("EVERY entry's in-words text is reachable, and its control is a real link that resolves", () => {
  assertOutFreshness();
  let checkedWords = 0;
  let checkedRoutes = 0;
  for (const route of ROUTES) {
    for (const levels of Object.values(PAGES[route] ?? {})) {
      const id = levels.equation ?? levels.display;
      assert.ok(id, `${route}: an explainer carries neither an equation nor a display id`);
      // THE NO-JAVASCRIPT ROUTE MUST EXIST. This is the assertion the first build would have failed.
      const page = join(OUT, "equations", levels.paper, id, "index.html");
      assert.ok(
        existsSync(page),
        `${route}: the panel for ${id} links to /equations/${levels.paper}/${id}/, which was not built`,
      );
      const words = levels.inWords
        .map((phrase) => phrase.text)
        .join("")
        .replaceAll(/\s+/g, " ")
        .trim();
      assert.ok(words.length > 0, `${route} ${id}: carries no in-words text`);
      // The longest phrase, so the probe is a sentence a reader would recognise rather than a
      // connective like " is " that any page would contain.
      const probe = [...levels.inWords]
        .map((phrase) => phrase.text.trim())
        .sort((a, b) => b.length - a.length)[0];
      assert.ok(probe && probe.length > 8, `${route} ${id}: no phrase long enough to assert on`);
      assert.ok(
        readable(readFileSync(page, "utf8")).includes(probe),
        `${route} ${id}: the explanation page does not contain its own in-words phrase ${JSON.stringify(probe)}`,
      );
      checkedWords += 1;
    }
    checkedRoutes += 1;
  }
  console.log(
    `[journey explainers rendered] ${checkedWords} explanations reachable across ${checkedRoutes} pages`,
  );
  assert.equal(checkedRoutes, 6);
  assert.equal(checkedWords, 39);
});

test("a step gloss carries the step's full explanation and the record's margin", () => {
  assertOutFreshness();
  // One named instance, end to end, so the three sources a step gloss composes are each shown to
  // arrive: the record's in-words, the STEP's own explanation, and the record's historian's margin.
  const page = join(
    OUT,
    "equations",
    "mass-energy",
    "journey-discover-mass-energy-investigate-opposite-pulses",
    "index.html",
  );
  assert.ok(existsSync(page), `${page} was not built`);
  const text = readable(readFileSync(page, "utf8"));
  assert.ok(
    text.includes("Two equal halves of the emitted light energy leave in opposite directions"),
    "the record's in-words is absent",
  );
  assert.ok(
    text.includes("Two equal pulses leave in opposite directions in the body's rest frame"),
    "the step's own explanation is absent, so the panel has no full explanation",
  );
  assert.ok(
    text.includes("The paper's § 1 makes the same choice"),
    "the record's historian's margin is absent",
  );
});
