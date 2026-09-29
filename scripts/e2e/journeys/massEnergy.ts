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
 * ONE PAPER'S CONTINUOUS JOURNEY, AS SCENARIO SOURCE (am-test-e2e-harness-bqmh, dispatch 441).
 *
 * The harness carried the browser launch, the viewports, the evidence retention and the JSONL and no
 * scenario source; its own header says so, and that outside --self-test-failure it records a
 * configuration failure rather than pretending scenarios exist. This is the first real one.
 *
 * WHY MASS-ENERGY. Measured against the built site before choosing: all four papers afford all seven
 * steps (seven faces each, 19 to 34 foundation links, 3 to 13 laboratory links, term markup on every
 * one), so the choice is not forced by what exists. Mass-energy is the smallest corpus - 28 sentence
 * ids against relativity's 223 - so every step's target can be named exactly rather than found by
 * pattern, and its three laboratories are ones whose runtime this bead's author has already walked end
 * to end. The dispatch offered brownian-motion as either the most valuable or the wrong first choice
 * because it is served by a different shell: src/app/papers/[paper]/page.tsx does dispatch between
 * PaperReader and PaperPage, so that is real, and it is the reason to do this paper FIRST and
 * brownian-motion second, since a journey that cannot walk the common shell tells us nothing about
 * the uncommon one.
 *
 * EVERY STEP IS A FAILURE WHEN IT CANNOT BE PERFORMED. No step is skipped, no readiness is a sleep,
 * and the actions below throw rather than returning a soft verdict: a lane that quietly omitted
 * "return to the exact argument" would prove nothing, which is the requirement this file is written
 * against.
 */

/* Typed before freezing, so the literal is checked against the contract rather than widened. */
const MASS_ENERGY_JOURNEY_SHAPE: PaperE2EJourney = {
  sliceId: "mass-energy-continuous-journey",
  paperSlug: "mass-energy",
  route: "/papers/mass-energy/view/parallel/#s0-p1-s1",
  viewport: "desktop",
  retainedEvidenceOnFailure: ["screenshot", "trace", "dom", "console"],
  steps: [
    {
      kind: "enter-source-passage",
      description:
        "Enter on the parallel face at the paper's first sentence, the way a deep link arrives.",
      readiness: { description: "the sentence element exists", selector: "#s0-p1-s1" },
    },
    {
      kind: "switch-face",
      description: "Switch to the English face and find the same sentence there.",
      readiness: {
        description: "the English face carries the same sentence id",
        selector: "#s0-p1-s1",
      },
    },
    {
      kind: "open-foundation",
      description: "Open a foundation lesson from the explanation, without leaving the paper.",
      readiness: {
        description: "a foundation panel is present after its control is pressed",
        selector: "[data-foundation-panel]",
      },
    },
    {
      kind: "return-to-argument",
      description: "Return from the foundation to the exact argument it was opened from.",
      readiness: {
        description: "the argument the foundation was opened from is on screen",
        selector: "[data-argument-id]",
      },
    },
    {
      kind: "operate-instrument",
      description: "Operate one of the paper's instruments and accept a new state.",
      readiness: {
        description: "the laboratory's accepted status line states the new state",
        selector: "p.status-line",
      },
    },
    {
      kind: "select-linked-term",
      description: "Select a linked term in an equation and see what it names.",
      readiness: { description: "a term chip is pressed and marked", selector: "[data-term]" },
    },
    {
      kind: "return-to-source",
      description: "Return to the exact source sentence the journey entered on.",
      readiness: { description: "the entry sentence is present again", selector: "#s0-p1-s1" },
    },
  ],
};

export const MASS_ENERGY_JOURNEY: PaperE2EJourney = Object.freeze(MASS_ENERGY_JOURNEY_SHAPE);

/*
 * The paper's own names, and nothing about how a step is driven: that is steps.ts, shared with the
 * other three journeys. What is asserted here is this paper's content - its opening sentence, the
 * laboratory of its two ledgers and the control that moves the observer to rest.
 */
const SENTENCE = "s0-p1-s1";

export const MASS_ENERGY_ACTIONS: JourneyActions = Object.freeze({
  "enter-source-passage": enterSourcePassage("mass-energy", SENTENCE),
  "switch-face": switchFace("mass-energy", SENTENCE),
  "open-foundation": openFoundation("mass-energy"),
  "return-to-argument": returnToArgument,
  "operate-instrument": operateInstrument("me-01", "Stationary observer (v = 0)"),
  "select-linked-term": selectLinkedTerm("mass-energy"),
  "return-to-source": returnToSource("mass-energy", SENTENCE),
});
