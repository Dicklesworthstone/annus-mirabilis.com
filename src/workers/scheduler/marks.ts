/**
 * Performance marks and timing probes for the Annus Mirabilis worker scheduler.
 *
 * Marks:
 * - `am:input`: Emitted at command dispatch.
 * - `am:accepted`: Emitted at snapshot publication.
 * - `am:painted`: Emitted after the frame that commits a new snapshotVersion.
 *
 * All marks carry { instanceId, actionIndex, snapshotVersion } in their detail payload.
 *
 * Spec: AGENTS.md §6.2, §15.4, §15.5, and am-rt-worker-scheduler-7tl
 */

export interface SchedulerMarkDetail {
  readonly instanceId: string;
  readonly actionIndex: number;
  readonly snapshotVersion: number;
  readonly timestamp?: number | undefined;
}

function hasPerformance(): boolean {
  return typeof performance !== "undefined" && typeof performance.mark === "function";
}

export function markInput(instanceId: string, actionIndex: number, snapshotVersion = 0): void {
  if (!hasPerformance()) return;
  try {
    performance.mark("am:input", {
      detail: {
        instanceId,
        actionIndex,
        snapshotVersion,
        timestamp: performance.now(),
      },
    });
  } catch {
    // Older environments without mark detail option
    try {
      performance.mark(`am:input:${instanceId}:${actionIndex}`);
    } catch {
      /* Fallback ignored */
    }
  }
}

export function markAccepted(
  instanceId: string,
  actionIndex: number,
  snapshotVersion: number,
): void {
  if (!hasPerformance()) return;
  try {
    performance.mark("am:accepted", {
      detail: {
        instanceId,
        actionIndex,
        snapshotVersion,
        timestamp: performance.now(),
      },
    });
  } catch {
    try {
      performance.mark(`am:accepted:${instanceId}:${actionIndex}`);
    } catch {
      /* Fallback ignored */
    }
  }
}

export function markPainted(
  instanceId: string,
  actionIndex: number,
  snapshotVersion: number,
): void {
  if (!hasPerformance()) return;
  try {
    performance.mark("am:painted", {
      detail: {
        instanceId,
        actionIndex,
        snapshotVersion,
        timestamp: performance.now(),
      },
    });
  } catch {
    try {
      performance.mark(`am:painted:${instanceId}:${actionIndex}`);
    } catch {
      /* Fallback ignored */
    }
  }
}

export function measureInputToAccepted(
  instanceId: string,
  actionIndex: number,
): PerformanceMeasure | null {
  if (!hasPerformance() || typeof performance.measure !== "function") return null;
  try {
    return performance.measure(
      `am:input-to-accepted:${instanceId}:${actionIndex}`,
      "am:input",
      "am:accepted",
    );
  } catch {
    return null;
  }
}

export function measureInputToPainted(
  instanceId: string,
  actionIndex: number,
): PerformanceMeasure | null {
  if (!hasPerformance() || typeof performance.measure !== "function") return null;
  try {
    return performance.measure(
      `am:input-to-painted:${instanceId}:${actionIndex}`,
      "am:input",
      "am:painted",
    );
  } catch {
    return null;
  }
}
