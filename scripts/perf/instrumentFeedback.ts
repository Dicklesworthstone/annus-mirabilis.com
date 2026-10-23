export interface PerformanceMarkRecord {
  name: string;
  startTime: number;
  detail: {
    instanceId: string;
    actionIndex: number;
    snapshotVersion?: number;
    acceptedSnapshotVersion?: number;
    status?: "pending" | "accepted" | "superseded";
    reason?: string;
  };
}

export interface ActionFeedbackMeasurement {
  instanceId: string;
  actionIndex: number;
  acceptedSnapshotVersion: number;
  inputStartTime: number;
  acceptedStartTime: number;
  paintedStartTime: number;
  inputToAcceptedMs: number;
  acceptedToPaintedMs: number;
  totalFeedbackMs: number;
  overBudget: boolean;
}

export interface SupersededActionExclusion {
  instanceId: string;
  actionIndex: number;
  reason: string;
}

export interface InstrumentFeedbackEvaluation {
  actions: readonly ActionFeedbackMeasurement[];
  supersededExclusions: readonly SupersededActionExclusion[];
  overBudget: boolean;
  maxFeedbackMs: number;
  budgetMs: number;
}

export const INSTRUMENT_FEEDBACK_BUDGET_MS = 100;

/**
 * Matches and calculates instrument parameter feedback latency:
 * - Matches am:input, am:accepted, am:painted by instanceId, actionIndex, and snapshotVersion.
 * - Superseded actions are excluded with their recorded reason.
 * - A pending-state paint (status === 'pending' or mismatched snapshotVersion) never counts.
 * - Reports split into inputToAcceptedMs and acceptedToPaintedMs.
 * - Fails if totalFeedbackMs exceeds 100 ms.
 */
export function evaluateInstrumentFeedback(
  marks: readonly PerformanceMarkRecord[],
  budgetMs: number = INSTRUMENT_FEEDBACK_BUDGET_MS,
): InstrumentFeedbackEvaluation {
  const inputMarks = new Map<string, PerformanceMarkRecord>();
  const acceptedMarks = new Map<string, PerformanceMarkRecord>();
  const paintedMarks = new Map<string, PerformanceMarkRecord[]>();
  const supersededExclusions: SupersededActionExclusion[] = [];

  for (const mark of marks) {
    const key = `${mark.detail.instanceId}:${mark.detail.actionIndex}`;

    if (mark.name === "am:input") {
      inputMarks.set(key, mark);
    } else if (mark.name === "am:accepted") {
      if (mark.detail.status === "superseded") {
        supersededExclusions.push({
          instanceId: mark.detail.instanceId,
          actionIndex: mark.detail.actionIndex,
          reason: mark.detail.reason || "superseded by newer action",
        });
      } else {
        acceptedMarks.set(key, mark);
      }
    } else if (mark.name === "am:painted") {
      // Pending state paint never counts
      if (mark.detail.status === "pending") {
        continue;
      }
      const existing = paintedMarks.get(key) ?? [];
      existing.push(mark);
      paintedMarks.set(key, existing);
    }
  }

  const measurements: ActionFeedbackMeasurement[] = [];
  let maxFeedbackMs = 0;

  for (const [key, acceptedMark] of acceptedMarks.entries()) {
    const inputMark = inputMarks.get(key);
    if (!inputMark) continue;

    const acceptedVersion =
      acceptedMark.detail.acceptedSnapshotVersion ?? acceptedMark.detail.snapshotVersion;
    if (acceptedVersion === undefined) continue;

    const candidatePaints = paintedMarks.get(key) ?? [];
    // Match first am:painted whose snapshotVersion is the accepted snapshot for that action
    const matchingPaint = candidatePaints.find((p) => p.detail.snapshotVersion === acceptedVersion);
    if (!matchingPaint) continue;

    const inputToAcceptedMs = Number((acceptedMark.startTime - inputMark.startTime).toFixed(2));
    const acceptedToPaintedMs = Number(
      (matchingPaint.startTime - acceptedMark.startTime).toFixed(2),
    );
    const totalFeedbackMs = Number((matchingPaint.startTime - inputMark.startTime).toFixed(2));

    if (totalFeedbackMs > maxFeedbackMs) {
      maxFeedbackMs = totalFeedbackMs;
    }

    measurements.push({
      instanceId: acceptedMark.detail.instanceId,
      actionIndex: acceptedMark.detail.actionIndex,
      acceptedSnapshotVersion: acceptedVersion,
      inputStartTime: inputMark.startTime,
      acceptedStartTime: acceptedMark.startTime,
      paintedStartTime: matchingPaint.startTime,
      inputToAcceptedMs,
      acceptedToPaintedMs,
      totalFeedbackMs,
      overBudget: totalFeedbackMs > budgetMs,
    });
  }

  const isOverBudget = measurements.some((m) => m.overBudget);

  return {
    actions: measurements,
    supersededExclusions,
    overBudget: isOverBudget,
    maxFeedbackMs,
    budgetMs,
  };
}

/** One laboratory's evaluation, kept beside the route so a failure can name a page. */
export interface RouteFeedback {
  readonly route: string;
  readonly evaluation: InstrumentFeedbackEvaluation;
}

export interface AggregatedInstrumentFeedback {
  readonly maxFeedbackMs: number;
  readonly actionsMeasured: number;
  readonly instrumentsOperated: number;
  readonly supersededExcluded: number;
  readonly budgetMs: number;
  readonly overBudget: boolean;
  readonly worstRoute: string;
}

/**
 * Folds several laboratories' evaluations into the one artifact row, or `null` when no action was
 * measured anywhere (am-snn0).
 *
 * THE NULL IS THE POINT, and it is here rather than inside the browser driver so that it can be
 * tested without a browser. `evaluateInstrumentFeedback` over marks that join nothing returns
 * `{ actions: [], maxFeedbackMs: 0, overBudget: false }` -- a passing verdict over an empty
 * population, which is precisely what a real browser run produced for as long as `markPainted` had
 * no caller. Summing that across five laboratories gives `0 ms, within a 100 ms budget` and reads
 * like the best possible result. So an aggregate with no action is not a row at all: the driver
 * omits it, the artifact validator refuses it if it appears anyway, and the harness reports
 * `not-available`, which is true.
 *
 * `instrumentsOperated` counts laboratories that produced at least one measured action, not
 * laboratories visited, because one instrument answering while four refuse is invisible in the
 * action count alone.
 */
export function aggregateInstrumentFeedback(
  perRoute: readonly RouteFeedback[],
): AggregatedInstrumentFeedback | null {
  let maxFeedbackMs = 0;
  let actionsMeasured = 0;
  let instrumentsOperated = 0;
  let supersededExcluded = 0;
  let overBudget = false;
  let worstRoute = "";
  // The budget belongs to the evaluator, so it is read from an evaluation rather than restated
  // here; a default would let a wrong budget travel in the artifact as if it were the method's.
  let budgetMs = INSTRUMENT_FEEDBACK_BUDGET_MS;
  for (const { route, evaluation } of perRoute) {
    supersededExcluded += evaluation.supersededExclusions.length;
    budgetMs = evaluation.budgetMs;
    if (evaluation.actions.length === 0) continue;
    instrumentsOperated += 1;
    actionsMeasured += evaluation.actions.length;
    if (evaluation.overBudget) overBudget = true;
    if (evaluation.maxFeedbackMs > maxFeedbackMs) {
      maxFeedbackMs = evaluation.maxFeedbackMs;
      worstRoute = route;
    }
  }
  if (actionsMeasured === 0) return null;
  return {
    maxFeedbackMs,
    actionsMeasured,
    instrumentsOperated,
    supersededExcluded,
    budgetMs,
    overBudget,
    worstRoute,
  };
}
