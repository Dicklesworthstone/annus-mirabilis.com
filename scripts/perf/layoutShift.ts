export interface LayoutShiftEntry {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
}

export interface LayoutShiftResult {
  maxSessionWindowScore: number;
  sessionWindowsCount: number;
  overBudget: boolean;
  budgetScore: number;
}

export const LAYOUT_SHIFT_BUDGET = 0.1;

/**
 * Computes Cumulative Layout Shift according to standard session windows:
 * - Excludes entries with hadRecentInput.
 * - Windows break if gap between adjacent entries is >= 1000 ms (1 s).
 * - Windows are capped at a maximum duration of 5000 ms (5 s).
 * - Reports the maximum window score across the session.
 * - Budget is 0.1.
 */
export function evaluateLayoutShift(
  entries: readonly LayoutShiftEntry[],
  budget: number = LAYOUT_SHIFT_BUDGET,
): LayoutShiftResult {
  const eligible = entries.filter((e) => !e.hadRecentInput);
  if (eligible.length === 0) {
    return {
      maxSessionWindowScore: 0,
      sessionWindowsCount: 0,
      overBudget: false,
      budgetScore: budget,
    };
  }

  let maxScore = 0;
  let currentWindowScore = 0;
  let windowStartTime = eligible[0].startTime;
  let prevEntryTime = eligible[0].startTime;
  let windowCount = 1;

  for (const entry of eligible) {
    const gap = entry.startTime - prevEntryTime;
    const windowDuration = entry.startTime - windowStartTime;

    // Gap of 1 s (1000 ms) or more, or window duration exceeding 5000 ms starts a new window
    if (gap >= 1000 || windowDuration > 5000) {
      if (currentWindowScore > maxScore) {
        maxScore = currentWindowScore;
      }
      windowCount++;
      windowStartTime = entry.startTime;
      currentWindowScore = entry.value;
    } else {
      currentWindowScore += entry.value;
    }

    prevEntryTime = entry.startTime;
    if (currentWindowScore > maxScore) {
      maxScore = currentWindowScore;
    }
  }

  const roundedScore = Number(maxScore.toFixed(4));
  return {
    maxSessionWindowScore: roundedScore,
    sessionWindowsCount: windowCount,
    overBudget: roundedScore > budget,
    budgetScore: budget,
  };
}
