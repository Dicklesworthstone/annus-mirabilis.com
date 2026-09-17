import { describe, expect, test } from "bun:test";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import type { WeavePredicate, WeaveSnapshotView } from "../../experiments/weave/types.ts";
import { allLitContentIds, isContentIdLit, primaryFlagForContentId } from "./faceLookup.ts";

/**
 * The plan's own example (am-read-result-weave-jex bead text): "dragging the boost past 0.5c
 * lights the paper 3 §4 sentence about the slowed clock." Special relativity's own source text
 * (paper 3) is not in this repository yet -- only Brownian motion has a bilingual fixture
 * (src/testing/fixtures/bilingual/brownianBilingualFixture.ts), and even that is fixture data,
 * not reviewed source content (content/source-blocks/brownian-motion/manifest.yaml still
 * declares `units: []`). Inventing paper-3 prose to stand in for it would be exactly the kind of
 * fabrication this project's own discipline forbids.
 *
 * So this proof uses a real, grammar-valid anchor id (`s4-p1-s1`, round-tripped through the real
 * `parseAnchor` in contentIds.test.ts) as a labeled STAND-IN for "the paper 3 §4 sentence about
 * the slowed clock" -- syntactically real, honestly not a claim about real paper-3 content -- and
 * the real, already-shipped SR-04 instrument's own `lorentzFactor` output
 * (src/experiments/sr04/definition.ts) converted from the bead's v/c thresholds, rather than a
 * fabricated instrument. Once paper 3's real content lands, only the target id here needs to
 * change; the addressing mechanism does not.
 */

const SLOWED_CLOCK_SENTENCE_ID = "s4-p1-s1";

// v/c = 0.50 -> gamma = 1/sqrt(1-0.25) = 1.154700538...; v/c = 0.48 -> gamma = 1.139901881...
const ENTER_LORENTZ_FACTOR = 1 / Math.sqrt(1 - 0.5 * 0.5);
const EXIT_LORENTZ_FACTOR = 1 / Math.sqrt(1 - 0.48 * 0.48);

const SLOWED_CLOCK_PREDICATE: WeavePredicate = {
  id: "sr04-s4-slowed-clock",
  instrumentId: "sr-04",
  meaning: "quantity-compared",
  conditions: [
    {
      kind: "threshold",
      quantityId: "lorentzFactor",
      direction: "at-least",
      enter: ENTER_LORENTZ_FACTOR,
      exit: EXIT_LORENTZ_FACTOR,
    },
  ],
  targets: [SLOWED_CLOCK_SENTENCE_ID],
  pointerText:
    "The slowing exists at every nonzero speed; from here it is large enough to read on these clocks.",
};

function snapshotAt(
  lorentzFactor: number,
  runId = "run-1",
  snapshotVersion = 1,
): WeaveSnapshotView {
  return {
    runId,
    snapshotVersion,
    outputs: {
      lorentzFactor: { quantityId: "lorentzFactor", status: "value", value: lorentzFactor },
    },
    refused: false,
  };
}

describe("faceLookup: the slowed-clock example lights and clears by content id, not array position", () => {
  test("dragging the boost past 0.5c lights the canonical German sentence id", () => {
    const evaluator = createWeaveEvaluator([SLOWED_CLOCK_PREDICATE]);
    const derived = evaluator.evaluate(snapshotAt(1.25)); // v/c = 0.6
    expect(isContentIdLit(derived, SLOWED_CLOCK_SENTENCE_ID)).toBe(true);
  });

  test("PLANTED NEGATIVE: well below 0.5c, the sentence stays dark on every id it could be rendered under", () => {
    const evaluator = createWeaveEvaluator([SLOWED_CLOCK_PREDICATE]);
    const derived = evaluator.evaluate(snapshotAt(1.0482848367219182)); // v/c = 0.3
    expect(isContentIdLit(derived, SLOWED_CLOCK_SENTENCE_ID)).toBe(false);
    expect(isContentIdLit(derived, `${SLOWED_CLOCK_SENTENCE_ID}a`)).toBe(false);
    expect(isContentIdLit(derived, `${SLOWED_CLOCK_SENTENCE_ID}b`)).toBe(false);
    expect(allLitContentIds(derived).size).toBe(0);
  });

  test("the lit state is visible identically whether English rendered the sentence whole or split in two", () => {
    const evaluator = createWeaveEvaluator([SLOWED_CLOCK_PREDICATE]);
    const derived = evaluator.evaluate(snapshotAt(1.25));
    // German face: renders the canonical (unsuffixed) id directly.
    expect(isContentIdLit(derived, SLOWED_CLOCK_SENTENCE_ID)).toBe(true);
    // English face, sentence NOT split: also renders the canonical id.
    // English face, sentence split into two translation units: renders both halves separately.
    expect(isContentIdLit(derived, `${SLOWED_CLOCK_SENTENCE_ID}a`)).toBe(true);
    expect(isContentIdLit(derived, `${SLOWED_CLOCK_SENTENCE_ID}b`)).toBe(true);
    // All three ids resolve to the SAME predicate, proving a reader keeps their place across a
    // face switch: this is never three different lookups happening to agree, but one canonical
    // comparison every caller goes through.
    const german = primaryFlagForContentId(derived, SLOWED_CLOCK_SENTENCE_ID);
    const englishHalfA = primaryFlagForContentId(derived, `${SLOWED_CLOCK_SENTENCE_ID}a`);
    const englishHalfB = primaryFlagForContentId(derived, `${SLOWED_CLOCK_SENTENCE_ID}b`);
    expect(german?.predicateId).toBe("sr04-s4-slowed-clock");
    expect(englishHalfA?.predicateId).toBe(german?.predicateId);
    expect(englishHalfB?.predicateId).toBe(german?.predicateId);
  });

  test("exiting below 0.48c clears the sentence on every face, with no flicker at exactly the exit boundary from above", () => {
    const evaluator = createWeaveEvaluator([SLOWED_CLOCK_PREDICATE]);
    evaluator.evaluate(snapshotAt(1.25, "run-1", 1)); // enters
    const holding = evaluator.evaluate(snapshotAt(EXIT_LORENTZ_FACTOR + 1e-9, "run-1", 2));
    expect(isContentIdLit(holding, SLOWED_CLOCK_SENTENCE_ID)).toBe(true);
    const exited = evaluator.evaluate(snapshotAt(EXIT_LORENTZ_FACTOR - 1e-9, "run-1", 3));
    expect(isContentIdLit(exited, SLOWED_CLOCK_SENTENCE_ID)).toBe(false);
  });

  test("array-position independence: a second, differently-ordered predicate list addressing the same sentence produces the same lookup result", () => {
    const otherOrderPredicate: WeavePredicate = {
      ...SLOWED_CLOCK_PREDICATE,
      id: "z-unrelated-later-predicate",
      targets: [SLOWED_CLOCK_SENTENCE_ID],
    };
    // Two evaluators built from the SAME set of predicates in different array order: if the
    // lookup ever depended on index rather than content id, these would disagree about which
    // predicate id "the sentence at position 0" belongs to. They must not.
    const forward = createWeaveEvaluator([SLOWED_CLOCK_PREDICATE, otherOrderPredicate]);
    const reversed = createWeaveEvaluator([otherOrderPredicate, SLOWED_CLOCK_PREDICATE]);
    const derivedForward = forward.evaluate(snapshotAt(1.25));
    const derivedReversed = reversed.evaluate(snapshotAt(1.25));
    expect(litFlagsPredicateIds(derivedForward)).toEqual(litFlagsPredicateIds(derivedReversed));
  });
});

function litFlagsPredicateIds(
  derived: ReturnType<ReturnType<typeof createWeaveEvaluator>["evaluate"]>,
) {
  return [...allLitContentIds(derived)].sort();
}
