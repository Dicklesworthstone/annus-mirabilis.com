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
 * BROWNIAN MOTION'S CONTINUOUS JOURNEY (am-test-e2e-harness-bqmh, dispatch 458).
 *
 * WHY THIS PAPER SECOND AND NOT ALPHABETICALLY. src/app/papers/[paper]/page.tsx dispatches between
 * two shells, and this is the only paper served by PaperReader while the other three are served by
 * PaperPage. That split has produced two separate reader-facing defects: a misconception ledger that
 * reached no reader for weeks, and the anchor repair that had to be made in both files. A journey
 * that walks the other shell is the one most likely to find something, so it comes before the two
 * papers that share mass-energy's shell.
 *
 * Its own names, measured against the built site: the opening sentence of the paper Einstein sent in
 * May, the configuration-counting laboratory BM-03, and its 1000-particle default, which is the
 * osmotic-partition case the paper's second section argues from. The mechanics are steps.ts, shared
 * with the other journeys; nothing about how a step is driven is repeated here.
 */
const SENTENCE = "s0-p1-s1";

const JOURNEY: PaperE2EJourney = {
  sliceId: "brownian-motion-continuous-journey",
  paperSlug: "brownian-motion",
  route: `/papers/brownian-motion/view/parallel/#${SENTENCE}`,
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
      description:
        "Open a foundation lesson from the explanation, in place, on the PaperReader shell.",
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
      description: "Operate the configuration counter and accept a new state.",
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

export const BROWNIAN_MOTION_JOURNEY: PaperE2EJourney = Object.freeze(JOURNEY);

export const BROWNIAN_MOTION_ACTIONS: JourneyActions = Object.freeze({
  "enter-source-passage": enterSourcePassage("brownian-motion", SENTENCE),
  "switch-face": switchFace("brownian-motion", SENTENCE),
  "open-foundation": openFoundation("brownian-motion"),
  "return-to-argument": returnToArgument,
  "operate-instrument": operateInstrument(
    "bm-03",
    "1000 particles (the osmotic-partition default)",
  ),
  "select-linked-term": selectLinkedTerm("brownian-motion"),
  "return-to-source": returnToSource("brownian-motion", SENTENCE),
});
