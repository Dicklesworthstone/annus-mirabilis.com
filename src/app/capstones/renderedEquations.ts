import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE MATHEMATICS A CAPSTONE'S EQUATION SECTION TURNS ON, READ RATHER THAN RENDERED HERE
 * (dispatch 426).
 *
 * Measured on live before this: all four capstones carried ZERO rendered mathematics and zero
 * figures, while the section pages of the same papers carry 84 to 464 KaTeX instances each. The
 * section is headed "The displays this argument turns on" and showed none of them: a title, a
 * purpose, the authored spoken form, and a link away.
 *
 * WHY THAT WAS WRONG, and it is narrower than "a capstone should have equations". The spoken form
 * is the equation's ACCESSIBLE NAME (AGENTS.md: authored ClearSpeak, "because generated speech is
 * often wrong for physics notation"). Shipping only the spoken form hands every reader the
 * nonvisual equivalent and no reader the thing it is equivalent to, which inverts what that field
 * is for: the doctrine treats the view and its description as two obligations, not two options.
 * It bites hardest on mass-energy, whose record says in its own words that "the drop has the shape
 * of one half m v squared, with L over c squared standing where a mass stands. That shape, not a
 * coincidence of numbers, is the argument." A shape is not visible in a sentence.
 *
 * NOTHING IS RENDERED OR RETYPED HERE. scripts/build-equations.ts already compiles every equation
 * record's expression tree to KaTeX at build time and writes `html`, `mathml`, `plainLatex` and a
 * `treeDigest` into src/generated/<paper>-equations.json, under one `rendererDigest` for the file.
 * This reads that `html`. So the capstone shows what the reading faces show, from the same bytes,
 * and "Results read from the edition, never retyped" holds literally: no LaTeX is written in this
 * repository's capstone code and no letter is substituted in any.
 *
 * WHAT THESE EQUATIONS ARE, which the page must not overstate. The capstone records name
 * `eq-model-*` equations, whose own field says `notation: modern-pedagogical` and whose assumptions
 * say "These are modern teaching equations in SI notation, not a transcription of the printed
 * paper." They are therefore shown AS the edition's modern reading, beside the existing link to
 * where the paper prints the display each is bound to. Calling them Einstein's printed line would
 * be false, and the dispatch that asked for "the paper's own printed result" was assuming records
 * that these are not.
 *
 * A MISSING RENDERING IS NOT PAPERED OVER. This returns undefined rather than throwing, so a
 * record added before the generator runs cannot break a build; `capstoneEquationMath` in
 * mathematics.test.tsx asserts that all four capstones' equations resolve, so the absence fails in
 * a test that names the id instead of failing silently on a page.
 */

/** One equation's build-time rendering, as scripts/build-equations.ts wrote it. */
export type RenderedEquation = Readonly<{
  /** KaTeX HTML. Its visual layer already carries aria-hidden; the spoken form is the name. */
  html: string;
  /** The generated LaTeX, kept for tests that compare renderings rather than for display. */
  plainLatex: string;
  /** The digest of the expression tree this was compiled from. */
  treeDigest: string;
}>;

type GeneratedFile = Readonly<{
  rendererDigest: string;
  equations: readonly Readonly<{
    id: string;
    html?: string;
    plainLatex?: string;
    treeDigest?: string;
  }>[];
}>;

/**
 * Which generated file holds a paper's equations, because the names are NOT the slug plus a suffix.
 *
 * scripts/build-equations.ts writes them from its own list, and Brownian's file is
 * `brownian-equations.json` rather than `brownian-motion-equations.json`. Deriving the name from
 * the slug therefore works for three papers and throws for the fourth, which is exactly what it
 * did on the first run here. This mirrors the generator's list rather than guessing, and
 * mathematics.test.tsx resolves an equation for all four capstones, so a rename upstream fails
 * there instead of on a page.
 */
const GENERATED_FILE: Readonly<Record<string, string>> = {
  "brownian-motion": "brownian-equations",
  "mass-energy": "mass-energy-equations",
  "light-quanta": "light-quanta-equations",
  "special-relativity": "special-relativity-equations",
};

const cache = new Map<string, Map<string, RenderedEquation>>();

function fileFor(paper: string, root: string): Map<string, RenderedEquation> {
  const cached = cache.get(paper);
  if (cached) return cached;
  const file = GENERATED_FILE[paper];
  if (file === undefined) return new Map();
  const path = join(root, "src", "generated", `${file}.json`);
  const found = new Map<string, RenderedEquation>();
  const parsed = JSON.parse(readFileSync(path, "utf8")) as GeneratedFile;
  for (const equation of parsed.equations) {
    if (
      typeof equation.html === "string" &&
      equation.html.length > 0 &&
      typeof equation.plainLatex === "string" &&
      typeof equation.treeDigest === "string"
    )
      found.set(equation.id, {
        html: equation.html,
        plainLatex: equation.plainLatex,
        treeDigest: equation.treeDigest,
      });
  }
  cache.set(paper, found);
  return found;
}

/**
 * The rendering for one equation id, or undefined when the generator has not written one.
 *
 * `paper` is the paper whose generated file to read, which is the paper the capstone belongs to;
 * a capstone never names an equation from another paper.
 */
export function renderedEquation(
  paper: string,
  equationId: string,
  root: string = process.cwd(),
): RenderedEquation | undefined {
  return fileFor(paper, root).get(equationId);
}
