/**
 * AN EXPLANATION FOR EVERY PRINTED DISPLAY (dispatch 278). The owner, 2026-09-26: "all the equations
 * must be colored, and all must have the nice hover-over effects and they must have multiple options
 * for explaining in more detail (including in words) what the equation means."
 *
 * THE RECORD, one file per display: content/equation-explanations/<paper>/<display id>.yaml
 *   display  the printed display's id, as content/display-terms/<paper>.yaml names it (eq-s3-d4);
 *   paper    the paper's slug, which is also the record's directory;
 *   inWords  the equation read as an English sentence: a list of { text, quantityId? }. A phrase that
 *            names a quantity carries its id, and the set of ids is EXACTLY the set the display's
 *            terms bind, so the words and the colours agree;
 *   r0       Overview: one or two sentences, true at their resolution;
 *   r1       Full explanation, as prose;
 *   r2       Every step: a list of { latex, why }, each formula with the reason for it in words;
 *   r3       Historian's margin, optional, cited.
 * Prose may carry inline mathematics as $…$, in the paper's printed notation.
 *
 * THE CHECK. Every formula, in the prose and in the steps, is resolved in the display's own scope
 * (the paragraph and section it is printed in, displayOccurrences) by the inline resolver, and
 * compiled in colour as the faces' inline formulas are. Its readings, first to last:
 *   - the display's own: each glyph its terms bind, and each sign it declares no quantity
 *     (content/display-terms/<paper>.yaml), so A_1 in the explanation of dW = f(A_1 …) … is what
 *     the display says it is, and the words, the steps and the colours agree;
 *   - the printed concordance plus the modern readings (modernScope.ts);
 *   - the listed signs (content/inline-terms/exceptions.yaml).
 * A glyph that names nothing refuses the record by name. The prose passes the shared voice check
 * (checkVoice). A record's problems are returned, never thrown; assertExplanationsPublishable is the
 * one place the build stops.
 *
 * THE CENSUS counts, per paper, its printed displays, the displays explained, the records refused
 * and the displays with none. In a paper in ENFORCED_EXPLANATION_PAPERS any problem stops the build:
 * a refused record, or a display with no record. In any other paper both are reported by name and a
 * refused record is left out of the pages, so the authors fill the paper in while HEAD stays green;
 * scripts/check-equation-explanations.ts gives an author the strict verdict for one paper.
 *
 * Reads content/, so it is for scripts and tests; the pages read the compiled payload
 * (printedExplanations.ts).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { findInlineMathRegions } from "../../content/editions/segmentSentences.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { type DisplayTermsEntry, displayOccurrences, loadDisplayTerms } from "./displayTerms.ts";
import { inlineLabelId, signSource } from "./inlineLabels.ts";
import {
  compileInlineFormula,
  type InlineTermsContext,
  resolveInlineTerms,
} from "./inlineTerms.ts";
import { modernInlineEntries } from "./modernScope.ts";
import { type InlineQuantityUse, loadInlineExceptions } from "./paperInlines.ts";

export const EQUATION_EXPLANATIONS_DIR = join("content", "equation-explanations");

/**
 * Papers whose every printed display has its explanation: a display with no record stops the build.
 * A paper joins when its authors have written them all.
 */
export const ENFORCED_EXPLANATION_PAPERS: readonly string[] = ["mass-energy"];

export type ExplanationCode =
  | "explanation-unreadable"
  | "explanation-misfiled"
  | "explanation-unknown-display"
  | "explanation-missing-level"
  | "explanation-words-missing-quantity"
  | "explanation-words-extra-quantity"
  | "explanation-formula-refused"
  | "explanation-voice"
  | "explanation-missing";

export type ExplanationProblem = Readonly<{
  code: ExplanationCode;
  paper: string;
  display: string;
  message: string;
}>;

/** A phrase of the equation in words; a phrase that names a quantity carries its id. */
export type WordsPhrase = Readonly<{ text: string; quantityId?: string | undefined }>;

/**
 * A piece of compiled prose: words, or a formula already drawn. A formula says whether it binds a
 * quantity to colour, and whether it prints a name the notation declares no quantity (dispatch 280),
 * so the panel marks its span as the reading faces mark theirs and the page's island lights both.
 */
export type ProsePart =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{
      kind: "math";
      html: string;
      coloured?: boolean | undefined;
      labelled?: boolean | undefined;
    }>;

export type CompiledStep = Readonly<{
  formula: string;
  /** As a prose formula says it (ProsePart): what the step's own formula binds and names. */
  coloured?: boolean | undefined;
  labelled?: boolean | undefined;
  why: readonly ProsePart[];
}>;

export type CompiledExplanation = Readonly<{
  paper: string;
  display: string;
  inWords: readonly WordsPhrase[];
  r0: readonly ProsePart[];
  r1: readonly ProsePart[];
  r2: readonly CompiledStep[];
  r3?: readonly ProsePart[] | undefined;
}>;

export type ExplanationCensus = Readonly<{
  /** The paper's printed displays, as its display-terms file names them. */
  displays: number;
  /** Displays with a record that passed every check. */
  explained: number;
  /** Records refused. */
  refused: number;
  /** Displays with no record at all. */
  missing: number;
}>;

export type PaperExplanations = Readonly<{
  paper: string;
  explanations: readonly CompiledExplanation[];
  /** Displays with no record, by id. */
  missing: readonly string[];
  problems: readonly ExplanationProblem[];
  /** Each quantity a formula of the records binds, for the colour slots and the inspector's facts. */
  quantities: Readonly<Record<string, InlineQuantityUse>>;
  /** Every formula the records draw, with the quantities it binds (the colour slots' views). */
  formulas: readonly Readonly<{
    latex: string;
    terms: readonly Readonly<{ quantityId: string; glyph: string }>[];
  }>[];
  census: ExplanationCensus;
}>;

/** One record's file, read or planted: its name in its paper's directory, and its parsed content. */
export type ExplanationSource = Readonly<{ file: string; raw: unknown }>;

/** The record files of a paper, parsed; a file that does not parse is kept, as a refusal to come. */
export function loadExplanationSources(root: string, paper: string): ExplanationSource[] {
  const dir = join(root, EQUATION_EXPLANATIONS_DIR, paper);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const path = join(EQUATION_EXPLANATIONS_DIR, paper, file);
      try {
        return { file, raw: strictParse(readFileSync(join(root, path), "utf8"), "yaml", path) };
      } catch (error) {
        return {
          file,
          raw: { unreadable: String(error instanceof Error ? error.message : error) },
        };
      }
    });
}

const KATEX_DISPLAY = ((tex: string, options: object) =>
  renderToString(tex, { ...options, displayMode: true })) as typeof renderToString;

type Scope = Readonly<{ anchor: string; section: string }>;

type ExplanationRecord = Readonly<{
  display: string;
  inWords: readonly WordsPhrase[];
  r0: string;
  r1: string;
  r2: readonly Readonly<{ latex: string; why: string }>[];
  r3?: string | undefined;
}>;

/**
 * The display's own readings, as concordance entries scoped to the paragraph it is printed in, the
 * resolver's local tier: each glyph its terms bind, and each sign it or its file declares no
 * quantity. They are read only for this display's explanation.
 */
function displayReadings(
  entry: DisplayTermsEntry,
  fileSigns: readonly Readonly<{ glyph: string }>[],
  anchor: string,
): ConcordanceEntry[] {
  const reading = (glyph: string, binding: object, id: string) =>
    ({
      id,
      scope: [anchor],
      glyph: { unicode: glyph, latex: glyph, variant: "plain" },
      binding,
    }) as unknown as ConcordanceEntry;
  const bound = new Set(entry.terms.map((t) => t.glyph));
  return [
    ...[...new Map(entry.terms.map((t) => [t.glyph, t.quantityId]))].map(([glyph, quantityId], n) =>
      reading(glyph, { quantityId }, `display-terms ${entry.display} ${n}`),
    ),
    // A sign is named by its glyph, not by the display it was declared under, so the same sign in
    // two displays of one section is one name the page lights together and says one thing about
    // (inlineLabels.ts, dispatch 280).
    ...[...entry.notQuantities, ...fileSigns]
      .filter((sign) => !bound.has(sign.glyph))
      .map((sign) => reading(sign.glyph, { nonQuantityKind: "operator" }, signSource(sign.glyph))),
  ];
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/** A record's fields, each checked for presence and shape. */
function readRecord(
  source: ExplanationSource,
  paper: string,
  problem: (code: ExplanationCode, display: string, message: string) => void,
): ExplanationRecord | undefined {
  const where = `${EQUATION_EXPLANATIONS_DIR}/${paper}/${source.file}`;
  const o = source.raw as { [key: string]: unknown } | null;
  if (typeof o !== "object" || o === null || Array.isArray(o) || "unreadable" in o) {
    problem(
      "explanation-unreadable",
      source.file,
      `${where}: not a record${o && typeof o === "object" && "unreadable" in o ? ` (${String(o.unreadable)})` : ""}.`,
    );
    return undefined;
  }
  const display = text(o.display) ?? "";
  if (!display || `${display}.yaml` !== source.file || o.paper !== paper) {
    problem(
      "explanation-misfiled",
      display || source.file,
      `${where}: a record is filed as <paper>/<display>.yaml and names both; this one names display ${JSON.stringify(o.display)} and paper ${JSON.stringify(o.paper)}.`,
    );
    return undefined;
  }
  const missing: string[] = [];
  const inWords = Array.isArray(o.inWords)
    ? o.inWords.flatMap((p): WordsPhrase[] => {
        const phrase = (p ?? {}) as { text?: unknown; quantityId?: unknown };
        if (typeof phrase.text !== "string" || phrase.text === "") return [];
        return [
          typeof phrase.quantityId === "string"
            ? { text: phrase.text, quantityId: phrase.quantityId }
            : { text: phrase.text },
        ];
      })
    : [];
  if (!Array.isArray(o.inWords) || inWords.length === 0 || inWords.length !== o.inWords.length)
    missing.push("inWords (a list of phrases, each with its text)");
  const r0 = text(o.r0);
  const r1 = text(o.r1);
  if (!r0) missing.push("r0");
  if (!r1) missing.push("r1");
  const r2 = Array.isArray(o.r2)
    ? o.r2.flatMap((s) => {
        const step = (s ?? {}) as { latex?: unknown; why?: unknown };
        const latex = text(step.latex);
        const why = text(step.why);
        return latex && why ? [{ latex, why }] : [];
      })
    : [];
  if (!Array.isArray(o.r2) || r2.length === 0 || r2.length !== o.r2.length)
    missing.push("r2 (a list of steps, each with its latex and why)");
  if (o.r3 !== undefined && !text(o.r3)) missing.push("r3 (when given, prose)");
  if (missing.length > 0 || !r0 || !r1) {
    problem(
      "explanation-missing-level",
      display,
      `${where}: ${missing.join(", ")} missing or malformed.`,
    );
    return undefined;
  }
  const r3 = text(o.r3);
  return { display, inWords, r0, r1, r2, ...(r3 ? { r3 } : {}) };
}

/** One paper's records, checked against its displays and compiled. */
export async function checkPaperExplanations(
  root: string,
  paper: string,
  overrides: Readonly<{
    sources?: readonly ExplanationSource[];
    /** The enforced papers; by default ENFORCED_EXPLANATION_PAPERS. */
    enforced?: readonly string[];
  }> = {},
): Promise<PaperExplanations> {
  const terms = loadDisplayTerms(root, paper);
  const edition = await loadBilingualEdition(paper, root);
  const occurrences = displayOccurrences(edition?.blocks ?? [], edition?.units ?? []);
  const entries = new Map((terms?.displays ?? []).map((d) => [d.display, d]));
  const bound = new Map(
    [...entries].map(([display, d]) => [display, new Set(d.terms.map((t) => t.quantityId))]),
  );
  const concordance = modernInlineEntries(paper, loadConcordanceForPaper(paper));
  const exceptions = loadInlineExceptions(root);
  const problems: ExplanationProblem[] = [];
  const explanations: CompiledExplanation[] = [];
  const quantities: { [id: string]: { glyphs: string[]; scope: Scope } } = {};
  const formulas: { latex: string; terms: { quantityId: string; glyph: string }[] }[] = [];
  const seen = new Set<string>();
  const sources = overrides.sources ?? loadExplanationSources(root, paper);

  for (const source of sources) {
    const before = problems.length;
    const problem = (code: ExplanationCode, display: string, message: string) =>
      problems.push({ code, paper, display, message });
    const record = readRecord(source, paper, problem);
    if (!record) continue;
    const { display } = record;
    seen.add(display);
    const want = bound.get(display);
    if (!want) {
      problem(
        "explanation-unknown-display",
        display,
        `${paper} ${display}: no printed display has this id in content/display-terms/${paper}.yaml.`,
      );
      continue;
    }
    const named = new Set(record.inWords.flatMap((p) => (p.quantityId ? [p.quantityId] : [])));
    const absent = [...want].filter((q) => !named.has(q));
    const extra = [...named].filter((q) => !want.has(q));
    if (absent.length > 0)
      problem(
        "explanation-words-missing-quantity",
        display,
        `${paper} ${display}: inWords names no phrase for ${absent.join(", ")}, which the display's terms bind.`,
      );
    if (extra.length > 0)
      problem(
        "explanation-words-extra-quantity",
        display,
        `${paper} ${display}: inWords names ${extra.join(", ")}, which no term of the display binds.`,
      );

    const scope: Scope = occurrences.get(display)?.[0] ?? { anchor: display, section: "" };
    const context: InlineTermsContext = {
      concordance: [
        ...displayReadings(
          entries.get(display) as DisplayTermsEntry,
          terms?.notQuantities ?? [],
          scope.anchor,
        ),
        ...concordance,
      ],
      isRegistered: isRegisteredQuantityId,
      exceptions,
    };
    const draw = (
      latex: string,
      where: string,
      displayMode: boolean,
    ): Readonly<{ html: string; coloured: boolean; labelled: boolean }> | undefined => {
      const read = resolveInlineTerms(
        latex,
        { paper, where: `${display} ${where}`, anchor: scope.anchor, section: scope.section },
        context,
      );
      // Its names take the ids the reading faces give them, so a k in a panel lights with the k in
      // the paragraph it explains (inlineLabels.ts, dispatch 280).
      const resolved = {
        ...read,
        labels: read.labels.map((l) => ({ ...l, labelId: inlineLabelId(l.source, scope.section) })),
      };
      if (resolved.problems.length > 0) {
        problem(
          "explanation-formula-refused",
          display,
          resolved.problems.map((p) => p.message).join("\n"),
        );
        return undefined;
      }
      let html: string;
      let labelled = false;
      try {
        const compiled = compileInlineFormula(
          resolved,
          displayMode ? KATEX_DISPLAY : renderToString,
        );
        html = compiled.html;
        labelled = (compiled.labels?.length ?? 0) > 0;
        // A step is laid out in display style, but it is not one of the paper's printed displays:
        // it keeps KaTeX's display layout and MathML and loses the katex-display wrapper, which the
        // faces count as the displays the paper prints (GermanDraftFace.test.tsx).
        if (displayMode)
          html = html.replace(/^<span class="katex-display">([\s\S]*)<\/span>$/, "$1");
      } catch (error) {
        problem(
          "explanation-formula-refused",
          display,
          `${paper} ${display} ${where}: ${JSON.stringify(latex)} does not compile (${error instanceof Error ? error.message : String(error)}).`,
        );
        return undefined;
      }
      if (html.includes("katex-error")) {
        problem(
          "explanation-formula-refused",
          display,
          `${paper} ${display} ${where}: ${JSON.stringify(latex)} does not typeset.`,
        );
        return undefined;
      }
      formulas.push({
        latex,
        terms: resolved.terms.map(({ quantityId, glyph }) => ({ quantityId, glyph })),
      });
      for (const { quantityId, glyph } of resolved.terms) {
        const use = quantities[quantityId];
        if (!use) quantities[quantityId] = { glyphs: [glyph], scope };
        else if (!use.glyphs.includes(glyph)) use.glyphs.push(glyph);
      }
      return { html, coloured: resolved.terms.length > 0, labelled };
    };
    const prose = (value: string, where: string): ProsePart[] => {
      const parts: ProsePart[] = [];
      let cursor = 0;
      let words = "";
      for (const region of findInlineMathRegions(value)) {
        if (region.start > cursor) {
          parts.push({ kind: "text", text: value.slice(cursor, region.start) });
          words += value.slice(cursor, region.start);
        }
        words += " ";
        const drawn = draw(region.latex, where, false);
        if (drawn !== undefined)
          parts.push({
            kind: "math",
            html: drawn.html,
            ...(drawn.coloured ? { coloured: true } : {}),
            ...(drawn.labelled ? { labelled: true } : {}),
          });
        cursor = region.end;
      }
      if (cursor < value.length) {
        parts.push({ kind: "text", text: value.slice(cursor) });
        words += value.slice(cursor);
      }
      for (const finding of checkVoice(words, { context: "prose" }))
        if (finding.severity === "error")
          problem(
            "explanation-voice",
            display,
            `${paper} ${display} ${where}: "${finding.matchedText}" (${finding.rule}). ${finding.suggestion}`,
          );
      return parts;
    };

    prose(record.inWords.map((p) => p.text).join(""), "inWords");
    const r0 = prose(record.r0, "r0");
    const r1 = prose(record.r1, "r1");
    const r2 = record.r2.map((step, i) => {
      const drawn = draw(step.latex, `r2 step ${i + 1}`, true);
      return {
        formula: drawn?.html ?? "",
        ...(drawn?.coloured ? { coloured: true } : {}),
        ...(drawn?.labelled ? { labelled: true } : {}),
        why: prose(step.why, `r2 step ${i + 1}`),
      };
    });
    const r3 = record.r3 === undefined ? undefined : prose(record.r3, "r3");
    if (problems.length === before)
      explanations.push({
        paper,
        display,
        inWords: record.inWords,
        r0,
        r1,
        r2,
        ...(r3 ? { r3 } : {}),
      });
  }

  const missing = [...bound.keys()].filter((display) => !seen.has(display));
  if ((overrides.enforced ?? ENFORCED_EXPLANATION_PAPERS).includes(paper))
    for (const display of missing)
      problems.push({
        code: "explanation-missing",
        paper,
        display,
        message: `${paper} ${display}: a printed display with no explanation (${EQUATION_EXPLANATIONS_DIR}/${paper}/${display}.yaml).`,
      });
  const refused = new Set(
    problems.filter((p) => p.code !== "explanation-missing").map((p) => p.display),
  );
  return {
    paper,
    explanations,
    missing,
    problems,
    quantities,
    formulas,
    census: {
      displays: bound.size,
      explained: explanations.length,
      refused: refused.size,
      missing: missing.length,
    },
  };
}

export class EquationExplanationsError extends Error {
  readonly code: "equation-explanations-refused";
  constructor(code: "equation-explanations-refused", message: string) {
    super(`${code}: ${message}`);
    this.name = "EquationExplanationsError";
    this.code = code;
  }
}

/**
 * Stops the build on any problem in an enforced paper, naming each one: a refused record, or a
 * display with no record. Another paper's problems are the census's to report.
 */
export function assertExplanationsPublishable(
  papers: readonly PaperExplanations[],
  enforced: readonly string[] = ENFORCED_EXPLANATION_PAPERS,
): void {
  const problems = papers.filter((p) => enforced.includes(p.paper)).flatMap((p) => p.problems);
  if (problems.length > 0)
    throw new EquationExplanationsError(
      "equation-explanations-refused",
      `Equation explanations are refused (${EQUATION_EXPLANATIONS_DIR}/):\n${problems
        .map((p) => `  ${p.code}: ${p.message}`)
        .join("\n")}`,
    );
}
