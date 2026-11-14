import { DISCOVERY_PAPERS, type DiscoveryPaper } from "../../content/schemas/discovery.ts";
import type { Stage, TransferCase } from "../../content/schemas/journey.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import { REAL_JOURNEYS } from "../journeys/realJourneys.ts";
import { NOTE_PAPER_TITLES } from "../notes/manifest.ts";
import { revisitHref, revisitPromptId } from "./links.ts";

/**
 * The argument being reconsidered, not a claim that the paper calculated the hypothetical case.
 * These explicit bindings are checked against the published argument records and guide anchors.
 */
const ORIGINAL_ARGUMENTS: Readonly<Record<DiscoveryPaper, Readonly<Record<string, string>>>> = {
  "light-quanta": {
    "step-03": "arg-lq-classical-allocation",
    "step-04": "arg-lq-fixed-band-volume",
    "step-05": "arg-lq-independent-configurations",
    "step-06": "arg-lq-entropy-correspondence",
    "step-07": "arg-lq-photoelectric-limits",
  },
  "brownian-motion": {
    "step-01": "arg-bm-observable",
    "step-02": "arg-bm-osmotic-suspended",
    "step-03": "arg-bm-diffusivity",
    "step-04": "arg-bm-independent-steps",
    "step-05": "arg-bm-gaussian",
    "step-07": "arg-bm-inference",
  },
  "special-relativity": {
    "step-02": "arg-sr-magnet-conductor",
    "step-04": "arg-sr-synchronization",
    "step-05": "arg-sr-lorentz-map",
    "step-06": "arg-sr-clock-and-length",
    "step-07": "arg-sr-magnet-conductor",
  },
  "mass-energy": {
    "step-01": "arg-me-symmetric-emission",
    "step-02": "arg-me-mass-change",
    "step-03": "arg-me-import",
    "step-04": "arg-me-constant-premise",
    "step-05": "arg-me-small-speed",
  },
};

export type RevisitCaseOption = Readonly<{
  id: string;
  paper: DiscoveryPaper;
  paperTitle: string;
  title: string;
}>;

export type RevisitCase = RevisitCaseOption &
  Readonly<{
    stageId: string;
    stageTitle: string;
    stageHref: string;
    href: string;
    originalQuestion: string;
    originalExample: Stage["support"]["workedExample"];
    transferCase: TransferCase;
    instrument: Stage["instrument"];
    sourceAnchor: string | null;
    sourceHref: string | null;
    part: ExplanationExercisePart;
  }>;

/** Reuse authored cases verbatim. No random numbers, stored numerical answers or inferred runs. */
export const REVISIT_CASES: readonly RevisitCase[] = Object.freeze(
  DISCOVERY_PAPERS.flatMap((paper) => {
    const journey = REAL_JOURNEYS.find((item) => item.paper === paper);
    return (journey?.stages ?? []).flatMap((stage) => {
      const transferCase = stage.support.transferCase;
      if (!transferCase) return [];
      const id = revisitPromptId(paper, stage.id);
      const sourceAnchor = ORIGINAL_ARGUMENTS[paper][stage.id] ?? null;
      return [
        Object.freeze({
          id,
          paper,
          paperTitle: NOTE_PAPER_TITLES[paper],
          title: transferCase.condition,
          stageId: stage.id,
          stageTitle: stage.title,
          stageHref: `/discover/${paper}/#${stage.id}`,
          href: revisitHref(paper, stage.id),
          originalQuestion: stage.question,
          originalExample: stage.support.workedExample,
          transferCase,
          instrument: stage.instrument,
          sourceAnchor,
          sourceHref: sourceAnchor ? `/papers/${paper}/#${sourceAnchor}` : null,
          part: Object.freeze({
            id,
            prompt: `${transferCase.condition} Explain what changes in the original argument and what still holds. Name the assumption or condition responsible.`,
            criteria: Object.freeze([
              `What changes: ${transferCase.whatChanges}`,
              `What stays valid: ${transferCase.whatStaysValid}`,
            ]),
            workedExplanation: transferCase.explanation,
          }),
        }),
      ];
    });
  }),
);

/** Only chooser labels cross this client boundary; the cases themselves render on the server. */
export const REVISIT_OPTIONS: readonly RevisitCaseOption[] = Object.freeze(
  REVISIT_CASES.map(({ id, paper, paperTitle, title }) =>
    Object.freeze({ id, paper, paperTitle, title }),
  ),
);

export const REVISIT_STAGE_LINKS = Object.freeze(
  REVISIT_CASES.map(({ paper, stageId, href }) => Object.freeze({ paper, stageId, href })),
);
