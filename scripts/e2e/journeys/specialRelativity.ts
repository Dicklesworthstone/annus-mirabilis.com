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
 * SPECIAL RELATIVITY'S CONTINUOUS JOURNEY (am-test-e2e-harness-bqmh, dispatch 458).
 *
 * The largest paper, and the last of the four: 223 sentence ids on its parallel face against mass-energy's 28. It shares the PaperPage shell, so what it adds is its own content and the scale - a journey here walks the pages where a selector that happens to match something else is most likely to.
 *
 * Its own names, measured against the built site: the paper's opening sentence, the rods-and-clocks studio SR-03 and its signature boost, which is the walkthrough AGENTS.md names by its tape id. The
 * mechanics are steps.ts, shared with the other three journeys; nothing about how a step is driven
 * is repeated here, which is the point of writing the fourth one after the first three.
 */
const SENTENCE = "s0-p1-s1";

const JOURNEY: PaperE2EJourney = {
  sliceId: "special-relativity-continuous-journey",
  paperSlug: "special-relativity",
  route: `/papers/special-relativity/view/parallel/#${SENTENCE}`,
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
        "Operate the rods-and-clocks studio at its signature boost and accept a new state.",
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

export const SPECIAL_RELATIVITY_JOURNEY: PaperE2EJourney = Object.freeze(JOURNEY);

export const SPECIAL_RELATIVITY_ACTIONS: JourneyActions = Object.freeze({
  "enter-source-passage": enterSourcePassage("special-relativity", SENTENCE),
  "switch-face": switchFace("special-relativity", SENTENCE),
  "open-foundation": openFoundation("special-relativity"),
  "return-to-argument": returnToArgument,
  "operate-instrument": operateInstrument("sr-03", "Boost to 0.6c (Signature)"),
  "select-linked-term": selectLinkedTerm("special-relativity"),
  "return-to-source": returnToSource("special-relativity", SENTENCE),
});
