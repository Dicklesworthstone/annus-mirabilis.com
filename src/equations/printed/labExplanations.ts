/**
 * "EXPLAIN THIS EQUATION" ON A LABORATORY'S FORMULA (dispatch 291). The owner, 2026-09-26: "all the
 * equations must be colored, and all must have the nice hover-over effects and they must have
 * multiple options for explaining in more detail (including in words) what the equation means".
 * Dispatch 274 gave the labs the colour and the hover; this gives them the words.
 *
 * THE POPULATION IS EVERY DISPLAYED FORMULA of every lab page (LabFormula, read from the pages'
 * source by labFormulaSites.ts). A formula a lab sets apart as its own block is a claim about the
 * physics and gets the control; a formula inside a sentence does not, because the sentence around it
 * is already its explanation and a panel there would say the same thing twice. An inline formula may
 * still be given an entry where it is one of the paper's printed displays quoted mid-sentence, and
 * the record names it by its latex like any other.
 *
 * EACH ENTRY IS ONE OF THREE THINGS, and there is no fourth:
 *
 * - `display:` THE PAPER'S RECORD. The lab's formula is one of the paper's printed displays, so the
 *   reader meets the same words in both places and the two can never disagree. All five levels come
 *   from content/equation-explanations/, and a phrase naming a quantity this lab's formula does not
 *   bind keeps its words and loses its binding, so that pointing at it never lights nothing
 *   (modelExplanations.ts does the same for a model equation on an explanation page).
 * - `own:` THE LAB'S OWN WORDS, for a form the paper does not print. Same record shape as a printed
 *   display's, compiled in the lab's own scope so its formulas carry the lab's colours.
 * - `incidental:` A RECORDED REASON for giving it no control, usually that the sentence carrying it
 *   already explains it or that it evaluates a law explained above it. The reason is kept so that
 *   the judgement is auditable rather than a silence.
 *
 * A displayed site with no entry at all is reported by name and counted as missing. Zero entries
 * would therefore read as 89 missing, not as a clean run.
 *
 * THE PROSE LOOP IS A MIRROR of the one in equationExplanations.ts, with labFormula as its drawer so
 * that a formula inside an explanation is read in the lab's scope, with the lab's own letters, as
 * the formula it explains is. The two loops must move together: a change to how `$...$` is found,
 * compiled or voice-checked belongs in both. Extracting them into one helper waits on a third use,
 * which is this repository's rule for a shared abstraction.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { findInlineMathRegions } from "../../content/editions/segmentSentences.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import type {
  CompiledExplanation,
  CompiledStep,
  ExplainerLevels,
  ProsePart,
  WordsPhrase,
} from "./equationExplanations.ts";
import { labFormulaSites } from "./labFormulaSites.ts";
import { labFormula, labScope } from "./labInlines.ts";
import { printedExplanation } from "./printedExplanations.ts";

export const LAB_EXPLANATIONS_DIR = join("content", "lab-explanations");

export type LabExplanationCode =
  | "lab-explanation-unreadable"
  | "lab-explanation-misfiled"
  | "lab-explanation-unknown-formula"
  | "lab-explanation-duplicate-formula"
  | "lab-explanation-kind"
  | "lab-explanation-missing-display-record"
  | "lab-explanation-missing-level"
  | "lab-explanation-words-extra-quantity"
  | "lab-explanation-formula-refused"
  | "lab-explanation-voice";

export type LabExplanationProblem = Readonly<{
  code: LabExplanationCode;
  lab: string;
  where: string;
  message: string;
}>;

export type LabExplanationCensus = Readonly<{
  /** Displayed formulas on the lab pages: the population that needs an entry. */
  displayed: number;
  /** Displayed formulas that now carry a control. */
  explained: number;
  /** Of those, the ones whose words are a paper's printed display record. */
  reused: number;
  /** Of those, the ones with the lab's own words. */
  own: number;
  /** Displayed formulas judged incidental, with the reason recorded. */
  incidental: number;
  /** Displayed formulas with no entry at all. */
  missing: number;
  /** Inline formulas given an entry, which no rule requires. */
  inlineExplained: number;
}>;

export type LabExplanations = Readonly<{
  /** lab -> latex, exactly as the page writes it -> the explainer to draw under it. */
  explainers: ReadonlyMap<string, ReadonlyMap<string, ExplainerLevels>>;
  census: LabExplanationCensus;
  problems: readonly LabExplanationProblem[];
  /** Displayed sites with no entry, named `<lab> <latex>`. */
  missing: readonly string[];
}>;

type Entry = Readonly<{
  latex: string;
  display?: string;
  paper?: string;
  incidental?: string;
  own?: { [key: string]: unknown };
}>;

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/** The entries of one lab's file, or a problem naming what is wrong with it. */
function readEntries(
  lab: string,
  raw: unknown,
  problem: (code: LabExplanationCode, where: string, message: string) => void,
): Entry[] {
  const file = join(LAB_EXPLANATIONS_DIR, `${lab}.yaml`);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    problem("lab-explanation-unreadable", file, `${file}: not a record.`);
    return [];
  }
  const record = raw as { [key: string]: unknown };
  if (record.lab !== lab) {
    problem(
      "lab-explanation-misfiled",
      file,
      `${file}: a lab's entries are filed as <lab>.yaml and name it; this one names ${JSON.stringify(record.lab)}.`,
    );
    return [];
  }
  if (!Array.isArray(record.formulas)) {
    problem("lab-explanation-unreadable", file, `${file}: formulas is a list of entries.`);
    return [];
  }
  return record.formulas.flatMap((value): Entry[] => {
    const entry = (value ?? {}) as Entry;
    const latex = text(entry.latex);
    if (!latex) {
      problem("lab-explanation-unreadable", file, `${file}: an entry has no latex.`);
      return [];
    }
    return [{ ...entry, latex }];
  });
}

/** Every lab that has a file, in directory order. */
export function labsWithExplanations(root = process.cwd()): string[] {
  const dir = join(root, LAB_EXPLANATIONS_DIR);
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".yaml"))
        .sort()
        .map((name) => name.slice(0, -".yaml".length))
    : [];
}

/** One lab's file as the checker reads it: the lab, and whatever its YAML parsed to. */
export type LabExplanationSource = Readonly<{ lab: string; raw: unknown }>;

/** Every lab file on disk, parsed, in directory order. */
export function loadLabExplanationSources(root = process.cwd()): LabExplanationSource[] {
  return labsWithExplanations(root).map((lab) => ({
    lab,
    raw: strictParse(
      readFileSync(join(root, LAB_EXPLANATIONS_DIR, `${lab}.yaml`), "utf8"),
      "yaml",
      join(LAB_EXPLANATIONS_DIR, `${lab}.yaml`),
    ),
  }));
}

/**
 * Every lab's entries, checked against the formulas its page actually draws, with each explainer
 * compiled ready for the renderer. `sources` replaces what is on disk, so a test can plant a record
 * without writing a file into a checkout several other agents are editing (checkPaperExplanations
 * takes its sources the same way).
 *
 * `displayRecord` is how a reused record is found. It defaults to the generated payload, which is
 * what the author's check and the tests read; the build passes the records it has just compiled in
 * the same process instead, because the payload on disk is still the previous run's at that moment
 * and a lab would otherwise reuse a record that no longer exists.
 */
export function checkLabExplanations(
  root = process.cwd(),
  overrides: Readonly<{
    sources?: readonly LabExplanationSource[];
    displayRecord?: (
      paper: string | undefined,
      display: string | undefined,
    ) => CompiledExplanation | undefined;
  }> = {},
): LabExplanations {
  const displayRecord = overrides.displayRecord ?? printedExplanation;
  const problems: LabExplanationProblem[] = [];
  const sites = labFormulaSites(root);
  const explainers = new Map<string, Map<string, ExplainerLevels>>();
  /** Every formula an entry names, of whatever kind, so a missing one is one nobody judged. */
  const judged = new Map<string, Set<string>>();
  const counted = { explained: 0, reused: 0, own: 0, incidental: 0, inlineExplained: 0 };

  const displayedOf = new Map<string, Set<string>>();
  const inlineOf = new Map<string, Set<string>>();
  for (const site of sites) {
    const into = site.display ? displayedOf : inlineOf;
    const set = into.get(site.lab) ?? new Set<string>();
    set.add(site.latex);
    into.set(site.lab, set);
  }

  for (const { lab, raw } of overrides.sources ?? loadLabExplanationSources(root)) {
    const problem = (code: LabExplanationCode, where: string, message: string) =>
      problems.push({ code, lab, where, message });
    const entries = readEntries(lab, raw, problem);
    const scope = labScope(lab, root);
    const drawnFor = new Map<string, ExplainerLevels>();
    const seen = new Set<string>();
    const displayed = displayedOf.get(lab) ?? new Set<string>();
    const inline = inlineOf.get(lab) ?? new Set<string>();

    for (const entry of entries) {
      const { latex } = entry;
      const where = `${lab} ${JSON.stringify(latex.slice(0, 48))}`;
      const isDisplayed = displayed.has(latex);
      if (!isDisplayed && !inline.has(latex)) {
        problem(
          "lab-explanation-unknown-formula",
          where,
          `${where}: no formula on the lab's page has this latex, byte for byte. An entry names the formula it explains exactly as the page writes it.`,
        );
        continue;
      }
      if (seen.has(latex)) {
        problem(
          "lab-explanation-duplicate-formula",
          where,
          `${where}: two entries name the same formula.`,
        );
        continue;
      }
      seen.add(latex);
      judged.set(lab, (judged.get(lab) ?? new Set<string>()).add(latex));

      const kinds = [
        entry.display === undefined ? undefined : "display",
        entry.own === undefined ? undefined : "own",
        entry.incidental === undefined ? undefined : "incidental",
      ].filter((kind) => kind !== undefined);
      if (kinds.length !== 1) {
        problem(
          "lab-explanation-kind",
          where,
          `${where}: an entry is exactly one of display, own or incidental; this one names ${kinds.length === 0 ? "none" : kinds.join(" and ")}.`,
        );
        continue;
      }

      if (entry.incidental !== undefined) {
        if (!text(entry.incidental))
          problem(
            "lab-explanation-kind",
            where,
            `${where}: incidental carries the reason for giving this formula no control.`,
          );
        else counted.incidental++;
        continue;
      }

      const bound = new Set(
        (() => {
          const drawn = labFormula(lab, latex, isDisplayed, false);
          return drawn.kind === "resolved" ? drawn.compiled.terms.map((t) => t.quantityId) : [];
        })(),
      );

      if (entry.display !== undefined) {
        const paper = entry.paper ?? scope?.paper;
        const record = displayRecord(paper, entry.display);
        if (!record) {
          problem(
            "lab-explanation-missing-display-record",
            where,
            `${where}: ${paper ?? "(no paper)"} ${entry.display} has no explanation record to reuse.`,
          );
          continue;
        }
        drawnFor.set(latex, forLabFormula(record, bound));
        counted.reused++;
        if (isDisplayed) counted.explained++;
        else counted.inlineExplained++;
        continue;
      }

      const explainer = compileOwn(
        entry.own as { [key: string]: unknown },
        lab,
        bound,
        scope?.paper ?? lab,
        where,
        problem,
      );
      if (!explainer) continue;
      drawnFor.set(latex, explainer);
      counted.own++;
      if (isDisplayed) counted.explained++;
      else counted.inlineExplained++;
    }
    explainers.set(lab, drawnFor);
  }

  const missing: string[] = [];
  for (const [lab, set] of displayedOf)
    for (const latex of set)
      if (!judged.get(lab)?.has(latex)) missing.push(`${lab} ${latex.slice(0, 48)}`);
  missing.sort();

  return {
    explainers,
    census: {
      displayed: sites.filter((site) => site.display).length,
      explained: counted.explained,
      reused: counted.reused,
      own: counted.own,
      incidental: counted.incidental,
      missing: missing.length,
      inlineExplained: counted.inlineExplained,
    },
    problems,
    missing,
  };
}

/**
 * A printed display's record as this lab's formula can carry it: the same words, with a phrase
 * dropping its binding where the lab's formula does not bind that quantity.
 */
function forLabFormula(record: CompiledExplanation, bound: ReadonlySet<string>): ExplainerLevels {
  return {
    ...record,
    inWords: record.inWords.map((phrase) =>
      phrase.quantityId && bound.has(phrase.quantityId) ? phrase : { text: phrase.text },
    ),
  };
}

/** The lab's own record, compiled in the lab's scope. */
function compileOwn(
  own: { [key: string]: unknown },
  lab: string,
  bound: ReadonlySet<string>,
  paper: string,
  where: string,
  report: (code: LabExplanationCode, where: string, message: string) => void,
): ExplainerLevels | undefined {
  // A record whose prose or whose steps were refused is not drawn at all, rather than drawn with
  // the refused part missing, so every refusal this record makes is counted here.
  let refusals = 0;
  const problem = (code: LabExplanationCode, at: string, message: string) => {
    refusals++;
    report(code, at, message);
  };
  const draw = (
    latex: string,
    field: string,
    displayMode: boolean,
  ): Readonly<{ html: string; coloured: boolean }> | undefined => {
    const drawn = labFormula(lab, latex, displayMode, false);
    if (drawn.kind !== "resolved") {
      problem(
        "lab-explanation-formula-refused",
        where,
        `${where} ${field}: ${JSON.stringify(latex)} ${
          drawn.kind === "unscoped"
            ? "cannot be read: the lab names no paper and sections."
            : `is refused: ${drawn.problems.map((p) => p.message).join("; ")}`
        }`,
      );
      return undefined;
    }
    return { html: drawn.compiled.html, coloured: drawn.compiled.terms.length > 0 };
  };

  const prose = (value: string, field: string): ProsePart[] => {
    const parts: ProsePart[] = [];
    let cursor = 0;
    let words = "";
    for (const region of findInlineMathRegions(value)) {
      if (region.start > cursor) {
        parts.push({ kind: "text", text: value.slice(cursor, region.start) });
        words += value.slice(cursor, region.start);
      }
      words += " ";
      const drawn = draw(region.latex, field, false);
      if (drawn !== undefined)
        parts.push({
          kind: "math",
          html: drawn.html,
          ...(drawn.coloured ? { coloured: true } : {}),
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
          "lab-explanation-voice",
          where,
          `${where} ${field}: "${finding.matchedText}" (${finding.rule}). ${finding.suggestion}`,
        );
    return parts;
  };

  const inWordsRaw = Array.isArray(own.inWords) ? own.inWords : [];
  const inWords: WordsPhrase[] = inWordsRaw.flatMap((value): WordsPhrase[] => {
    const phrase = (value ?? {}) as { text?: unknown; quantityId?: unknown };
    if (typeof phrase.text !== "string" || phrase.text === "") return [];
    // A phrase whose text carries the name of a field is a record whose YAML did not parse the way
    // it was written. The site's own parser (content/provenance/yaml.ts) accepts shapes that
    // standard YAML refuses, and when it does it hands the raw source back as the value: a phrase
    // written `- text: "A", "quantityId": b` came back as one phrase whose text was that whole
    // line, quotes and all, and would have been read by visitors. No phrase a reader should see
    // contains this field's name, so this catches the class rather than the one instance.
    if (phrase.text.includes("quantityId")) {
      problem(
        "lab-explanation-unreadable",
        where,
        `${where} inWords: a phrase's text contains "quantityId", so its YAML did not parse as written: ${JSON.stringify(phrase.text.slice(0, 72))}.`,
      );
      return [{ text: phrase.text }];
    }
    if (typeof phrase.quantityId !== "string") return [{ text: phrase.text }];
    if (!bound.has(phrase.quantityId)) {
      problem(
        "lab-explanation-words-extra-quantity",
        where,
        `${where} inWords: names ${phrase.quantityId}, which this lab's formula does not bind.`,
      );
      return [{ text: phrase.text }];
    }
    return [{ text: phrase.text, quantityId: phrase.quantityId }];
  });
  const r0 = text(own.r0);
  const r1 = text(own.r1);
  const r3 = text(own.r3);
  if (inWords.length === 0 || inWordsRaw.length !== inWords.length || !r1) {
    problem(
      "lab-explanation-missing-level",
      where,
      `${where}: an own record carries inWords (a list of phrases, each with its text) and r1; r0 and r3 are optional.`,
    );
    return undefined;
  }
  const steps: CompiledStep[] = [];
  const stepsRaw = Array.isArray(own.r2) ? own.r2 : [];
  for (const [n, value] of stepsRaw.entries()) {
    const step = (value ?? {}) as { latex?: unknown; why?: unknown };
    const latex = text(step.latex);
    const why = text(step.why);
    if (!latex || !why) {
      problem(
        "lab-explanation-missing-level",
        where,
        `${where} r2 step ${n + 1}: a step carries its latex and its why.`,
      );
      continue;
    }
    const drawn = draw(latex, `r2 step ${n + 1}`, true);
    if (!drawn) continue;
    steps.push({
      formula: drawn.html,
      why: prose(why, `r2 step ${n + 1}`),
      ...(drawn.coloured ? { coloured: true } : {}),
    });
  }
  prose(inWords.map((phrase) => phrase.text).join(""), "inWords");
  const levels: ExplainerLevels = {
    paper,
    inWords,
    ...(r0 ? { r0: prose(r0, "r0") } : {}),
    r1: prose(r1, "r1"),
    ...(steps.length > 0 ? { r2: steps } : {}),
    ...(r3 ? { r3: prose(r3, "r3") } : {}),
  };
  return refusals === 0 ? levels : undefined;
}

/**
 * The refusal this loader raises, with its code as the first argument at every throw site, as
 * EquationExplanationsError takes its own. The code is at the site and not only inside the
 * constructor because that is where the refusal scanner reads it: a throw whose first argument is a
 * message alone is counted as a bare throw, which is undeclared debt rather than a typed refusal,
 * and it fails the ratchet.
 */
export class LabExplanationsError extends Error {
  readonly code: "lab-explanations-refused";
  constructor(code: "lab-explanations-refused", message: string) {
    super(`${code}: ${message}`);
    this.name = "LabExplanationsError";
    this.code = code;
  }
}

/**
 * Stops the build on any problem, naming each one. A displayed formula with NO entry is not a
 * problem: the labs are filled in one at a time and the census carries the count. A wrong entry is,
 * because a record that names a formula no page draws, or reuses a record that is not there, would
 * otherwise be a control that quietly never appears.
 */
export function assertLabExplanationsPublishable(checked: LabExplanations): void {
  if (checked.problems.length > 0)
    throw new LabExplanationsError(
      "lab-explanations-refused",
      `${LAB_EXPLANATIONS_DIR}/:\n${checked.problems.map((p) => `  ${p.code}: ${p.message}`).join("\n")}`,
    );
}
