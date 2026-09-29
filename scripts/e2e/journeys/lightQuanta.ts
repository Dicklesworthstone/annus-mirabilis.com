import type { PaperE2EJourney } from "../paper-e2e-contract.ts";
import {
  enterSourcePassage,
  type JourneyActions,
  openFoundation,
  operateInstrument,
  returnToArgument,
  returnToSource,
  selectLinkedTerm,
  switchFace,
} from "./steps.ts";

/*
 * LIGHT QUANTA'S CONTINUOUS JOURNEY (am-test-e2e-harness-bqmh, dispatch 458).
 *
 * This paper and special relativity share mass-energy's PaperPage shell, so they come after brownian-motion, which is the only one on PaperReader and therefore the one most likely to expose a difference. Sharing a shell does not make a journey redundant: what each asserts is its own content, and this one enters on the heuristic-viewpoint opening.
 *
 * Its own names, measured against the built site: the paper's opening sentence, the configuration counter LQ-05 and its locked-positions preset, which is the counterexample the paper's fifth section turns on. The
 * mechanics are steps.ts, shared with the other three journeys; nothing about how a step is driven
 * is repeated here, which is the point of writing the fourth one after the first three.
 */
const SENTENCE = "s0-p1-s1";

const JOURNEY: PaperE2EJourney = {
  sliceId: "light-quanta-continuous-journey",
  paperSlug: "light-quanta",
  route: `/papers/light-quanta/view/parallel/#${SENTENCE}`,
  viewport: "desktop",
  retainedEvidenceOnFailure: ["screenshot", "trace", "dom", "console"],
  steps: [
    {
      kind: "enter-source-passage",
      description:
        "Enter on the parallel face at the paper's first sentence, as a deep link arrives.",
      readiness: { description: "the sentence element exists", selector: `#${SENTENCE}` },
    },
    {
      kind: "switch-face",
      description: "Switch to the English face and find the same sentence there.",
      readiness: {
        description: "the English face carries the same sentence id",
        selector: `#${SENTENCE}`,
      },
    },
    {
      kind: "open-foundation",
      description: "Open a foundation lesson from the explanation, in place.",
      readiness: {
        description: "one foundation panel is visible and the address names it",
        selector: "[data-foundation-panel]",
      },
    },
    {
      kind: "return-to-argument",
      description: "Return from the foundation to the exact argument it was opened from.",
      readiness: {
        description: "no panel is open, the address drops it, and focus is on the trigger",
        selector: "[data-return-caption-line]",
      },
    },
    {
      kind: "operate-instrument",
      description:
        "Operate the configuration counter at its locked-positions preset and accept a new state.",
      readiness: {
        description: "the laboratory's accepted status line states the new state",
        selector: "p.status-line",
      },
    },
    {
      kind: "select-linked-term",
      description: "Select a linked term in an equation and see what it names.",
      readiness: { description: "a term chip is pressed and marked", selector: "button.term-chip" },
    },
    {
      kind: "return-to-source",
      description: "Return to the exact source sentence the journey entered on.",
      readiness: { description: "the entry sentence is present again", selector: `#${SENTENCE}` },
    },
  ],
};

export const LIGHT_QUANTA_JOURNEY: PaperE2EJourney = Object.freeze(JOURNEY);

export const LIGHT_QUANTA_ACTIONS: JourneyActions = Object.freeze({
  "enter-source-passage": enterSourcePassage("light-quanta", SENTENCE),
  "switch-face": switchFace("light-quanta", SENTENCE),
  "open-foundation": openFoundation("light-quanta"),
  "return-to-argument": returnToArgument,
  "operate-instrument": operateInstrument(
    "lq-05",
    "The locked positions (n = 10, locked counterexample)",
  ),
  "select-linked-term": selectLinkedTerm("light-quanta"),
  "return-to-source": returnToSource("light-quanta", SENTENCE),
});
