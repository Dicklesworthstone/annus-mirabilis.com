/**
 * A LESSON'S INLINE FORMULAS IN COLOUR, WHERE THE LESSON MEANS A PAPER'S QUANTITY (dispatch 275).
 *
 * The owner: "I still see a ton of equations that aren't properly using the colored equations with
 * latex system like in classic-patents.com". On the built /foundations/ pages of b16bc66b only the
 * formula blocks that name equation records were coloured.
 *
 * A lesson is a general tool, and a paper's notation read in the lesson's backlink scope resolves
 * letters the lesson does not mean: its x in cosh x resolves to the relativity paper's coordinate.
 * So a lesson's inline formula is coloured only where content/foundations/lesson-colours.yaml lists
 * it under `coloured`: read in one of the lesson's backlinks (a paper and section whose argument
 * passage names the lesson) by the inline resolver (inlineTerms.ts over modernScope.ts), with every
 * binding read against the lesson and recorded (`reads`). If the notation later reads it otherwise,
 * the page refuses by name rather than colour a binding nobody read.
 *
 * Every other formula is drawn in the ink, and the page says why (data-formula-plain):
 * - one listed under `plain`, with its reviewed reason;
 * - one never listed, with a reason read from the notation in the lesson's first backlink: the
 *   letters that paper does not print there, a letter it reads two ways, or that every symbol is an
 *   operator, index or number.
 *
 * The colour is the lessons' own palette (data-paper="foundations"), the one the lesson's equation
 * records use, so a quantity is one colour on its lesson page. A quantity that palette has no slot
 * for is drawn in the ink and says so, rather than marked for a colour that never shows.
 *
 * Server only: the concordances, arguments and the list are read from content/ at build time.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  compileInlineFormula,
  type InlineTermsContext,
  type ResolvedInline,
  resolveInlineTerms,
} from "../../equations/printed/inlineTerms.ts";
import { modernInlineEntries } from "../../equations/printed/modernScope.ts";
import { renderInlineLatex } from "../../equations/render/inlineKatex.ts";
import quantityColours from "../../generated/quantity-colours.json";
import { QUANTITY_LABELS } from "../../generated/quantity-labels.ts";
import { lessonsNamedBy } from "./lessonUses.ts";

/** The palette a lesson page's formulas take (quantity-colours-by-paper.css). */
export const LESSON_PALETTE = "foundations";
export const LESSON_COLOURS_PATH = join("content", "foundations", "lesson-colours.yaml");
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;
const PAPER_NAMES: Readonly<Record<string, string>> = {
  "light-quanta": "light quanta",
  "brownian-motion": "Brownian",
  "special-relativity": "relativity",
  "mass-energy": "mass-energy",
};

export type LessonFormula = Readonly<{
  html: string;
  coloured: boolean;
  /** Why it is drawn in the ink, when it is. */
  plain?: string | undefined;
}>;

export type LessonFormulaCode = "lesson-colours-unreadable" | "lesson-formula-tie-broken";

export class LessonFormulaError extends Error {
  readonly code: LessonFormulaCode;
  constructor(code: LessonFormulaCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "LessonFormulaError";
    this.code = code;
  }
}

type Tie = Readonly<{ paper: string; section: string; reads: string }>;
type Decisions = Readonly<{
  coloured: ReadonlyMap<string, Tie>;
  plain: ReadonlyMap<string, string>;
}>;

const key = (lesson: string, latex: string) => `${lesson}\u0000${latex}`;

/** The reviewed list, each entry checked for its fields. */
export function parseLessonColours(raw: unknown, where: string): Decisions {
  const o = (raw ?? {}) as { coloured?: unknown; plain?: unknown };
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  const text = (v: unknown, field: string, at: string) => {
    if (typeof v !== "string" || v.trim() === "")
      throw new LessonFormulaError(
        "lesson-colours-unreadable",
        `${where} ${at}: ${field} must be a non-empty string.`,
      );
    return v;
  };
  const coloured = new Map<string, Tie>();
  list(o.coloured).forEach((e, i) => {
    const r = (e ?? {}) as Record<string, unknown>;
    const at = `coloured[${i}]`;
    coloured.set(key(text(r.lesson, "lesson", at), text(r.latex, "latex", at)), {
      paper: text(r.paper, "paper", at),
      section: text(r.section, "section", at),
      reads: text(r.reads, "reads", at),
    });
  });
  const plain = new Map<string, string>();
  list(o.plain).forEach((e, i) => {
    const r = (e ?? {}) as Record<string, unknown>;
    const at = `plain[${i}]`;
    plain.set(
      key(text(r.lesson, "lesson", at), text(r.latex, "latex", at)),
      text(r.reason, "reason", at),
    );
  });
  return { coloured, plain };
}

const decisionsByRoot = new Map<string, Decisions>();
function decisions(root: string): Decisions {
  let d = decisionsByRoot.get(root);
  if (!d) {
    const path = join(root, LESSON_COLOURS_PATH);
    d = existsSync(path)
      ? parseLessonColours(parseYaml(readFileSync(path, "utf8")), LESSON_COLOURS_PATH)
      : { coloured: new Map(), plain: new Map() };
    decisionsByRoot.set(root, d);
  }
  return d;
}

const tiesByRoot = new Map<string, ReadonlyMap<string, readonly Omit<Tie, "reads">[]>>();
/** Each lesson's backlinks, in the papers' order: the paper and section of each passage naming it. */
export function lessonTies(root: string): ReadonlyMap<string, readonly Omit<Tie, "reads">[]> {
  let ties = tiesByRoot.get(root);
  if (ties) return ties;
  const out = new Map<string, Omit<Tie, "reads">[]>();
  for (const paper of PAPERS) {
    const paperPath = join(root, "content", "papers", `${paper}.json`);
    if (!existsSync(paperPath)) continue;
    const record = JSON.parse(readFileSync(paperPath, "utf8")) as {
      sections?: { id: string; arguments?: string[] }[];
    };
    const dir = join(root, "content", "arguments", paper);
    const argumentsById = new Map<string, unknown>();
    if (existsSync(dir))
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
        const a = JSON.parse(readFileSync(join(dir, name), "utf8")) as { id?: string };
        if (typeof a.id === "string") argumentsById.set(a.id, a);
      }
    for (const section of record.sections ?? [])
      for (const id of section.arguments ?? []) {
        const argument = argumentsById.get(id);
        if (!argument) continue;
        for (const named of lessonsNamedBy(argument as Parameters<typeof lessonsNamedBy>[0])) {
          const lesson = named.replace(/^foundation:/, "");
          const list = out.get(lesson) ?? [];
          if (!list.some((t) => t.paper === paper && t.section === section.id))
            list.push({ paper, section: section.id });
          out.set(lesson, list);
        }
      }
  }
  ties = out;
  tiesByRoot.set(root, ties);
  return ties;
}

const isRegistered = (quantityId: string) => Object.hasOwn(QUANTITY_LABELS, quantityId);
const hasLessonColour = (quantityId: string) =>
  Boolean(
    (quantityColours.papers as Record<string, Record<string, unknown> | undefined>)[
      LESSON_PALETTE
    ]?.[quantityId],
  );

const contexts = new Map<string, InlineTermsContext>();
function contextFor(root: string, paper: string): InlineTermsContext {
  const k = `${root}\u0000${paper}`;
  let context = contexts.get(k);
  if (!context) {
    context = {
      concordance: modernInlineEntries(
        paper,
        loadConcordanceForPaper(paper, join(root, "content", "notation")),
      ),
      isRegistered,
      exceptions: [],
    };
    contexts.set(k, context);
  }
  return context;
}

function resolveIn(root: string, lesson: string, latex: string, paper: string, section: string) {
  return resolveInlineTerms(
    latex,
    { paper, where: `/foundations/${lesson}/`, anchor: section, section },
    contextFor(root, paper),
  );
}

const readsOf = (resolved: ResolvedInline) =>
  resolved.terms.map((t) => `${t.glyph}=${t.quantityId}`).join(", ");

const sectionLabel = (section: string) =>
  section === "s0" ? "the introduction" : `§ ${section.replace(/^s/, "")}`;

/** Why an unlisted formula is drawn in the ink, read from the notation in the lesson's first backlink. */
function unlistedReason(root: string, lesson: string, latex: string): string {
  const [tie] = lessonTies(root).get(lesson) ?? [];
  if (!tie) return "the lesson names no paper, so its letters are its own";
  const resolved = resolveIn(root, lesson, latex, tie.paper, tie.section);
  const where = `the ${PAPER_NAMES[tie.paper] ?? tie.paper} paper's notation in ${sectionLabel(tie.section)}`;
  const unbound = [
    ...new Set(
      resolved.problems.filter((p) => p.code === "inline-terms-unbound-glyph").map((p) => p.glyph),
    ),
  ];
  const ambiguous = [
    ...new Set(
      resolved.problems
        .filter((p) => p.code === "inline-terms-ambiguous-glyph")
        .map((p) => p.glyph),
    ),
  ];
  if (unbound.length > 0)
    return `the lesson's own letters: ${unbound.join(", ")} ${unbound.length === 1 ? "has" : "have"} no reading in ${where}`;
  if (ambiguous.length > 0)
    return `${ambiguous.join(", ")} ${ambiguous.length === 1 ? "is" : "are"} read two ways in ${where}, so ${ambiguous.length === 1 ? "it takes" : "they take"} no colour`;
  if (resolved.problems.length > 0) return `it cannot be read in ${where}`;
  if (resolved.terms.length === 0) return "every symbol in it is an operator, an index or a number";
  return `not yet read against the lesson: it resolves in ${where}, which is not the same as the lesson meaning it`;
}

/** A lesson's inline formula: coloured where its reviewed tie holds, otherwise in the ink with why. */
export function lessonInlineFormula(
  lesson: string,
  latex: string,
  root: string = process.cwd(),
): LessonFormula {
  const plain = renderInlineLatex(latex);
  const { coloured, plain: listed } = decisions(root);
  const tie = coloured.get(key(lesson, latex));
  if (tie) {
    const resolved = resolveIn(root, lesson, latex, tie.paper, tie.section);
    if (resolved.problems.length > 0 || readsOf(resolved) !== tie.reads)
      throw new LessonFormulaError(
        "lesson-formula-tie-broken",
        `/foundations/${lesson}/: ${JSON.stringify(latex)} was read in ${tie.paper} ${tie.section} as "${tie.reads}", and now reads "${readsOf(resolved)}"${resolved.problems.length > 0 ? ` with ${resolved.problems.map((p) => p.message).join("; ")}` : ""}. Read it again against the lesson (${LESSON_COLOURS_PATH}).`,
      );
    // An unregistered quantity is refused by the resolver itself (isRegistered, above), so it
    // surfaces here as a broken tie.
    const noSlot = [...new Set(resolved.terms.map((t) => t.quantityId))].filter(
      (q) => !hasLessonColour(q),
    );
    if (noSlot.length > 0)
      return {
        html: plain,
        coloured: false,
        plain: `the lessons' palette has no colour yet for ${noSlot.join(", ")}`,
      };
    return { html: compileInlineFormula(resolved).html, coloured: true };
  }
  const reason = listed.get(key(lesson, latex));
  if (reason) return { html: plain, coloured: false, plain: reason };
  return { html: plain, coloured: false, plain: unlistedReason(root, lesson, latex) };
}

/**
 * The reviewed coloured formulas, as the palette's inline views want them (scripts/build-equations.ts
 * feeds a paper's inline formulas to its colour search, so a quantity only they name gets a slot).
 */
export function lessonInlineFormulas(root: string = process.cwd()): readonly Readonly<{
  lesson: string;
  latex: string;
  terms: readonly { quantityId: string }[];
}>[] {
  return [...decisions(root).coloured].map(([k, tie]) => {
    const [lesson = "", latex = ""] = k.split("\u0000");
    const resolved = resolveIn(root, lesson, latex, tie.paper, tie.section);
    return { lesson, latex, terms: resolved.terms.map((t) => ({ quantityId: t.quantityId })) };
  });
}
