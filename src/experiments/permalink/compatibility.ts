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
      notice: `${def.message} Recorded under "${tape.modelIdentity.modelId}@v${tape.modelIdentity.modelVersion}"; current is "${env.modelId}@v${env.modelVersion}".`,
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
      notice: `${def.message} Recorded with stream generator version ${tape.streamVersion}; current is ${env.streamVersion}.`,
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
  if (tape.replayGrid && env.replayGrid) {
    if (
      tape.replayGrid.baseSpacing !== env.replayGrid.baseSpacing ||
      tape.replayGrid.horizon !== env.replayGrid.horizon
    ) {
      const def = refusalCodeRegistry["tape-grid-mismatch"];
      return {
        compatible: false,
        refusalCode: "tape-grid-mismatch",
        notice: `${def.message} Recorded on grid (spacing: ${tape.replayGrid.baseSpacing}, horizon: ${tape.replayGrid.horizon}); current is (spacing: ${env.replayGrid.baseSpacing}, horizon: ${env.replayGrid.horizon}).`,
        repair: def.repair,
        tapeIdentity: tape.replayGrid,
        currentIdentity: env.replayGrid,
        offerNewRun: true,
      };
    }
  }

  return { compatible: true };
}
