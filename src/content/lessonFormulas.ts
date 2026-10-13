/**
 * WHERE A LESSON'S FORMULA IS USED IN THE PAPERS, AND WHICH OF ITS LETTERS ARE PLACEHOLDERS
 * (dispatch 300, from SapphireCastle's accepted proposal).
 *
 * A printed display already points at a foundation lesson, through the prerequisites of the
 * argument that explains it. Nothing pointed the other way, so a reader who had just understood a
 * lesson could not find the line in a paper that uses it. `content/lesson-formulas/<lesson>.yaml`
 * carries that edge, and two judgements beside it. Each entry names its formula by the latex the
 * lesson writes, byte for byte, and is one of two things:
 *
 * - `usedAt:` the printed displays that print this shape, each with a note saying what the paper
 *   does with it there;
 * - `notUsed:` the reason the papers print no such shape, so that an absence is a judgement rather
 *   than a silence, as `incidental` is in content/lab-explanations.
 *
 * `notQuantities:` declares a letter plain, with its reason, and may be given with either. A
 * lesson's letters are often teaching placeholders (q, a, b), and verify-content rejects a live
 * term that is not an exact canonical quantity id, so binding them would mean inventing quantities
 * and polluting the registry the papers depend on. The declaration is the same field display-terms
 * uses for the same case. A formula block that names equation records is already drawn from those
 * records, coloured by quantity, so declaring its letters plain is refused as a contradiction.
 *
 * Reads content/. `checkLessonFormulas` reads four content directories to judge claims and is for
 * scripts and tests; `lessonFormulaUses` reads one file and judges nothing, and the foundation page
 * calls it where `src/app/about/page.tsx` already reads content, at build time in a static export.
 * This line said "not for a page" of the whole file until 2026-10-12, which left the edge these
 * records exist to carry authored, validated, and shown to nobody.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "./provenance/yaml.ts";

export const LESSON_FORMULAS_DIR = join("content", "lesson-formulas");

export type LessonFormulaCode =
  | "lesson-formula-unknown-lesson"
  | "lesson-formula-unknown-formula"
  | "lesson-formula-no-entry"
  | "lesson-formula-both-used-and-not"
  | "lesson-formula-neither-used-nor-not"
  | "lesson-formula-unknown-display"
  | "lesson-formula-note-missing"
  | "lesson-formula-glyph-not-printed"
  | "lesson-formula-reason-missing"
  | "lesson-formula-already-bound"
  | "lesson-formula-note-cites-unknown-display";

export type LessonFormulaProblem = Readonly<{
  code: LessonFormulaCode;
  lesson: string;
  where: string;
  message: string;
}>;

export type LessonFormulaCensus = Readonly<{
  /** Lessons with a file. */
  lessons: number;
  /** Formula blocks in those lessons: the population that needs a judgement. */
  blocks: number;
  /** Entries that name at least one printed display. */
  used: number;
  /** Edges to printed displays, counted once per naming. */
  edges: number;
  /** Entries whose reason records that no paper prints the shape. */
  notUsed: number;
  /** Entries that declare at least one letter plain. */
  plain: number;
  /** Letters declared plain, with their reasons. */
  plainGlyphs: number;
  /**
   * Display ids CITED IN A NOTE'S PROSE, which nothing checked before 2026-10-13.
   *
   * `display:` is validated against the paper's printed displays; a note that says "see eq-s4-d6"
   * was not, so a note could send a reader to a display no paper prints and ship. Measured when
   * this was added: 17 such citations across the corpus, all of them real, which is the moment to
   * add the guard rather than after the first wrong one.
   */
  noteCitations: number;
}>;

export type LessonFormulas = Readonly<{
  census: LessonFormulaCensus;
  problems: readonly LessonFormulaProblem[];
}>;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown): string => (typeof x === "string" ? x : "");

/** Every formula block of a lesson, in the order the lesson shows them. */
export function lessonFormulaBlocks(root: string, lesson: string): readonly Obj[] {
  const path = join(root, "content", "foundations", `${lesson}.json`);
  if (!existsSync(path)) return [];
  const blocks: Obj[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isObj(node)) return;
    if (node.kind === "formula") blocks.push(node);
    for (const value of Object.values(node)) walk(value);
  };
  walk(JSON.parse(readFileSync(path, "utf8")));
  return blocks;
}

/** One authored edge: a printed display that prints a lesson formula's shape, and what it does. */
export type LessonFormulaEdge = Readonly<{
  paper: string;
  /** The display id, which also names its section: `eq-s5-d6` is in `s5`. */
  display: string;
  /** The section id read off the display id, which the route needs. */
  section: string;
  /** What the paper does with the shape there, authored per edge. */
  note: string;
}>;

/**
 * THE READER-FACING HALF of these records: every edge of one lesson, in the lesson's own order.
 *
 * The docblock above gives the reason these files exist, and it is a reader's reason: "a reader who
 * had just understood a lesson could not find the line in a paper that uses it". Only the checker
 * read them, so the edge was authored, validated and never shown. This is the function a page calls.
 *
 * It JUDGES NOTHING, on purpose. `checkLessonFormulas` owns every rule, including whether a display
 * exists and whether a note is present, and a second implementation of those rules in the rendering
 * path is how two answers to one question begin. Here a record that does not parse simply yields no
 * edge, and the checker is what says so.
 *
 * A display id that does not name its section is DROPPED rather than guessed, because the anchor
 * grammar admits a bare `#eq-<printed number>` and a route invented for one would point at a page
 * that does not carry the anchor. Measured 2026-10-12: all 16 authored edges name a section, and
 * all 16 resolve on their declared paper's reading faces.
 */
export function lessonFormulaUses(root: string, lesson: string): readonly LessonFormulaEdge[] {
  const path = join(root, LESSON_FORMULAS_DIR, `${lesson}.yaml`);
  if (!existsSync(path)) return [];
  const raw = parseYaml(readFileSync(path, "utf8"));
  const entries = isObj(raw) && Array.isArray(raw.formulas) ? raw.formulas : [];
  const edges: LessonFormulaEdge[] = [];
  for (const entry of entries) {
    if (!isObj(entry)) continue;
    for (const use of Array.isArray(entry.usedAt) ? entry.usedAt : []) {
      if (!isObj(use)) continue;
      const paper = text(use.paper);
      const display = text(use.display);
      const section = /^eq-(s\d+)-/u.exec(display)?.[1] ?? "";
      const note = text(use.note);
      if (paper && display && section && note) edges.push({ paper, display, section, note });
    }
  }
  return edges;
}

/** Every display a paper's display-terms file names, so a usedAt cannot point at nothing. */
function displaysOfPapers(root: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const dir = join(root, "content", "display-terms");
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".yaml"))) {
    const paper = file.slice(0, -".yaml".length);
    const raw = parseYaml(readFileSync(join(dir, file), "utf8"));
    const displays = isObj(raw) && Array.isArray(raw.displays) ? raw.displays : [];
    out.set(
      paper,
      new Set(
        displays.flatMap((d) => (isObj(d) && typeof d.display === "string" ? [d.display] : [])),
      ),
    );
  }
  return out;
}

/**
 * Every display id a note's prose names, under both anchor grammars.
 *
 * `#eq-s<n>-d<j>` for an unnumbered display and `#eq-<printed number>` for a numbered one, which
 * docs/CONTENT_IDS.md gives as the two forms. Both appear in the notes already: a reason cites
 * brownian-motion eq-2 and another cites eq-s4-1.
 */
const CITED_DISPLAY = /\beq-s\d+-[a-z0-9]+|\beq-\d+\b/gu;

/**
 * Every claim in content/lesson-formulas/ checked against the tree, and the census that names its
 * denominator: the formula blocks of the lessons covered, so an empty file reads as "6 with no
 * entry" and never as a clean run.
 */
export function checkLessonFormulas(root = process.cwd()): LessonFormulas {
  const problems: LessonFormulaProblem[] = [];
  const counted = {
    lessons: 0,
    blocks: 0,
    used: 0,
    edges: 0,
    notUsed: 0,
    plain: 0,
    plainGlyphs: 0,
    noteCitations: 0,
  };
  const dir = join(root, LESSON_FORMULAS_DIR);
  if (!existsSync(dir)) return { census: { ...counted }, problems };
  const displays = displaysOfPapers(root);
  /*
   * Every printed display of every paper, for the note-prose check below.
   *
   * ANY paper rather than the edge's own, deliberately: a note legitimately cites across papers
   * (a reason for `electromagnetism-charges` names special-relativity displays while its entry has
   * no paper at all), so requiring the edge's paper would refuse correct notes. This catches the
   * thing that is always wrong, an id no paper prints, and declines to guess about the rest.
   */
  const anyDisplay = new Set([...displays.values()].flatMap((set) => [...set]));
  /** Each display id a note names must be one some paper prints. Counted so zero is visible. */
  const citedDisplays = (
    prose: string,
    where: string,
    problem: (code: LessonFormulaCode, where: string, message: string) => void,
  ): void => {
    for (const match of prose.matchAll(CITED_DISPLAY)) {
      counted.noteCitations++;
      const cited = match[0];
      if (!anyDisplay.has(cited))
        problem(
          "lesson-formula-note-cites-unknown-display",
          where,
          `${where}: its note names ${cited}, which no paper prints. A note's citation is read by a reader and was not checked until now.`,
        );
    }
  };

  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()) {
    const raw = parseYaml(readFileSync(join(dir, file), "utf8"));
    const lesson = isObj(raw) ? text(raw.lesson) : "";
    const problem = (code: LessonFormulaCode, where: string, message: string) =>
      problems.push({ code, lesson, where, message });
    const blocks = lessonFormulaBlocks(root, lesson);
    if (blocks.length === 0) {
      problem(
        "lesson-formula-unknown-lesson",
        lesson || file,
        `${file}: names the lesson ${JSON.stringify(lesson)}, which has no formula blocks in content/foundations.`,
      );
      continue;
    }
    counted.lessons++;
    counted.blocks += blocks.length;
    const byLatex = new Map(blocks.map((b) => [text(b.latex), b]));
    const seen = new Set<string>();
    const entries = isObj(raw) && Array.isArray(raw.formulas) ? raw.formulas : [];

    for (const entry of entries) {
      if (!isObj(entry)) continue;
      const latex = text(entry.latex);
      const where = `${lesson} ${JSON.stringify(latex.slice(0, 44))}`;
      const block = byLatex.get(latex);
      if (!block) {
        problem(
          "lesson-formula-unknown-formula",
          where,
          `${where}: no formula block of this lesson has that latex, byte for byte. An entry names the formula it is about exactly as the lesson writes it.`,
        );
        continue;
      }
      seen.add(latex);
      const usedAt = Array.isArray(entry.usedAt) ? entry.usedAt : [];
      const notUsed = text(entry.notUsed);
      if (usedAt.length > 0 && notUsed)
        problem(
          "lesson-formula-both-used-and-not",
          where,
          `${where}: names displays that use the shape and also records that none does.`,
        );
      if (usedAt.length === 0 && !notUsed)
        problem(
          "lesson-formula-neither-used-nor-not",
          where,
          `${where}: names no display and gives no reason for naming none. An absence is a judgement, and is recorded as one.`,
        );
      if (usedAt.length > 0) counted.used++;
      else if (notUsed) counted.notUsed++;
      if (notUsed) citedDisplays(notUsed, where, problem);
      for (const use of usedAt) {
        if (!isObj(use)) continue;
        counted.edges++;
        const paper = text(use.paper);
        const display = text(use.display);
        if (!displays.get(paper)?.has(display))
          problem(
            "lesson-formula-unknown-display",
            where,
            `${where}: names ${paper} ${display}, which is not a printed display of that paper.`,
          );
        citedDisplays(text(use.note), where, problem);
        if (text(use.note).length < 20)
          problem(
            "lesson-formula-note-missing",
            where,
            `${where}: names ${display} with no note saying what the paper does with the shape there.`,
          );
      }
      const notQuantities = Array.isArray(entry.notQuantities) ? entry.notQuantities : [];
      if (notQuantities.length > 0) {
        counted.plain++;
        if (Array.isArray(block.equations) && block.equations.length > 0)
          problem(
            "lesson-formula-already-bound",
            where,
            `${where}: declares letters plain, but the block names equation records, so the reading already draws it from them with its symbols bound.`,
          );
        for (const declared of notQuantities) {
          if (!isObj(declared)) continue;
          counted.plainGlyphs++;
          const glyph = text(declared.glyph);
          if (!text(block.latex).includes(glyph))
            problem(
              "lesson-formula-glyph-not-printed",
              where,
              `${where}: declares ${JSON.stringify(glyph)} plain, which this formula does not print.`,
            );
          if (text(declared.reason).length < 20)
            problem(
              "lesson-formula-reason-missing",
              where,
              `${where}: declares ${JSON.stringify(glyph)} plain with no reason. The reason is the whole content of the declaration.`,
            );
        }
      }
    }
    for (const block of blocks)
      if (!seen.has(text(block.latex)))
        problem(
          "lesson-formula-no-entry",
          lesson,
          `${lesson}: a formula block has no entry: ${JSON.stringify(text(block.latex).slice(0, 44))}.`,
        );
  }
  return { census: { ...counted }, problems };
}
