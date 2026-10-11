/**
 * THE DISCOVERY JOURNEYS' FORMULA EXPLANATIONS, READ AND JUDGED (am-hk4b).
 *
 * `content/journey-explanations/` holds 739 lines and 39 authored entries for the four journeys, and
 * until this module NOTHING READ THEM. No loader, no generated artifact, no renderer, no test, no
 * checker. They were reached only by `scripts/lint-voice.ts`, which walks all of `content/` and
 * checks prose, so their editorial VOICE was gated and their MEANING was not: a `quantityId` naming
 * nothing, a `latex` matching no formula on the page, or a `step` naming no derivation step would
 * all have sat there indefinitely.
 *
 * THE SHAPE QUESTION, DECIDED HERE (criterion 1), and the data settles it rather than taste. Each
 * record's header says its entries are "in the shape content/lab-explanations/ uses (dispatch 291)",
 * whose entries are exactly one of `display:`, `own:` or `incidental:`. Counted by key-set, they are
 * not:
 *
 *     28  (inWords, latex, r3, step)   <- carries a `step`, and no `own` wrapper
 *      8  (latex, own)                 <- lab-explanations
 *      3  (display, latex)             <- lab-explanations
 *
 * So the family holds TWO KINDS, and the majority is the one the headers do not describe. The
 * headers are what is wrong, not the 28, for a reason that is decisive rather than aesthetic: a
 * lab-explanations `own:` entry must carry ALL FOUR READING LEVELS, and the 28 carry `r3` alone.
 * Migrating them to that shape would mean INVENTING r0, r1 and r2 for 28 formulas, which is
 * authoring editorial content to satisfy a schema. The 8 real `own:` entries show what the shape
 * costs when it is met: every one of them carries r0, r1, r2 and r3.
 *
 * AND THE `step` KEY NAMES A CONSUMER THAT ALREADY EXISTS, which is the other half of the decision.
 * The 28 live on exactly two pages and correspond one-to-one with the derivation steps those pages
 * already render:
 *
 *     discover/mass-energy/investigate         16 entries <-> 16 ARGUMENT_STEPS
 *     discover/special-relativity/investigate  12 entries <-> 12 RELATIVITY_CARDS
 *
 * one entry per step, no gaps and no extras, and the `latex` agrees with the step's own formula in
 * 28 of 28. A step record carries `id`, `title`, `latex` (or `formula`) and one prose
 * `explanation`; the journey record adds the two things that prose cannot be: the formula IN WORDS
 * with canonical quantity bindings, and a cited historian's note. Against `L/2+L/2=L` the step says
 * "Asymmetric emission needs a recoil model and is outside this reconstruction" and the record says
 * "The paper's § 1 makes the same choice, two plane light waves of energy L/2 each" -- the second is
 * a pointer into the paper, which is what AGENTS.md's historian's margin is for.
 *
 * SO A STEP GLOSS IS ITS OWN KIND and is not a defective lab-explanation. It is judged against the
 * steps rather than against the lab-explanations schema.
 *
 * THE SITES ARE PASSED IN, NOT IMPORTED, and that is deliberate twice over. `labExplanations.ts`
 * takes its `displayRecord` the same way, so this follows the house pattern; and it keeps
 * `src/content/` free of a `src/discovery/` import while letting a test hand this function a
 * fixture site map, which is how the planted negatives below reach the predicate without a page.
 *
 * ZERO ENTRIES MATCHED READS AS 39 MISSING, not as a clean run. Every count this returns names its
 * denominator, because a checker over this family that found nothing and a checker that read nothing
 * are otherwise the same green.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "./schemas/strictParse.ts";

export const JOURNEY_EXPLANATIONS_DIR = join("content", "journey-explanations");

export type JourneyExplanationCode =
  | "journey-explanation-unreadable"
  | "journey-explanation-no-page"
  | "journey-explanation-kind"
  | "journey-explanation-duplicate"
  | "journey-explanation-unknown-step"
  | "journey-explanation-step-latex-disagrees"
  | "journey-explanation-unknown-formula"
  | "journey-explanation-missing-display-record"
  | "journey-explanation-missing-level"
  | "journey-explanation-unknown-quantity"
  | "journey-explanation-empty-words";

export type JourneyExplanationProblem = Readonly<{
  code: JourneyExplanationCode;
  file: string;
  where: string;
  message: string;
}>;

/** One phrase of an `inWords` reading: words, and optionally the quantity they name. */
export type WordsPhrase = Readonly<{ text: string; quantityId?: string }>;

/** A formula a journey page sets apart, and where its words come from. */
export type JourneyEntryKind = "step" | "own" | "display";

export type JourneyExplanationEntry = Readonly<{
  page: string;
  kind: JourneyEntryKind;
  latex: string;
  /** Set for `kind: "step"`: the derivation step this glosses. */
  step?: string;
  /** Set for `kind: "display"`: the printed display whose record supplies every level. */
  display?: string;
  inWords: readonly WordsPhrase[];
  /** The reading levels present, by name, so a caller can report what an entry carries. */
  levels: readonly string[];
  /**
   * The authored level VALUES, so a build can compile them without re-reading the YAML.
   *
   * ONE READER OF THE FAMILY IS THE POINT. The payload build needs the words, not only which
   * levels exist, and a second reader of one corpus drifts while both keep printing a plausible
   * number -- the defect the readings loader was consolidated to avoid earlier in this campaign.
   * For an `own` entry these are its `own` fields; for a step gloss they are the entry's own.
   * `r2` is a step list and the rest are prose, which is why they are not one type.
   */
  readings: Readonly<{
    r0?: string | undefined;
    r1?: string | undefined;
    r2?: readonly Readonly<{ latex: string; why: string }>[] | undefined;
    r3?: string | undefined;
  }>;
}>;

export type JourneyExplanationCensus = Readonly<{
  files: number;
  entries: number;
  step: number;
  own: number;
  display: number;
  /** Step entries whose page and step id matched a real derivation step. */
  stepsMatched: number;
  /** Derivation steps the site map declares, which is the denominator for stepsMatched. */
  stepsDeclared: number;
  /** Non-step entries whose latex matched a formula a page actually draws. */
  pageFormulasMatched: number;
  /** Formulas the pages declare in their own markup: the denominator for pageFormulasMatched. */
  pageFormulasDeclared: number;
  boundPhrases: number;
  distinctQuantities: number;
}>;

export type JourneyExplanationReport = Readonly<{
  entries: readonly JourneyExplanationEntry[];
  problems: readonly JourneyExplanationProblem[];
  census: JourneyExplanationCensus;
  /** Declared steps with no entry, by `page|step`. Reported; not yet a problem. */
  missing: readonly string[];
}>;

/** The formula a page's derivation step prints, keyed `page|stepId`. */
export type JourneySites = ReadonlyMap<string, string>;

export type JourneyExplanationOptions = Readonly<{
  sites: JourneySites;
  /**
   * Every formula the discover pages draw in their own markup, by latex.
   *
   * This is the OTHER half of criterion 3's population, and the bead was wrong that it had no
   * counterpart: `src/discovery/journeyFormulaList.ts` has held it as data since dispatch 276, with
   * `src/app/discover/formulaCensus.test.tsx` holding the list and the rendered pages to each other
   * both ways. So a non-step entry is judged against a real site exactly as a step entry is, and
   * measured 2026-10-11 the two covers are exact: 11 entries against 11 declared page formulas and
   * 28 against 28 declared derivation steps, 39 of 39 with nothing over on either side.
   */
  pageFormulaLatex: ReadonlySet<string>;
  /** Whether a canonical quantity id is registered. */
  isRegisteredQuantity: (quantityId: string) => boolean;
  /** Whether `content/equation-explanations/` holds a record for this display id. */
  hasDisplayRecord: (displayId: string) => boolean;
}>;

const READING_LEVELS = ["r0", "r1", "r2", "r3"] as const;

/**
 * Whether a reading level is present, which is NOT the same question for every level.
 *
 * r0, r1 and r3 are prose. **r2 IS A LIST of `{ latex, why }`**, because it is "show every step" --
 * `equationExplanations.ts:14` states it: "r2 Every step: a list of { latex, why }, each formula
 * with the reason for it in words". My first version of this function asked `typeof === "string"`
 * for all four and reported all 8 `own` entries as missing r2, which was my instrument and not the
 * corpus: the 8 carry 23 well-formed steps between them. That is the fourth wrong-shape assumption
 * of this session's measurements, and it is the reason the per-level question is asked per level
 * here rather than in one loop.
 */
function hasLevel(record: Readonly<Record<string, unknown>>, level: string): boolean {
  const value = record[level];
  if (level === "r2")
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (step) =>
          step !== null &&
          typeof step === "object" &&
          typeof (step as { latex?: unknown }).latex === "string" &&
          typeof (step as { why?: unknown }).why === "string",
      )
    );
  return typeof value === "string" && value !== "";
}

function phrasesOf(raw: unknown): readonly WordsPhrase[] {
  if (!Array.isArray(raw)) return [];
  const parts: WordsPhrase[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const phrase = item as Record<string, unknown>;
    if (typeof phrase.text !== "string") continue;
    parts.push(
      typeof phrase.quantityId === "string"
        ? { text: phrase.text, quantityId: phrase.quantityId }
        : { text: phrase.text },
    );
  }
  return parts;
}

/**
 * Which of the three kinds this entry is, or null when it is none of them.
 *
 * Returning null rather than guessing is criterion 2: "a loader with a typed schema reads the
 * family and REFUSES an entry that matches no declared shape, rather than dropping it." A loader
 * that skipped the unrecognised would have been the defect this bead describes, since 28 of 39
 * match no documented shape and a silent drop would have reported 11 of 11 clean.
 */
function kindOf(entry: Readonly<Record<string, unknown>>): JourneyEntryKind | null {
  if (typeof entry.latex !== "string" || entry.latex === "") return null;
  if (typeof entry.step === "string" && entry.step !== "") return "step";
  if (entry.own !== null && typeof entry.own === "object") return "own";
  if (typeof entry.display === "string" && entry.display !== "") return "display";
  return null;
}

export function checkJourneyExplanations(
  root: string,
  options: JourneyExplanationOptions,
): JourneyExplanationReport {
  const dir = join(root, JOURNEY_EXPLANATIONS_DIR);
  const problems: JourneyExplanationProblem[] = [];
  const entries: JourneyExplanationEntry[] = [];
  const seen = new Set<string>();
  const quantities = new Set<string>();
  let files = 0;
  let boundPhrases = 0;
  const matchedSites = new Set<string>();
  const matchedPageFormulas = new Set<string>();

  const problem = (
    code: JourneyExplanationCode,
    file: string,
    where: string,
    message: string,
  ): void => {
    problems.push({ code, file, where, message });
  };

  for (const name of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!/\.ya?ml$/.test(name)) continue;
    files += 1;
    let parsed: Record<string, unknown>;
    try {
      parsed = strictParse(readFileSync(join(dir, name), "utf8"), "yaml", name) as Record<
        string,
        unknown
      >;
    } catch (error) {
      problem(
        "journey-explanation-unreadable",
        name,
        name,
        `did not parse: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      );
      continue;
    }
    const page = typeof parsed.page === "string" ? parsed.page : "";
    if (page === "") {
      problem(
        "journey-explanation-no-page",
        name,
        name,
        "declares no `page`, so no entry of it can be placed.",
      );
      continue;
    }
    const formulas = Array.isArray(parsed.formulas) ? parsed.formulas : [];
    for (const [index, raw] of formulas.entries()) {
      const where = `${page}[${index}]`;
      if (raw === null || typeof raw !== "object") {
        problem("journey-explanation-kind", name, where, "is not a mapping.");
        continue;
      }
      const entry = raw as Record<string, unknown>;
      const kind = kindOf(entry);
      if (kind === null) {
        problem(
          "journey-explanation-kind",
          name,
          where,
          `matches none of the three declared shapes (step, own, display). Keys: ${JSON.stringify(Object.keys(entry).sort())}.`,
        );
        continue;
      }
      const latex = entry.latex as string;
      const key = `${page}|${latex}`;
      if (seen.has(key)) {
        problem(
          "journey-explanation-duplicate",
          name,
          where,
          `a second entry on this page names the same latex ${JSON.stringify(latex.slice(0, 48))}.`,
        );
        continue;
      }
      seen.add(key);

      const own = kind === "own" ? (entry.own as Record<string, unknown>) : undefined;
      const inWords = phrasesOf(kind === "own" ? own?.inWords : entry.inWords);
      const levels = READING_LEVELS.filter((level) =>
        hasLevel(kind === "own" ? (own ?? {}) : entry, level),
      );

      if (kind === "step") {
        const step = entry.step as string;
        const site = options.sites.get(`${page}|${step}`);
        if (site === undefined) {
          problem(
            "journey-explanation-unknown-step",
            name,
            where,
            `names step ${JSON.stringify(step)}, which ${page} declares no derivation step for.`,
          );
        } else {
          matchedSites.add(`${page}|${step}`);
          // The join is the formula, not only the id: an entry whose id lands on a step printing a
          // DIFFERENT formula is glossing the wrong thing, and the id alone cannot see that.
          if (site !== latex)
            problem(
              "journey-explanation-step-latex-disagrees",
              name,
              where,
              `step ${step} prints ${JSON.stringify(site.slice(0, 64))} and this entry names ${JSON.stringify(latex.slice(0, 64))}.`,
            );
        }
        if (inWords.length === 0)
          problem(
            "journey-explanation-empty-words",
            name,
            where,
            "is a step gloss with no inWords, so it adds nothing the step's own explanation does not say.",
          );
      }

      if (kind === "own") {
        const absent = READING_LEVELS.filter((level) => !levels.includes(level));
        if (absent.length > 0)
          problem(
            "journey-explanation-missing-level",
            name,
            where,
            `is an \`own\` entry, which carries every reading level, and is missing ${absent.join(", ")}.`,
          );
        if (inWords.length === 0)
          problem(
            "journey-explanation-empty-words",
            name,
            where,
            "is an `own` entry with no inWords.",
          );
      }

      if (kind !== "step") {
        // Criterion 3 for the other half: a `display` or `own` entry names a formula the page writes
        // in its own markup, so it is matched against that list by latex. Without this the 11
        // non-step entries were the only ones in the family judged against nothing.
        if (options.pageFormulaLatex.has(latex)) matchedPageFormulas.add(latex);
        else
          problem(
            "journey-explanation-unknown-formula",
            name,
            where,
            `names ${JSON.stringify(latex.slice(0, 64))}, which no formula the discover pages draw matches.`,
          );
      }

      if (kind === "display") {
        const display = entry.display as string;
        if (!options.hasDisplayRecord(display))
          problem(
            "journey-explanation-missing-display-record",
            name,
            where,
            `points at display ${JSON.stringify(display)}, which content/equation-explanations/ holds no record for.`,
          );
      }

      for (const phrase of inWords) {
        if (phrase.quantityId === undefined) continue;
        boundPhrases += 1;
        quantities.add(phrase.quantityId);
        if (!options.isRegisteredQuantity(phrase.quantityId))
          problem(
            "journey-explanation-unknown-quantity",
            name,
            where,
            `binds ${JSON.stringify(phrase.quantityId)}, which is not an exact canonical quantity id.`,
          );
      }

      const source = kind === "own" ? (own ?? {}) : entry;
      const readingText = (level: string): string | undefined =>
        typeof source[level] === "string" && source[level] !== ""
          ? (source[level] as string)
          : undefined;
      const r2Steps = Array.isArray(source.r2)
        ? source.r2.flatMap((raw) => {
            const step = (raw ?? {}) as { latex?: unknown; why?: unknown };
            return typeof step.latex === "string" && typeof step.why === "string"
              ? [{ latex: step.latex, why: step.why }]
              : [];
          })
        : undefined;
      entries.push({
        page,
        kind,
        latex,
        ...(kind === "step" ? { step: entry.step as string } : {}),
        ...(kind === "display" ? { display: entry.display as string } : {}),
        inWords,
        levels,
        readings: {
          ...(readingText("r0") === undefined ? {} : { r0: readingText("r0") }),
          ...(readingText("r1") === undefined ? {} : { r1: readingText("r1") }),
          ...(r2Steps === undefined || r2Steps.length === 0 ? {} : { r2: r2Steps }),
          ...(readingText("r3") === undefined ? {} : { r3: readingText("r3") }),
        },
      });
    }
  }

  const missing = [
    ...[...options.sites.keys()].filter((site) => !matchedSites.has(site)),
    ...[...options.pageFormulaLatex].filter((latex) => !matchedPageFormulas.has(latex)),
  ].sort();

  return {
    entries,
    problems,
    census: {
      files,
      entries: entries.length,
      step: entries.filter((e) => e.kind === "step").length,
      own: entries.filter((e) => e.kind === "own").length,
      display: entries.filter((e) => e.kind === "display").length,
      stepsMatched: matchedSites.size,
      stepsDeclared: options.sites.size,
      pageFormulasMatched: matchedPageFormulas.size,
      pageFormulasDeclared: options.pageFormulaLatex.size,
      boundPhrases,
      distinctQuantities: quantities.size,
    },
    missing,
  };
}

/** The one-line census, with every denominator named. */
export function journeyExplanationCensusLine(census: JourneyExplanationCensus): string {
  return (
    `examined ${census.entries} journey-formula entries in ${census.files} files ` +
    `(${census.step} step glosses, ${census.own} in the journey's own words, ${census.display} reusing a paper's record); ` +
    `${census.stepsMatched} of ${census.stepsDeclared} declared derivation steps and ` +
    `${census.pageFormulasMatched} of ${census.pageFormulasDeclared} declared page formulas glossed; ` +
    `${census.boundPhrases} bound phrases naming ${census.distinctQuantities} quantities`
  );
}
