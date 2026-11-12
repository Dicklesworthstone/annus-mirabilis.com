/**
 * SR §1: choose a synchronization convention, then derive its midpoint consequence.
 *
 * The first replacement is a definition, not a deduction from the light-speed postulate.
 * The remaining steps are exact algebra conditional on that definition. Canonical equation
 * records own both the equal-leg criterion and the final midpoint relation; numerical examples
 * belong to the SR01 experiment seam and its existing events reference owner.
 */
import equalLegsRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-equal-legs.json";
import midpointRecord from "../../../content/equations/special-relativity/eq-model-sr-sync-midpoint.json";
import { type Expression, nodeId } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type PremiseRef,
} from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type CanonicalRecord = Readonly<{ id: string; tree: unknown }>;
export type SRSynchronizationRefusalCode =
  | "sr-synchronization-missing-glyph"
  | "sr-synchronization-relation-required"
  | "sr-synchronization-criterion-shape"
  | "sr-synchronization-unaddressable-operation";

/** Preserve the derivation schema's path while identifying the exact authoring refusal. */
export class SRSynchronizationError extends DerivationSchemaError {
  readonly code: SRSynchronizationRefusalCode;

  constructor(code: SRSynchronizationRefusalCode, message: string, path: string) {
    super(message, path);
    this.code = code;
  }
}

const glyphs: Readonly<Record<string, string>> = {
  signalDepartureTimeA: "t_A",
  signalReflectionTimeB: "t_B",
  signalReturnTimeA: "t_return",
};

/** Normalize repeated occurrences to the same quantity, preserving the canonical tree. */
export function presentSRSynchronizationExpression(tree: Expression): Expression {
  return projectDerivationSymbols(tree, (symbol) => {
    const glyph = glyphs[symbol.quantityId];
    if (!glyph)
      throw new SRSynchronizationError(
        "sr-synchronization-missing-glyph",
        `No synchronization glyph for ${symbol.quantityId}.`,
        "sr-synchronization.presentation",
      );
    return glyph;
  });
}

function canonical(record: CanonicalRecord): Relation {
  const tree = presentSRSynchronizationExpression(record.tree as Expression);
  if (tree.kind !== "relation" || tree.operator !== "=")
    throw new SRSynchronizationError(
      "sr-synchronization-relation-required",
      "Expected an equality.",
      `${record.id}.tree`,
    );
  return tree;
}

const two: Expression = { kind: "number", value: "2" };
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: `sr-synchronization.op.${id}`,
});

/**
 * The production boundary from canonical equation records to the chain's setup. A record
 * change must retain the equality, clock differences and addressable operations this route uses.
 */
export function createSRSynchronizationSetup(
  criterionRecord: CanonicalRecord,
  targetRecord: CanonicalRecord,
) {
  const criterion = canonical(criterionRecord);
  const midpoint = canonical(targetRecord);
  const outward = criterion.left;
  const backward = criterion.right;
  // Take all three readings from the canonical criterion rather than inventing new quantities.
  if (
    outward.kind !== "sum" ||
    outward.args[1]?.kind !== "negate" ||
    backward.kind !== "sum" ||
    !backward.args[0]
  )
    throw new SRSynchronizationError(
      "sr-synchronization-criterion-shape",
      "The synchronization criterion must contain the outward and return differences.",
      `${criterionRecord.id}.tree`,
    );
  const departure = outward.args[1].argument;
  const reception = backward.args[0];
  const elapsed: Expression = {
    kind: "sum",
    args: [reception, { kind: "negate", argument: departure }],
    opId: "sr-synchronization.op.elapsed",
  };
  const bookkeeping = equation(
    elapsed,
    { kind: "sum", args: [outward, backward], opId: "sr-synchronization.op.both-legs" },
    "bookkeeping",
  );
  const returnLegId = nodeId(backward);
  const outwardLegId = nodeId(outward);
  const midpointAverageId = nodeId(midpoint.right);
  if (!returnLegId || !outwardLegId || !midpointAverageId)
    throw new SRSynchronizationError(
      "sr-synchronization-unaddressable-operation",
      "Both assigned legs and the midpoint average need addressable operations.",
      "sr-synchronization.canonical-operations",
    );
  return Object.freeze({
    criterion,
    midpoint,
    outward,
    departure,
    elapsed,
    bookkeeping,
    returnLegId,
    outwardLegId,
    midpointAverageId,
  });
}

const setup = createSRSynchronizationSetup(equalLegsRecord, midpointRecord);
const { outward, departure, elapsed, returnLegId, outwardLegId, midpointAverageId } = setup;
export const srSynchronizationCriterion = setup.criterion;
export const srSynchronizationMidpoint = setup.midpoint;
/** This identity holds for any proposed B reading: its two appearances cancel. */
export const srSynchronizationBookkeeping = setup.bookkeeping;
const equalAssignedLegs = substituteNode(
  srSynchronizationBookkeeping,
  returnLegId,
  outward,
) as Relation;
const collected = equation(
  elapsed,
  { kind: "product", args: [two, outward], opId: "sr-synchronization.op.twice-outward" },
  "two-equal-legs",
);
const halfElapsed = equation(
  {
    kind: "quotient",
    numerator: elapsed,
    denominator: two,
    opId: "sr-synchronization.op.half-elapsed",
  },
  outward,
  "half-round-trip",
);
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const reconstruction = (ref: string): PremiseRef => ({
  ref,
  edgeType: "pedagogical-reconstruction",
});
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "exact-within-model",
  verification: { status: "authored-unverified" },
} as const;

export const srSynchronizationChain: DerivationChain = {
  id: "chain-sr-synchronization-midpoint",
  proofRouteId: "route-sr-synchronization-definition-consequence",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    historical("arg-sr-synchronization"),
    reconstruction("sr-synchronization-stationary-clocks-common-rate"),
    reconstruction("sr-synchronization-return-after-departure"),
  ],
  target: midpointRecord.id,
  targetStepId: "sr-synchronization-midpoint-reading",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "sr-synchronization-define-equal-legs",
      from: srSynchronizationBookkeeping,
      to: equalAssignedLegs,
      changedSubexpressionIds: [returnLegId, outwardLegId],
      rule: {
        kind: "substitute",
        params: {
          targetId: returnLegId,
          replacement: outward,
          citedEquality:
            "eq-model-sr-sync-equal-legs, source §1 eq-s1-d1: adopt t_B − t_A = t_return − t_B as the definition of synchronized clocks.",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Choose to assign equal time to the outward and return legs; the round-trip observation alone does not make that choice.",
        r1: "Both readings at A are local observations. To compare them with the distant reading at B, adopt the equal-leg definition: replace the return interval by the outward interval. This sets what synchronized means.",
        r2: "The first equality is bookkeeping: (t_B − t_A) + (t_return − t_B) = t_return − t_A for any proposed t_B, because its two appearances cancel. The replacement t_return − t_B ↦ t_B − t_A adds the synchronization convention printed in §1. It is not an algebraic identity valid for arbitrary t_B, nor a measurement of either one-way light time. Checking the substitution only checks its use of that explicitly adopted definition.",
      },
      tool: "foundation:frames-events",
      premiseRefs: [historical("eq-s1-d1"), reconstruction(equalLegsRecord.id)],
      sourceAnchor: "sr-synchronization-source-definition",
      isMove: true,
      moveLabel: "Define distant simultaneity by assigning equal time to the two light journeys.",
    },
    {
      ...draft,
      id: "sr-synchronization-count-equal-legs",
      from: equalAssignedLegs,
      to: collected,
      changedSubexpressionIds: [
        "sr-synchronization.op.both-legs",
        "sr-synchronization.op.twice-outward",
      ],
      rule: { kind: "collect", params: { exact: true } },
      reasonKind: "algebra",
      reasons: {
        r0: "Under the chosen definition, the round trip contains two copies of the same assigned interval.",
        r1: "Collect the two identical outward intervals. Their sum is twice t_B − t_A, so the full locally timed round trip equals two of those assigned intervals.",
        r2: "Write (t_B − t_A) + (t_B − t_A) = 2(t_B − t_A). The left side, t_return − t_A, is unchanged. This collection is exact arithmetic; its application to the two legs is conditional on the definition adopted in the preceding step. No distance, light speed, or moving-frame transformation enters this equality.",
      },
      tool: "foundation:bridge-sum-average",
      premiseRefs: [reconstruction("sr-synchronization-define-equal-legs")],
      sourceAnchor: "sr-synchronization-source-algebra",
      isMove: false,
    },
    {
      ...draft,
      id: "sr-synchronization-halve-round-trip",
      from: collected,
      to: halfElapsed,
      changedSubexpressionIds: [
        "sr-synchronization.op.elapsed",
        "sr-synchronization.op.half-elapsed",
      ],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: two,
          nonzeroCondition: "2 is nonzero",
          simplify: true,
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Each assigned leg lasts half the locally measured round trip.",
        r1: "Divide both sides by two. This gives the elapsed time assigned between departure at A and reflection at B; it has not yet given the reflection clock reading.",
        r2: "Dividing t_return − t_A = 2(t_B − t_A) by the nonzero number 2 gives (t_return − t_A)/2 = t_B − t_A. Keep the departure reading visible: an elapsed interval and a clock reading are different quantities. A ten-second round trip has a five-second assigned outward interval even when the departure clock reads twenty seconds.",
      },
      tool: "foundation:bridge-sum-average",
      premiseRefs: [reconstruction("sr-synchronization-count-equal-legs")],
      sourceAnchor: "sr-synchronization-source-algebra",
      isMove: false,
    },
    {
      ...draft,
      id: "sr-synchronization-midpoint-reading",
      from: halfElapsed,
      to: srSynchronizationMidpoint,
      changedSubexpressionIds: ["sr-synchronization.op.half-elapsed", midpointAverageId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "add", quantity: departure, simplify: true, swapSides: true },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Add the departure reading to that half interval to obtain the reading B should show at reflection.",
        r1: "Add t_A to both sides and put B’s reading on the left. The result is the midpoint of the departure and return readings, not always half the return reading.",
        r2: "The right side becomes t_B − t_A + t_A = t_B. The other side is (t_return − t_A)/2 + t_A = (t_return + t_A)/2, using the same nonzero denominator 2. Exchanging the two sides gives the canonical midpoint relation. Shifting both A readings by twenty seconds therefore shifts the assigned B reading by twenty seconds while leaving both elapsed legs unchanged.",
      },
      tool: "foundation:bridge-sum-average",
      premiseRefs: [reconstruction("sr-synchronization-halve-round-trip")],
      sourceAnchor: "sr-synchronization-source-algebra",
      isMove: false,
    },
  ],
};

export const srSynchronizationMetadata = {
  paper: "special-relativity",
  argument: "arg-sr-synchronization",
  ownerBeadId: "am-srk-equations-30cq",
  review: "draft",
  modelStatus: "exact-within-model",
} as const;

export const srSynchronizationHistoricalReading = {
  r3: "Einstein’s §1 explicitly defines the equality of the two assigned light-travel times before discussing its consistency for many clocks. This pedagogical reconstruction expands the algebraic consequence of that definition; it does not claim to reproduce unprinted intermediate work. The source writes A’s return reading with a prime. Here it is labelled return so that a prime is not mistaken for a moving-frame coordinate. A single round trip does not independently measure the two one-way durations, and the algebra does not establish the separate consistency assumptions for an entire clock network. These explanations remain authored drafts, without a historical or physics review certification.",
  r3Citations: [
    "Einstein, A. (1905). Zur Elektrodynamik bewegter Körper. Annalen der Physik 17, 891–921, §1, pp. 893–895. Source anchors s1-p7, eq-s1-d1 and s1-p8; the midpoint form is reused explicitly in §3, eq-s3-d1.",
  ],
} as const;

export function srSynchronizationReadingSet(step: DerivationStep) {
  return { ...step.reasons, ...srSynchronizationHistoricalReading };
}

export const srSynchronizationSourceLinks = [
  {
    id: "sr-synchronization-source-definition",
    anchor: "s1-p7",
    label: "Section 1: the paragraph that defines a common time at A and B",
  },
  {
    id: "sr-synchronization-source-algebra",
    anchor: "eq-s1-d1",
    label: "Section 1: the printed equal-leg criterion whose consequence is expanded here",
  },
] as const;
