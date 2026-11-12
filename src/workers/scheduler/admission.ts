import { detectDeviceConcurrencyLimit } from "../../experiments/lifecycle/limits.ts";

/** A reservation covers worker startup and one calculation, including cancellation acknowledgement. */
export interface WorkerAdmission {
  acquire(owner: object, start: () => void, failed: (error: unknown) => void): void;
  release(owner: object): void;
  readonly activeCount: number;
  readonly queuedCount: number;
}

export class WorkerAdmissionConfigurationError extends RangeError {
  readonly code = "invalid-worker-concurrency-limit";
}

/**
 * Bound work across independent laboratory owners. A waiting owner retains only its newest
 * request in its scheduler; this queue retains one callback per owner. Completing a calculation
 * releases its reservation before that owner's next request rejoins behind other laboratories.
 *
 * Do not use an LRU presentation pause as a substitute for this reservation: sending cancel or
 * hiding a view cannot interrupt an in-flight synchronous WASM call. Its owner releases only on
 * a final response or after terminating the worker.
 */
export function createWorkerAdmission(maxConcurrent: number): WorkerAdmission {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1)
    throw new WorkerAdmissionConfigurationError("Worker concurrency must be a positive integer.");
  const active = new Set<object>();
  const waiting = new Map<
    object,
    Readonly<{ start: () => void; failed: (error: unknown) => void }>
  >();
  let draining = false;

  function drain(): void {
    if (draining) return;
    draining = true;
    try {
      while (active.size < maxConcurrent && waiting.size > 0) {
        const next = waiting.entries().next();
        if (next.done) break;
        const [owner, job] = next.value;
        waiting.delete(owner);
        active.add(owner);
        try {
          job.start();
        } catch (error) {
          active.delete(owner);
          try {
            job.failed(error);
          } catch {
            /* An owner's failure handler cannot strand or fail another laboratory. */
          }
        }
      }
    } finally {
      draining = false;
    }
  }

  return Object.freeze({
    acquire(owner: object, start: () => void, failed: (error: unknown) => void) {
      if (active.has(owner)) return;
      waiting.set(owner, { start, failed });
      drain();
    },
    release(owner: object) {
      waiting.delete(owner);
      active.delete(owner);
      drain();
    },
    get activeCount() {
      return active.size;
    },
    get queuedCount() {
      return waiting.size;
    },
  });
}

let laboratoryAdmission: WorkerAdmission | null = null;

/** The actual laboratory factory shares one device budget; idle workers retain their recordings. */
export function sharedLaboratoryAdmission(): WorkerAdmission {
  laboratoryAdmission ??= createWorkerAdmission(
    detectDeviceConcurrencyLimit().maxConcurrentHeavyLabs,
  );
  return laboratoryAdmission;
}
