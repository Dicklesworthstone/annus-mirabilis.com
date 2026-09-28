/**
 * Tape Compatibility Checker.
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc
 *
 * Compares decoded TapeV2 identities against the current runtime environment.
 * Any mismatch is refused with one of seven typed refusal codes and offers
 * a new run with the current model rather than silently reproducing under
 * a different model.
 */

import { refusalCodeRegistry } from "../results/refusalCodes.ts";
import type { ExperimentEnvironment, TapeCompatibilityRefusalCode, TapeV2 } from "./types.ts";

export type CompatibilityResult =
  | Readonly<{
      compatible: true;
    }>
  | Readonly<{
      compatible: false;
      refusalCode: TapeCompatibilityRefusalCode;
      notice: string;
      repair: string;
      tapeIdentity: unknown;
      currentIdentity: unknown;
      offerNewRun: true;
    }>;

export function checkTapeCompatibility(
  tape: TapeV2,
  env: ExperimentEnvironment,
): CompatibilityResult {
  // 1. Tape version
  if (tape.tapeVersion !== 2) {
    const def = refusalCodeRegistry["tape-version-unsupported"];
    return {
      compatible: false,
      refusalCode: "tape-version-unsupported",
      notice: `${def.message} Tape uses version ${tape.tapeVersion}; environment requires version 2.`,
      repair: def.repair,
      tapeIdentity: { tapeVersion: tape.tapeVersion },
      currentIdentity: { tapeVersion: 2 },
      offerNewRun: true,
    };
  }

  // 2. Model identity (modelId & modelVersion)
  if (
    tape.modelIdentity.modelId !== env.modelId ||
    tape.modelIdentity.modelVersion !== env.modelVersion
  ) {
    const def = refusalCodeRegistry["tape-model-mismatch"];
    return {
      compatible: false,
      refusalCode: "tape-model-mismatch",
      notice: modelMismatchNotice(def.message, tape.modelIdentity, env),
      repair: def.repair,
      tapeIdentity: tape.modelIdentity,
      currentIdentity: { modelId: env.modelId, modelVersion: env.modelVersion },
      offerNewRun: true,
    };
  }

  // 3. Artifact digest
  if (
    tape.modelIdentity.artifactDigest &&
    env.artifactDigest &&
    tape.modelIdentity.artifactDigest !== env.artifactDigest
  ) {
    const def = refusalCodeRegistry["tape-artifact-mismatch"];
    return {
      compatible: false,
      refusalCode: "tape-artifact-mismatch",
      notice: `${def.message} Recorded under artifact "${tape.modelIdentity.artifactDigest}"; current is "${env.artifactDigest}".`,
      repair: def.repair,
      tapeIdentity: { artifactDigest: tape.modelIdentity.artifactDigest },
      currentIdentity: { artifactDigest: env.artifactDigest },
      offerNewRun: true,
    };
  }

  // 4. Constant set ID
  if (tape.constantSetId !== env.constantSetId) {
    const def = refusalCodeRegistry["tape-constant-set-mismatch"];
    return {
      compatible: false,
      refusalCode: "tape-constant-set-mismatch",
      notice: `${def.message} Recorded with constant set "${tape.constantSetId}"; current is "${env.constantSetId}".`,
      repair: def.repair,
      tapeIdentity: { constantSetId: tape.constantSetId },
      currentIdentity: { constantSetId: env.constantSetId },
      offerNewRun: true,
    };
  }

  // 5. Stream version
  if (tape.streamVersion !== env.streamVersion) {
    const def = refusalCodeRegistry["tape-stream-version-mismatch"];
    return {
      compatible: false,
      refusalCode: "tape-stream-version-mismatch",
      notice: streamVersionMismatchNotice(def.message, tape.streamVersion, env.streamVersion),
      repair: def.repair,
      tapeIdentity: { streamVersion: tape.streamVersion },
      currentIdentity: { streamVersion: env.streamVersion },
      offerNewRun: true,
    };
  }

  // 6. Allocation ID
  if (tape.allocationId !== env.allocationId) {
    const def = refusalCodeRegistry["tape-allocation-mismatch"];
    return {
      compatible: false,
      refusalCode: "tape-allocation-mismatch",
      notice: `${def.message} Recorded with stream allocation "${tape.allocationId}"; current is "${env.allocationId}".`,
      repair: def.repair,
      tapeIdentity: { allocationId: tape.allocationId },
      currentIdentity: { allocationId: env.allocationId },
      offerNewRun: true,
    };
  }

  // 7. Replay grid
  if (tape.replayGrid !== undefined || env.replayGrid !== undefined) {
    if (
      !tape.replayGrid ||
      !env.replayGrid ||
      tape.replayGrid.baseSpacing !== env.replayGrid.baseSpacing ||
      tape.replayGrid.horizon !== env.replayGrid.horizon
    ) {
      const def = refusalCodeRegistry["tape-grid-mismatch"];
      const tapeDesc = tape.replayGrid
        ? `spacing: ${tape.replayGrid.baseSpacing}, horizon: ${tape.replayGrid.horizon}`
        : "none";
      const envDesc = env.replayGrid
        ? `spacing: ${env.replayGrid.baseSpacing}, horizon: ${env.replayGrid.horizon}`
        : "none";
      return {
        compatible: false,
        refusalCode: "tape-grid-mismatch",
        notice: `${def.message} Recorded on grid (${tapeDesc}); current is (${envDesc}).`,
        repair: def.repair,
        tapeIdentity: tape.replayGrid,
        currentIdentity: env.replayGrid,
        offerNewRun: true,
      };
    }
  }

  return { compatible: true };
}

// NOTE ON PLACEMENT: this sits AFTER checkTapeCompatibility rather than above it, and the reason
// is the stale-citation ratchet. permalink.compatibility.test.ts cites this file by line, once
// per refusal site, and putting a 24-line docblock above the function shifted all fourteen of
// them. The ratchet's own instruction is that a citation is repointed only after planting at the
// new site, never by adding the drift, so the cheaper and more honest fix is to not move the
// lines. A hoisted function declaration reads the same from down here.

/**
 * WHEN A REFUSAL NAMES TWO VALUES THAT PRINT THE SAME (am-w3g8).
 *
 * The comparisons below are strict, and two of the fields they compare may be a number or a
 * string: a tape recorded with `streamVersion: 1` against a laboratory declaring `"1"` refuses
 * with "Recorded with stream generator version 1; current is 1." A reader of that notice, or an
 * author trying to fix the record, is told two identical things are different and given nothing
 * to act on.
 *
 * Measured cost, 2026-09-27: the same shape on modelVersion sent this session round a circle for
 * two commits, correcting a record to "1", being refused by a notice naming 1 and 1, then
 * unquoting it to 1 and being refused by the schema.
 *
 * This says what actually differs, and ONLY when the two print alike, so an ordinary mismatch
 * keeps its ordinary sentence.
 */
function sameOnPaper(recorded: unknown, current: unknown): string {
  if (String(recorded) !== String(current)) return "";
  return (
    ` Those are written the same and are not the same value: the tape's is a ${typeof recorded}` +
    ` and this laboratory's is a ${typeof current}.`
  );
}

/** The model-identity refusal's sentence, with the type note where the two versions print alike. */
function modelMismatchNotice(
  message: string,
  recorded: Readonly<{ modelId: string; modelVersion: number }>,
  current: Readonly<{ modelId: string; modelVersion: number }>,
): string {
  return (
    `${message} Recorded under "${recorded.modelId}@v${recorded.modelVersion}";` +
    ` current is "${current.modelId}@v${current.modelVersion}".` +
    sameOnPaper(recorded.modelVersion, current.modelVersion)
  );
}

/** The stream-version refusal's sentence, with the type note where the two print alike. */
function streamVersionMismatchNotice(
  message: string,
  recorded: number | string,
  current: number | string,
): string {
  return (
    `${message} Recorded with stream generator version ${recorded}; current is ${current}.` +
    sameOnPaper(recorded, current)
  );
}
