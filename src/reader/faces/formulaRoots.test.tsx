/**
 * EVERY FORMULA ON A READING FACE IS COLOURED, OR IS A NAME THAT SAYS WHAT IT NAMES (dispatch 280,
 * step 1b). The owner: "all the equations must be colored, and all must have the nice hover-over
 * effects".
 *
 * On the German, English, parallel and gloss faces of every enforced paper, each KaTeX root drawn
 * is exactly one of:
 * - COLOURED: it marks a quantity (data-quantity-id), which the face lights and pins;
 * - LABELLED: its atoms are names the notation declares no quantity, a point A, an axis X, a system
 *   K, a sign, each marked data-label with a note of what it names, which the face lights and pins;
 * - A CHIP'S GLYPH: the symbol inside a term chip, which carries its quantity and its colour (--qc);
 * - A WORD EQUATION: a printed display whose record binds no letter because it prints words
 *   (content/display-terms), named by its spoken form;
 * - A NUMBER: a formula with no printed letter at all (2/3, 6 · 10^23).
 * Anything else fails, naming its block.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { renderToString } from "katex";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { printedAtoms } from "../../equations/latex/printedAtoms.ts";
import { ENFORCED_INLINE_PAPERS } from "../../equations/printed/paperInlines.ts";
import { paperLabelNotes } from "../../equations/printed/inlineLabels.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { blocksBySection } from "./glossSections.ts";

const FACES = ["german", "english", "parallel", "gloss"] as const;
type Kind = "coloured" | "labelled" | "chip" | "word-equation" | "number";
type Census = { counts: Record<Kind, number>; problems: string[] };

/** The displays whose record binds no letter: they print words (content/display-terms). */
function wordEquations(paper: string): ReadonlySet<string> {
  const dir = join(process.cwd(), "content", "display-terms");
  if (!readdirSync(dir).includes(`${paper}.yaml`)) return new Set();
  const raw = parseYaml(readFileSync(join(dir, `${paper}.yaml`), "utf8")) as {
    displays?: { display: string; terms?: unknown[] }[];
  };
  return new Set(
    (raw.displays ?? []).filter((d) => (d.terms ?? []).length === 0).map((d) => d.display),
  );
}

/** Whether a formula's TeX prints no letter: no atom for a concordance to read. */
function printsNoLetter(tex: string): boolean {
  try {
    return printedAtoms(tex).length === 0;
  } catch {
    return false;
  }
}

/** Every KaTeX root of a page, by kind, and every one that is none of them, by its block. */
function census(
  paper: string,
  html: string,
  notes: Readonly<Record<string, string>>,
  words: ReadonlySet<string>,
): Census {
  const { document } = new Window();
  document.body.innerHTML = html;
  const out: Census = {
    counts: { coloured: 0, labelled: 0, chip: 0, "word-equation": 0, number: 0 },
    problems: [],
  };
  const roots = [...document.querySelectorAll(".katex")].filter(
    (el) => !el.parentElement?.closest(".katex") && el.querySelector(".katex-html"),
  );
  for (const root of roots) {
    const tex = root.querySelector("annotation")?.textContent ?? "";
    const block =
      root.closest("[data-block-id]")?.getAttribute("data-block-id") ??
      root.closest("[id]")?.id ??
      "(no block)";
    const where = `${paper} ${block} ${JSON.stringify(tex.slice(0, 40))}`;
    if (root.querySelector("[data-quantity-id]")) {
      out.counts.coloured++;
      continue;
    }
    const labels = [...root.querySelectorAll("[data-label]")];
    if (labels.length > 0) {
      const unnoted = labels
        .map((l) => l.getAttribute("data-label") ?? "")
        .filter((id) => !notes[id]);
      const formula = root.closest(".inline-math");
      if (unnoted.length > 0)
        out.problems.push(`${where}: labels ${unnoted.join(", ")} say nothing of what they name`);
      else if (!formula?.hasAttribute("data-inline-labels"))
        out.problems.push(`${where}: its labels are not marked for the face to light`);
      else out.counts.labelled++;
      continue;
    }
    const chip = root.closest(".term-chip[data-quantity-id]");
    if (chip && /--qc\s*:/.test(chip.getAttribute("style") ?? "")) {
      out.counts.chip++;
      continue;
    }
    const display = root.closest("[data-display-terms]");
    if (
      display &&
      words.has(display.getAttribute("data-display-terms") ?? "") &&
      (display.getAttribute("aria-label") ?? "").length > 0
    ) {
      out.counts["word-equation"]++;
      continue;
    }
    if (tex && printsNoLetter(tex)) {
      out.counts.number++;
      continue;
    }
    out.problems.push(`${where}: neither coloured nor a name with a note`);
  }
  return out;
}

async function facePages(paper: string, face: (typeof FACES)[number]): Promise<string> {
  const edition = await loadBilingualEdition(paper);
  const sections = face === "gloss" ? [...blocksBySection(edition?.blocks ?? []).keys()] : [];
  const pages =
    face === "gloss"
      ? await Promise.all(sections.map((section) => PaperPage({ paperId: paper, section, face })))
      : [await PaperPage({ paperId: paper, face })];
  return (await Promise.all(pages.map((page) => exportMarkup(page)))).join("\n");
}

/**
 * This one renders sixteen whole faces, four papers by four faces, the gloss one page per section,
 * and reads every KaTeX root on each. It took 5,981 ms on 5a999b12, over bun's 5,000 ms default,
 * and the deploy lane runs `bun test` with that default, so the test says its own budget here
 * rather than depend on the lane passing a flag. 60,000 ms is room for a slow machine under a
 * parallel build, not a licence to grow: it is the whole file's work, not one face's.
 */
const WHOLE_CORPUS_MS = 60_000;

describe("every formula on a reading face is coloured, or a name that says what it names", () => {
  test(
    "on every face of every enforced paper",
    async () => {
      expect(ENFORCED_INLINE_PAPERS.length).toBeGreaterThan(0);
      const problems: string[] = [];
      let labelled = 0;
      for (const paper of ENFORCED_INLINE_PAPERS) {
        // The very map the page's islands ship, so a name the reader points at says what this reads.
        const notes = paperLabelNotes(paper, process.cwd());
        const words = wordEquations(paper);
        for (const face of FACES) {
          const found = census(paper, await facePages(paper, face), notes, words);
          // The denominator: every root read, by kind.
          console.log(`[formula roots] ${paper} ${face}: ${JSON.stringify(found.counts)}`);
          expect(found.counts.coloured).toBeGreaterThan(0);
          labelled += found.counts.labelled;
          problems.push(...found.problems);
        }
      }
      expect(problems).toEqual([]);
      // Not vacuous: the faces do print names, and each was read as one.
      expect(labelled).toBeGreaterThan(0);
    },
    WHOLE_CORPUS_MS,
  );

  test("the plants: a bare letter, and a name that says nothing, are refused by their block", () => {
    const bare = renderToString("q", { output: "htmlAndMathml" });
    const named = renderToString("A", { output: "htmlAndMathml" }).replace(
      '<span class="mord mathnormal">A</span>',
      '<span data-term="l1" data-label="L99"><span class="mord mathnormal">A</span></span>',
    );
    // The plant's footing: the marked render carries its label, so the census reaches the rule.
    expect(named).toContain('data-label="L99"');
    const page = `
      <p data-block-id="s3-p99"><span class="inline-math">${bare}</span></p>
      <p data-block-id="s3-p98"><span class="inline-math" data-paper="special-relativity" data-inline-labels="">${named}</span></p>
      <p data-block-id="s3-p97"><span class="inline-math">${renderToString("2/3", { output: "htmlAndMathml" })}</span></p>`;
    const found = census("special-relativity", page, {}, new Set());
    expect(found.problems).toEqual([
      'special-relativity s3-p99 "q": neither coloured nor a name with a note',
      'special-relativity s3-p98 "A": labels L99 say nothing of what they name',
    ]);
    // A number is not a letter: it is counted, not refused.
    expect(found.counts.number).toBe(1);
  });
});
