/**
 * "EXPLAIN THIS FORMULA" ON A DISCOVERY PAGE, COMPILED (am-hk4b criterion 5).
 *
 * `content/journey-explanations/` held 39 authored entries that no reader could reach. The site list
 * (`journeyFormulaList.ts`), the renderer (`JourneyFormula.tsx`) and the panel
 * (`EquationExplainer.tsx`) all existed; this is the join, and it is the third member of the family
 * `labExplanations.ts` and `equationExplanations.ts` belong to.
 *
 * ONE READER OF THE FAMILY, NOT TWO. The shape checking, the site matching and the quantity
 * validation are `checkJourneyExplanations`'s, and this calls it rather than re-reading the YAML.
 * Two readers of one corpus drift while both keep printing a plausible number, which is the defect
 * the readings loader was consolidated to avoid earlier in this campaign.
 *
 * WHAT EACH KIND CONTRIBUTES, and each follows a precedent rather than a new design:
 *
 * - A STEP GLOSS gives `inWords` and `r3`, and its `r1` is THE STEP'S OWN `explanation`. That is
 *   what the records ask for in their own header -- "the step it names already carries the authors'
 *   own title and explanation ..., which the panel takes as its overview and full explanation, as
 *   modelExplanations.ts takes an equation record's own fields. This file adds only the equation in
 *   words and the margin, so no prose is copied and the two cannot drift."
 *
 *   NO r0 IS SYNTHESISED FROM THE STEP'S TITLE, and the cited precedent is why: modelExplanations
 *   maps a record's two fields to In words and Full explanation and offers "those two", with no
 *   overview invented from a heading. A title is not a sentence, AGENTS.md's R0 is "one or two
 *   sentences: what this paragraph says and why it is here", and the title is already printed
 *   beside the formula, so an r0 made from it would be a level the reader has read.
 *
 * - AN `own` ENTRY gives all four levels from its own record, compiled.
 * - A `display` ENTRY reuses the paper's record, so a reader meets the same words here and on the
 *   reading face and the two can never disagree. Exactly what a lab's `display:` entry does.
 *
 * NO COMPILATION FOR A STEP GLOSS'S PROSE, measured rather than assumed: 0 of the 28 step `r3`
 * notes and 0 of the 28 step explanations carry `$...$`, so they need no resolver and no KaTeX, and
 * the panel weighs what its strings weigh. `modelExplanations.ts` reached the same conclusion for
 * the same reason and says so. The 8 `own` entries DO carry mathematics -- 13 of their 24 prose
 * levels -- so those go through the shared prose loop with the journey resolver.
 *
 * THE RESOLVER THROWS WHERE THE LAB'S RETURNS. `journeyFormula` raises `JourneyFormulaError` on a
 * formula it cannot read, while `labFormula` hands back a kind-tagged result, so `draw` catches here
 * and reports. A page whose formula does not resolve already stops the build in `JourneyFormula`
 * itself; this reports rather than throws so that one bad record names itself instead of aborting
 * the payload.
 */
import {
  checkJourneyExplanations,
  type JourneyExplanationCensus,
  journeyExplanationCensusLine,
} from "../content/journeyExplanations.ts";
import type {
  CompiledExplanation,
  ExplainerLevels,
  ProsePart,
} from "../equations/printed/equationExplanations.ts";
import { compileProse, type DrawnFormula } from "../equations/printed/explainerProse.ts";
import { DISCOVER_FORMULAS } from "./journeyFormulaList.ts";
import { type JourneyScope, journeyFormula } from "./journeyFormulas.ts";
import { ARGUMENT_STEPS } from "./massEnergyArgument.ts";
import { RELATIVITY_CARDS } from "./specialRelativityInvestigation.ts";

/** The payload a discover page reads: the explainer for one formula, by page and latex. */
export type JourneyExplainerPayload = Readonly<{
  pages: Readonly<Record<string, Readonly<Record<string, ExplainerLevels>>>>;
}>;

export type JourneyExplainerBuild = Readonly<{
  payload: JourneyExplainerPayload;
  problems: readonly string[];
  census: JourneyExplanationCensus;
  /** Entries that produced an explainer, which is the number a reader can actually open. */
  drawn: number;
}>;

/** Every discover formula's scope, by latex. All 39 are globally distinct, so latex alone keys it. */
function scopeByLatex(): ReadonlyMap<string, JourneyScope> {
  return new Map(DISCOVER_FORMULAS.map((formula) => [formula.latex, formula.scope]));
}

/** Each derivation step's own full explanation, keyed `page|stepId`, for a step gloss's r1. */
function stepExplanationBysite(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const step of ARGUMENT_STEPS)
    map.set(`discover/mass-energy/investigate|${step.id}`, step.explanation);
  for (const card of RELATIVITY_CARDS)
    map.set(`discover/special-relativity/investigate|${card.id}`, card.explanation);
  return map;
}

const text = (parts: string): readonly ProsePart[] => [{ kind: "text", text: parts }];

export function compileJourneyExplainers(
  root: string,
  options: Readonly<{
    sites: ReadonlyMap<string, string>;
    pageFormulaLatex: ReadonlySet<string>;
    /**
     * A page formula's authored name in the site list, by latex, which becomes its fragment id.
     *
     * IT CANNOT COME FROM THE SCOPE, and the fragment count is what proved it: `scope.anchor` is
     * PAGE-level (`discover-light-quanta-investigate`), so an id built from it collided for every
     * page carrying more than one `own` entry -- four on light-quanta's investigation and two on
     * the Brownian journey wrote one fragment between them, and 32 landed where 36 were expected.
     * A count against its denominator caught what a passing build did not.
     *
     * `PAGE_FORMULAS`'s keys are authored, unique and meaningful (`bmOsmoticPressure`), which is
     * what the lab family requires of an `own` record's id and gets from the record itself.
     */
    pageFormulaKey: (latex: string) => string | undefined;
    isRegisteredQuantity: (quantityId: string) => boolean;
    displayRecord: (paper: string, display: string) => CompiledExplanation | undefined;
  }>,
): JourneyExplainerBuild {
  const checked = checkJourneyExplanations(root, {
    sites: options.sites,
    pageFormulaLatex: options.pageFormulaLatex,
    isRegisteredQuantity: options.isRegisteredQuantity,
    // The checker asks only whether a record EXISTS for a display id; this build needs the record
    // itself, so the same question is answered from the same source twice rather than two sources
    // once.
    hasDisplayRecord: (display) =>
      DISCOVER_FORMULAS.some((f) => options.displayRecord(f.scope.paper, display) !== undefined),
  });

  const problems = checked.problems.map((p) => `[${p.code}] ${p.where} ${p.message}`);
  const scopes = scopeByLatex();
  const stepExplanations = stepExplanationBysite();
  const pages: Record<string, Record<string, ExplainerLevels>> = {};
  let drawn = 0;

  for (const entry of checked.entries) {
    const scope = scopes.get(entry.latex);
    if (scope === undefined) continue; // Already reported by the checker as an unknown formula.
    const where = `${entry.page} ${entry.latex.slice(0, 40)}`;
    const draw = (latex: string, field: string, displayMode: boolean): DrawnFormula | undefined => {
      try {
        const compiled = journeyFormula(latex, scope, displayMode);
        return { html: compiled.html, coloured: compiled.terms.length > 0 };
      } catch (error) {
        problems.push(
          `[journey-explanation-formula-refused] ${where} ${field}: ${
            error instanceof Error ? error.message.split("\n")[0] : String(error)
          }`,
        );
        return undefined;
      }
    };
    const prose = (value: string, field: string): readonly ProsePart[] =>
      compileProse(value, field, draw, (finding, at) =>
        problems.push(
          `[journey-explanation-voice] ${where} ${at}: "${finding.matchedText}" (${finding.rule}). ${finding.suggestion}`,
        ),
      );

    let levels: ExplainerLevels | undefined;

    if (entry.kind === "display" && entry.display !== undefined) {
      const record = options.displayRecord(scope.paper, entry.display);
      if (record === undefined) continue; // Reported by the checker.
      // A phrase naming a quantity THIS formula does not bind keeps its words and loses its
      // binding, so that pointing at it never lights nothing. The lab family does the same for the
      // same reason, and a journey page's letters are not always the paper's.
      let bound: ReadonlySet<string>;
      try {
        bound = new Set(journeyFormula(entry.latex, scope, true).terms.map((t) => t.quantityId));
      } catch {
        bound = new Set();
      }
      levels = {
        ...record,
        inWords: record.inWords.map((phrase) =>
          phrase.quantityId !== undefined && !bound.has(phrase.quantityId)
            ? { text: phrase.text }
            : phrase,
        ),
      };
    } else if (entry.kind === "own") {
      // The record's own four levels, compiled: 13 of these 24 prose levels carry `$...$`, so the
      // shared loop and the journey resolver both earn their place here where a step gloss needs
      // neither.
      const { r0, r1, r2, r3 } = entry.readings;
      if (r1 === undefined) continue; // The checker has already named the missing level.
      const steps = (r2 ?? []).flatMap((step, index) => {
        const drawnStep = draw(step.latex, `r2 step ${index + 1}`, true);
        return drawnStep === undefined
          ? []
          : [
              {
                formula: drawnStep.html,
                why: prose(step.why, `r2 step ${index + 1}`),
                ...(drawnStep.coloured ? { coloured: true } : {}),
              },
            ];
      });
      // The in-words phrases are voice-checked as one sentence, as the other two families do: the
      // phrases are a sentence broken into bindings, and judging them apart judges fragments.
      prose(entry.inWords.map((phrase) => phrase.text).join(""), "inWords");
      const key = options.pageFormulaKey(entry.latex);
      if (key === undefined) {
        problems.push(
          `[journey-explanation-unknown-formula] ${where}: an own record needs its formula's authored name in the site list, which names its fragment; no page formula matches this latex.`,
        );
        continue;
      }
      levels = {
        paper: scope.paper,
        equation: `journey-${key}`,
        inWords: entry.inWords,
        ...(r0 === undefined ? {} : { r0: prose(r0, "r0") }),
        r1: prose(r1, "r1"),
        ...(steps.length > 0 ? { r2: steps } : {}),
        ...(r3 === undefined ? {} : { r3: prose(r3, "r3") }),
      };
    } else {
      const explanation = stepExplanations.get(`${entry.page}|${entry.step ?? ""}`);
      if (explanation === undefined || explanation.trim() === "") {
        problems.push(
          `[journey-explanation-missing-level] ${where}: step ${entry.step} carries no explanation, so the panel would have In words and a margin with no full explanation between them.`,
        );
        continue;
      }
      const margin = entry.readings.r3;
      levels = {
        paper: scope.paper,
        equation: `journey-${entry.page.replaceAll("/", "-")}-${entry.step ?? ""}`,
        inWords: entry.inWords,
        // The step's own explanation, moved and not rephrased, as modelExplanations.ts moves a
        // record's. Wrapped as one text part because 0 of the 28 carry mathematics, measured.
        r1: text(explanation),
        ...(margin === undefined ? {} : { r3: text(margin) }),
      };
    }

    if (levels === undefined) continue;
    const forPage = pages[entry.page] ?? {};
    forPage[entry.latex] = levels;
    pages[entry.page] = forPage;
    drawn += 1;
  }

  return { payload: { pages }, problems, census: checked.census, drawn };
}

/** The one-line census a build or a checker prints. */
export function journeyExplainerCensusLine(build: JourneyExplainerBuild): string {
  return `${journeyExplanationCensusLine(build.census)}; ${build.drawn} explainers drawn`;
}
