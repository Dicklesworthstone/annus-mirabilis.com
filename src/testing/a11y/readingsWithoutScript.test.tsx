/**
 * A READING ONLY A SCRIPT CAN REVEAL IS ALSO REVEALED WITH NO SCRIPT (am-b7jy).
 *
 * AGENTS.md: the reading experience is excellent "without JavaScript", and "the no-algebra route is
 * not a lesser website". Measured 2026-09-27, the Detail axis broke that in two places at once, and
 * in the direction that costs the least-served reader the most:
 *
 * - THE PAPER FACES. R0 is rendered `<div data-reading="0" hidden>` (PaperPage, PaperReader) and
 *   `reader.css` turns `hidden` into `display: none`. Only `html[data-detail="0"]`, set by the
 *   pre-paint script, reveals it. 8 such blocks on mass-energy's explanation face and 15 on light
 *   quanta's, 0 reachable. R1 needs no attribute and R2 and R3 are native `<details>` a reader can
 *   open, so R0 alone was lost — the one reading written to say what a paragraph claims in a sentence.
 * - THE LABORATORY CAPTIONS, which is the larger half. `labShell.css` sets EVERY `p[data-detail]`
 *   under a lab root to `display: none` and reveals `p[data-detail="1"]` alone; R0, R2 and R3 are
 *   revealed only under `html[data-detail]` or `html[data-lens]`. These are `<p>`, not disclosures, so
 *   a reader without script cannot reach them at all. 63 of 63 caption targets carry all four
 *   authored readings, the only population in the repository where the four-reading promise is
 *   complete, and three quarters of it was unreachable.
 *
 * HOW THE POPULATION IS DERIVED, AND WHY NOT A LIST. A hand-kept list of selectors is the shape that
 * has failed repeatedly here: it drifts from the CSS, and its denominator goes unstated. So this reads
 * the real rules out of `src/**\/*.css`: any rule that reveals something (`display` other than `none`)
 * and whose selector REQUIRES a root attribute a script sets (`html[data-detail]`, `html[data-lens]`,
 * `:root[data-detail]`) is, by construction, a rule only a script can satisfy. The element half of
 * that selector is then the thing a no-script reader must still be able to reach, and the test asks
 * the no-script stylesheet whether it reaches it — by matching selectors against a real DOM, not by
 * searching text, so a rule that merely mentions an attribute in a comment cannot satisfy it.
 *
 * WHAT THIS DOES NOT ANSWER. Specificity and `@media` are not evaluated, so this says a reveal rule
 * exists and reaches the element, not that it wins in a browser. The no-script stylesheet is a flat
 * list with no media queries and uses `!important`, which is what makes the structural question
 * sufficient today; if it gains a media query this test must learn about it. A browser lane owns what
 * is painted. Presence is not reachability either: `querySelectorAll` finds a `hidden` element
 * perfectly well, which is why counting R0 blocks reported 8 per page and told nobody that none of
 * them could be read.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import {
  NOSCRIPT_CONTROLS_CSS,
  NOSCRIPT_READINGS_CSS,
} from "../../components/chrome/noScriptControls.ts";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { exportMarkup } from "../exportMarkup.ts";

/** Every .css file under src, read once. */
function stylesheets(dir: string, out: Array<{ path: string; css: string }> = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) stylesheets(full, out);
    else if (entry.endsWith(".css")) out.push({ path: full, css: readFileSync(full, "utf8") });
  }
  return out;
}

/**
 * Commas at paren depth 0 only. A plain `.split(",")` cuts inside `:is(.laboratory, .lab-readings)`,
 * and it did: the laboratory captions' three gated readings vanished from this test's own population
 * on the first run, and one of the fragments landed in the ungated set where it could have masked
 * others. A selector list is not a comma-separated string.
 */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Selector text of each rule, comments blanked, one entry per selector in the list. */
export function ruleSelectors(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((rule) =>
    splitSelectorList(rule[1] ?? "")
      .filter((s) => !s.startsWith("@"))
      .map((selector) => ({ selector, body: rule[2] ?? "" })),
  );
}

/** A rule that reveals rather than hides. */
function reveals(body: string): boolean {
  const display = [...body.matchAll(/display\s*:\s*([a-z-]+)/g)].at(-1)?.[1];
  return display !== undefined && display !== "none";
}

/** The root-attribute prefixes only the pre-paint script can satisfy. */
const SCRIPT_SET_ROOT = /^(?:html|:root)\[data-(?:detail|lens)=(?:"[^"]*"|[^\]]*)\]\s+/;

/**
 * Element selectors that ONLY a script can reveal: the element half of a reveal rule whose selector
 * requires a script-set root attribute, where no rule reveals that same element without one.
 */
export function scriptOnlyReveals(sheets: ReadonlyArray<{ path: string; css: string }>): Array<{
  selector: string;
  from: string;
}> {
  const gated: Array<{ selector: string; from: string }> = [];
  const ungated = new Set<string>();
  for (const sheet of sheets)
    for (const { selector, body } of ruleSelectors(sheet.css)) {
      if (!reveals(body)) continue;
      const match = SCRIPT_SET_ROOT.exec(selector);
      if (match) gated.push({ selector: selector.slice(match[0].length).trim(), from: sheet.path });
      else ungated.add(selector);
    }
  // A reading revealed unconditionally somewhere else is already reachable; R1 is exactly that.
  return gated.filter((g) => !ungated.has(g.selector));
}

const noScript = ruleSelectors(`${NOSCRIPT_CONTROLS_CSS}${NOSCRIPT_READINGS_CSS}`);
const sheets = stylesheets(join(process.cwd(), "src"));
const gatedReveals = scriptOnlyReveals(sheets);

/** Does a no-script rule that reveals reach an element matching this selector? */
function revealedWithoutScript(selector: string): boolean {
  const { document } = new Window();
  // The element the gated selector describes, built so a no-script selector can be matched against
  // it. Ancestors in the selector are supplied as wrappers, so a descendant selector can match.
  const parts = selector.split(/\s*>\s*|\s+/).filter((p) => p.length > 0);
  let html = "";
  for (const part of parts) {
    const tag = /^[a-z]+/.exec(part)?.[0] ?? "div";
    const attrs = [...part.matchAll(/\[([a-zA-Z-]+)(?:=["']?([^\]"']*)["']?)?\]/g)]
      .map(([, name, value]) => `${name}="${value ?? ""}"`)
      .join(" ");
    const classes = [...part.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]).join(" ");
    html += `<${tag} ${attrs} ${classes ? `class="${classes}"` : ""}>`;
  }
  document.body.innerHTML = html;
  // The element the selector's LAST compound describes: the wrappers above it exist only so a
  // descendant selector has something to descend through.
  const deepest = [...document.body.querySelectorAll("*")].at(-1) ?? document.body;
  return noScript.some(({ selector: candidate, body }) => {
    if (!reveals(body)) return false;
    try {
      return (deepest as unknown as Element).matches(candidate);
    } catch {
      return false;
    }
  });
}

/**
 * Gated reveal rules whose element IS reachable without script by another route. Each entry names the
 * route, because an exemption with no reason is just a way of not looking. A gated selector with no
 * entry here and no no-script rule fails the test, so a new one arrives red rather than silently.
 */
const REACHABLE_BY_ANOTHER_ROUTE = new Map<string, string>([
  [
    '.eq-level[data-level="0"]',
    "The explanation panel's levels are toggled by a checkbox wrapped in its label, revealed by " +
      '.eq-explainer:has(.eq-explain-level[data-level="0"]:checked) in equationExplainer.css. A ' +
      "checkbox and :has() need no script, which is the whole design of that panel.",
  ],
  [
    '.eq-level[data-level="1"]',
    'Revealed with no script at all by :root:not([data-detail]) .eq-level[data-level="1"]: the ' +
      "panel's default when nothing set the attribute. Also reachable by its own checkbox.",
  ],
  ['.eq-level[data-level="2"]', "Reachable by its own checkbox, as for level 0."],
  [
    'details[data-reading="2"]',
    "A native <details>. It is visible by default and a reader opens it; the gated rule only opens it " +
      "for a reader whose Detail is already 'Show every step'. reader.css:550 states the same " +
      "reasoning for the historian's margin.",
  ],
  [
    'details[data-reading="2"]::details-content',
    "The content of that same <details>, revealed when the reader opens it.",
  ],
  ['[data-reading="2"]', "The same <details> as above, addressed unscoped by detail.css."],
  ['.reader-root [data-reading="2"]', "The same <details>, addressed by reader.css."],
  [
    '.reader-root [data-reading="3"]',
    "The historian's margin is a <details> a reader can open, and it is the Perspective axis rather " +
      "than the Detail axis. reader.css:550 says so at the rule.",
  ],
]);

describe("a reading only a script can reveal is also revealed with no script", () => {
  test("the derivation finds the real gated population", () => {
    // Not vacuous: an empty population would make the check below pass while proving nothing, and
    // that is exactly how this defect survived. The number is reported, not asserted equal.
    console.log(
      `[readings without script] ${sheets.length} stylesheets, ${gatedReveals.length} reveal rules need a script-set root attribute: ${[
        ...new Set(gatedReveals.map((g) => g.selector)),
      ]
        .slice(0, 12)
        .join(" | ")}`,
    );
    expect(gatedReveals.length).toBeGreaterThan(0);
    expect(noScript.length).toBeGreaterThan(0);
  });

  test("every exemption names a rule that is actually in the stylesheets", () => {
    // An exemption for a selector no rule gates any more is stale, and a stale exemption is how a
    // real gap hides. The keys must all be live.
    const live = new Set(gatedReveals.map((g) => g.selector));
    expect([...REACHABLE_BY_ANOTHER_ROUTE.keys()].filter((k) => !live.has(k))).toEqual([]);
    for (const [key, reason] of REACHABLE_BY_ANOTHER_ROUTE)
      expect(reason.length, `${key} has no reason`).toBeGreaterThan(40);
  });

  test("every reading a script alone could reveal is reachable without one", () => {
    const unreachable = [
      ...new Set(
        gatedReveals
          .filter(
            (g) =>
              !revealedWithoutScript(g.selector) && !REACHABLE_BY_ANOTHER_ROUTE.has(g.selector),
          )
          .map((g) => `${g.selector}  (${g.from.replace(`${process.cwd()}/`, "")})`),
      ),
    ].sort();
    expect(unreachable).toEqual([]);
  });

  test("a revealed reading is named in real text, not in generated content", async () => {
    // THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-28, and it was wrong in the way am-b7jy's own
    // criterion names: it checked that the injected stylesheet carried `content:` rules naming the
    // readings. Generated content is not text a screen reader can be relied on to read, cannot be
    // selected, and is not translated, and a reader with scripts off is exactly who this serves.
    // So the labels are <noscript><b class="reading-label"> in the markup now, and this asserts
    // the rendered words, with the old mechanism as an explicit negative.
    const html = await exportMarkup(await PaperPage({ paperId: "mass-energy" } as never));
    const labels = [...html.matchAll(/<b class="reading-label">([^<]+)<\/b>/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(4);
    expect(new Set(labels)).toEqual(new Set(["In one breath", "Full explanation"]));
    // Each one sits inside a <noscript>, so a reader WITH script is not shown a second name for a
    // reading the Detail control already names.
    const outside = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
    expect(outside).not.toContain("reading-label");
    // The negative: no rule in the injected stylesheet names a reading through generated content.
    const generated = ruleSelectors(NOSCRIPT_READINGS_CSS).filter(({ body }) =>
      /content\s*:/.test(body),
    );
    expect(generated.map(({ selector }) => selector)).toEqual([]);
  });

  test("the paper faces really do render a hidden R0, so the rule above has work to do", async () => {
    const counts: string[] = [];
    let hiddenTotal = 0;
    for (const paper of ["mass-energy", "light-quanta"]) {
      const html = await exportMarkup(await PaperPage({ paperId: paper } as never));
      const { document } = new Window();
      document.body.innerHTML = html;
      const hidden = [...document.querySelectorAll('[data-reading="0"][hidden]')].length;
      hiddenTotal += hidden;
      counts.push(`${paper}: ${hidden}`);
    }
    console.log(
      `[readings without script] hidden R0 blocks per explanation face — ${counts.join("; ")}`,
    );
    expect(hiddenTotal).toBeGreaterThan(0);
  });
});
