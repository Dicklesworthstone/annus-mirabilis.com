/**
 * The intervention publication gate (am-read-misconception-callouts-a3o): "The publication gate
 * fails a production or preview build for an entry whose intervention has no covering accepted
 * review record ... Draft builds render the entry with a visible marker."
 *
 * Composed from the real review-record types (src/content/schemas/review.ts) -- this is not a
 * second review-record system. It never sets `reviewRecordId` (that is a human judgment,
 * AGENTS.md's sense of the term) and never accepts or rejects a record itself; it only checks
 * whether the record an entry already names covers what the entry needs covered.
 */
import type { Misconception } from "../../content/schemas/argument.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { InterventionStatus } from "./MisconceptionCallout.tsx";

export type BuildProfile = "production" | "preview" | "draft";

export type GateVerdict =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code:
        | "intervention-review-record-not-found"
        | "intervention-review-record-not-accepted"
        | "intervention-review-record-stale";
      message: string;
      misconceptionId: string;
      instrumentId?: string | undefined;
    }>;

/**
 * `instrumentManifestRevision` is the instrument manifest's own current revision (a plain
 * caller-supplied value, e.g. a content hash or version number) -- "the same record covering the
 * entry but not the instrument manifest's current revision fails, so a changed default forces a
 * re-review." A `staticTreatment` entry has no instrument, so no manifest revision is required.
 */
export function checkIntervention(
  misconception: Misconception,
  records: readonly ReviewRecord[],
  instrumentManifestRevision?: string | number,
): GateVerdict {
  const { intervention } = misconception;
  const record = records.find((r) => r.id === intervention.reviewRecordId);

  if (!record) {
    return {
      ok: false,
      code: "intervention-review-record-not-found",
      message: `Misconception "${misconception.id}" names reviewRecordId "${intervention.reviewRecordId}", which does not resolve to any review record.`,
      misconceptionId: misconception.id,
      instrumentId: intervention.instrumentId,
    };
  }

  if (record.result !== "accepted" && record.result !== "accepted-with-changes") {
    return {
      ok: false,
      code: "intervention-review-record-not-accepted",
      message: `Misconception "${misconception.id}"'s review record "${record.id}" has result "${record.result}", not accepted.`,
      misconceptionId: misconception.id,
      instrumentId: intervention.instrumentId,
    };
  }

  const coversEntry = record.scope.some((s) => s.recordId === misconception.id);
  if (!coversEntry) {
    return {
      ok: false,
      code: "intervention-review-record-stale",
      message: `Misconception "${misconception.id}"'s review record "${record.id}" does not name it in scope[].`,
      misconceptionId: misconception.id,
      instrumentId: intervention.instrumentId,
    };
  }

  if (intervention.instrumentId && instrumentManifestRevision !== undefined) {
    const instrumentScope = record.scope.find((s) => s.recordId === intervention.instrumentId);
    const covered =
      instrumentScope &&
      (instrumentScope.contentRevision === instrumentManifestRevision ||
        instrumentScope.modelVersion === instrumentManifestRevision);
    if (!covered) {
      return {
        ok: false,
        code: "intervention-review-record-stale",
        message: `Misconception "${misconception.id}"'s review record "${record.id}" does not cover instrument "${intervention.instrumentId}" at its current manifest revision (${String(instrumentManifestRevision)}); a changed default forces a re-review.`,
        misconceptionId: misconception.id,
        instrumentId: intervention.instrumentId,
      };
    }
  }

  return { ok: true };
}

/** `production`/`preview` fail the build on a bad verdict; `draft` never fails -- the caller
 * renders the "not yet reviewed" marker (MisconceptionCallout's own job) instead. */
export function interventionBlocksBuild(verdict: GateVerdict, profile: BuildProfile): boolean {
  return !verdict.ok && profile !== "draft";
}

/**
 * Bridges a gate verdict to the status `MisconceptionCallout` renders. In `production`/`preview`
 * a bad verdict never reaches render (`interventionBlocksBuild` fails the build first); a caller
 * that renders anyway -- a `draft` build, or a preview of what production would show -- gets the
 * same "not yet reviewed" marker either way. One function connects the two, so no caller
 * re-derives the mapping by hand.
 */
export function interventionStatusForRender(verdict: GateVerdict): InterventionStatus {
  return verdict.ok ? { state: "reviewed" } : { state: "not-yet-reviewed" };
}
