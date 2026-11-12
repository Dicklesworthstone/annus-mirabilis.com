import { detectDeviceConcurrencyLimit } from "../../experiments/lifecycle/limits.ts";

/** Only idle workers whose accepted recording can be verified after reconstruction belong here. */
export interface WorkerRetention {
  retain(owner: object, retire: () => void): void;
  release(owner: object): void;
  readonly size: number;
}

export type WorkerRetentionPolicy = Readonly<{
  pool: WorkerRetention;
  /** A pure check that the current accepted result has a complete recording checkpoint. */
  canRetire(): boolean;
}>;

export class WorkerRetentionConfigurationError extends RangeError {
  readonly code = "invalid-worker-retention-limit";
}

/**
 * Bound idle recordings by least recent use. Active calculations remain owned by admission;
 * callers withdraw an idle worker before requesting execution. Removing an entry before its
 * callback makes reentrant cancellation or a newly completed peer independent of the old lease.
 */
export function createWorkerRetention(maxIdle: number): WorkerRetention {
  if (!Number.isSafeInteger(maxIdle) || maxIdle < 0)
    throw new WorkerRetentionConfigurationError(
      "Idle worker retention must be a nonnegative integer.",
    );
  const idle = new Map<object, () => void>();
  let trimming = false;

  function trim(): void {
    if (trimming) return;
    trimming = true;
    try {
      while (idle.size > maxIdle) {
        const oldest = idle.entries().next();
        if (oldest.done) break;
        const [owner, retire] = oldest.value;
        idle.delete(owner);
        try {
          retire();
        } catch {
          /* A failing owner's cleanup cannot prevent another idle worker from being reclaimed. */
        }
      }
    } finally {
      trimming = false;
    }
  }

  return Object.freeze({
    retain(owner: object, retire: () => void) {
      idle.delete(owner);
      idle.set(owner, retire);
      trim();
    },
    release(owner: object) {
      idle.delete(owner);
    },
    get size() {
      return idle.size;
    },
  });
}

let laboratoryRetention: WorkerRetention | null = null;

/** Applies only to owners that opt in with verified recording continuity, never arbitrary caches. */
export function sharedLaboratoryRetention(): WorkerRetention {
  laboratoryRetention ??= createWorkerRetention(
    detectDeviceConcurrencyLimit().maxConcurrentHeavyLabs,
  );
  return laboratoryRetention;
}
