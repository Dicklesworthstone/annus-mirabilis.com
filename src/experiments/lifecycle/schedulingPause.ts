import type { VisibilityControlledSession } from "./bindLaboratoryVisibility.ts";

/** The pause already chosen by a laboratory's visibility owner, without another DOM listener. */
export interface SchedulingPauseSource extends VisibilityControlledSession {
  getSchedulingPaused(): boolean;
  subscribeSchedulingPause(listener: () => void): () => void;
}

export function createSchedulingPause(apply: (paused: boolean) => void): SchedulingPauseSource {
  let paused = false;
  const listeners = new Set<() => void>();
  return Object.freeze({
    getSchedulingPaused: () => paused,
    subscribeSchedulingPause(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSchedulingPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      apply(next);
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          /* A detached consumer cannot change the owner's pause. */
        }
      }
    },
  });
}

/** A private checkpoint trial follows only the explicit session that owns its restoration. */
export function inheritSchedulingPause(
  owner: SchedulingPauseSource,
  trial: VisibilityControlledSession,
): () => void {
  const update = () => trial.setSchedulingPaused(owner.getSchedulingPaused());
  const unsubscribe = owner.subscribeSchedulingPause(update);
  update();
  return unsubscribe;
}
