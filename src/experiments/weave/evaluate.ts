/**
 * Ties conditions + hysteresis into WeaveFlag records (am-read-result-weave-jex). Pure, host
 * side. A typed refusal leaves every predicate unlit and not-evaluable; a refusal is not a
 * scientific pointer and the weave never narrates one -- the refusal chrome speaks instead.
 */
import { createHysteresisTracker } from "./hysteresis.ts";
import type {
  ConditionState,
  WeaveDerived,
  WeaveFlag,
  WeavePredicate,
  WeaveSnapshotView,
} from "./types.ts";

export type WeaveEvaluator = ReturnType<typeof createWeaveEvaluator>;

export function createWeaveEvaluator(predicates: readonly WeavePredicate[]) {
  const tracker = createHysteresisTracker();
  const conditionsById = new Map(predicates.map((p) => [p.id, p.conditions] as const));
  const predicateById = new Map(predicates.map((p) => [p.id, p] as const));

  return {
    /** Evaluates every predicate for this accepted snapshot, returning the flags to freeze into
     * it. Never mutates the snapshot; the caller (a publication hook) attaches the result. */
    evaluate(snapshot: WeaveSnapshotView): WeaveDerived {
      const flags: Record<string, WeaveFlag> = {};
      if (snapshot.refused) {
        for (const predicate of predicates) {
          flags[predicate.id] = Object.freeze({
            predicateId: predicate.id,
            meaning: predicate.meaning,
            lit: false,
            state: "not-evaluable" as ConditionState,
            pointerText: predicate.pointerText,
            targets: predicate.targets,
          });
        }
        return Object.freeze({
          runId: snapshot.runId,
          snapshotVersion: snapshot.snapshotVersion,
          flags: Object.freeze(flags),
        });
      }

      const results = tracker.advance(conditionsById, snapshot);
      for (const predicate of predicates) {
        const result = results.get(predicate.id);
        flags[predicate.id] = Object.freeze({
          predicateId: predicate.id,
          meaning: predicate.meaning,
          lit: result?.lit ?? false,
          state: result?.state ?? "not-evaluable",
          pointerText: predicate.pointerText,
          targets: predicate.targets,
        });
      }
      return Object.freeze({
        runId: snapshot.runId,
        snapshotVersion: snapshot.snapshotVersion,
        flags: Object.freeze(flags),
      });
    },
    reset(): void {
      tracker.reset();
    },
    predicateFor(id: string): WeavePredicate | undefined {
      return predicateById.get(id);
    },
  };
}
