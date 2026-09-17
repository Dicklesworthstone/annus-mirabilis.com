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
    const matchingPaint = candidatePaints.find(
      (p) => p.detail.snapshotVersion === acceptedVersion,
    );
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
