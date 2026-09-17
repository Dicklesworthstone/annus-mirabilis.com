/**
 * The result weave's data contract (am-read-result-weave-jex): instruments light the German
 * and English sentences that state what they are currently demonstrating. Ported concept, not
 * module, from the donor's spec-clause weave (src/reader/weave/predicates.ts,
 * am-scaf-extract-runtime-utilities-99y): here predicates belong to instruments, are evaluated
 * host-side from accepted snapshots, and target content ids, never patent kernels.
 *
 * "The highlight is a pointer, not a claim that truth has been achieved."
 */

/** What kind of pointer a lit sentence is. Not four confidence levels: they answer different
 * questions, and `agreement-within-stated-bound` is not "stronger than" `assumption-active`. */
export const WEAVE_MEANINGS = [
  "assumption-active",
  "quantity-compared",
  "agreement-within-stated-bound",
  "outside-selected-domain",
] as const;
export type WeaveMeaning = (typeof WEAVE_MEANINGS)[number];

export const BOUND_FAMILIES = ["dkw", "owner-band"] as const;
export type BoundFamily = (typeof BOUND_FAMILIES)[number];

export type ThresholdDirection = "at-least" | "at-most";

/** One output's typed value, as read from an accepted snapshot -- exactly the shape this
 * evaluator is allowed to depend on. It never recomputes a sample statistic: a `value` here is
 * whatever the instrument's worker-side owner already published. */
export type SnapshotOutput = Readonly<{
  quantityId: string;
  status:
    | "value"
    | "outside-domain"
    | "not-applicable"
    | "analytic-limit"
    | "symbolic"
    | "underdetermined"
    | "divergent";
  /** A classification output (for a `regime` condition) carries a string; a numeric output
   * (for `threshold` or `agreement`) carries a number. */
  value?: number | string | undefined;
}>;

/** The slice of an accepted snapshot the weave is allowed to read. */
export type WeaveSnapshotView = Readonly<{
  runId: string;
  snapshotVersion: number;
  constantSetId?: string | undefined;
  outputs: Readonly<Record<string, SnapshotOutput>>;
  /** True when the store's view carries a typed request refusal against these settings; every
   * predicate stays unlit while a refusal stands (am-rt-typed-results-mqb owns the chrome). */
  refused: boolean;
}>;

export type ThresholdCondition = Readonly<{
  kind: "threshold";
  quantityId: string;
  direction: ThresholdDirection;
  enter: number;
  exit: number;
}>;

export type RegimeCondition = Readonly<{
  kind: "regime";
  /** Either a classification output's quantity id, or the literal token "constantSet" to read
   * the accepted snapshot's own constant-set id. */
  on: string;
  equals: string;
}>;

export type StatusCondition = Readonly<{
  kind: "status";
  quantityId: string;
  equals: SnapshotOutput["status"];
}>;

export type AgreementCondition = Readonly<{
  kind: "agreement";
  /** The sample statistic output being compared to the model. */
  statisticQuantityId: string;
  /** The output naming how many samples went into the statistic. */
  sampleCountQuantityId: string;
  minimumSampleSize: number;
  boundFamily: BoundFamily;
  enterAlpha: number;
  exitAlpha: number;
  /** dkw only: an optional named output added to the DKW bound exactly (BM-05's shape term). */
  offsetQuantityId?: string | undefined;
  /** owner-band only: the outputs the instrument publishes for the band itself. */
  lowerBoundQuantityId?: string | undefined;
  upperBoundQuantityId?: string | undefined;
}>;

export type WeaveCondition =
  | ThresholdCondition
  | RegimeCondition
  | StatusCondition
  | AgreementCondition;

export type WeavePredicate = Readonly<{
  id: string;
  instrumentId: string;
  meaning: WeaveMeaning;
  /** All-of composition: the predicate enters when every condition holds. */
  conditions: readonly WeaveCondition[];
  targets: readonly string[];
  pointerText: string;
}>;

export type ConditionState = "enter" | "hold" | "exit" | "not-evaluable";

export type WeaveFlag = Readonly<{
  predicateId: string;
  meaning: WeaveMeaning;
  lit: boolean;
  state: ConditionState;
  pointerText: string;
  targets: readonly string[];
}>;

/** Frozen into the published snapshot with its snapshotVersion (am-rt-snapshot-store-aft's
 * publication path). Keyed by predicate id. */
export type WeaveDerived = Readonly<{
  runId: string;
  snapshotVersion: number;
  flags: Readonly<Record<string, WeaveFlag>>;
}>;
