/**
 * Digest rules and checkpoint hashing for version 2 control tapes (am-rt-control-tapes-0gc).
 * Digested with scientificDigest (SHA-256 over Web Crypto) and written host:sha256:<hex>.
 * Host code never produces a digest labeled blake3.
 */
import {
  type DigestFields,
  type DigestKind,
  scientificDigest,
} from "../digest/scientificDigest.ts";
import type { U64String } from "../identity/u64.ts";
import type { CheckpointStreamPosition } from "./schema.ts";

export interface CheckpointDigestInput {
  readonly state: Readonly<Record<string, number>>;
  readonly actionIndex: number;
  readonly stepIndex: number;
  readonly simulatedTime: number;
  readonly seed: U64String | string;
  readonly streamPositions?: readonly CheckpointStreamPosition[] | undefined;
}

export type CheckpointDigestResult = Readonly<{
  digest: string;
  digestKind: DigestKind;
}>;

/**
 * Computes the canonical scientific digest for a tape checkpoint.
 * Presentation state is never included in the digest.
 */
export async function computeCheckpointDigest(
  input: CheckpointDigestInput,
): Promise<CheckpointDigestResult> {
  const fields: Record<string, unknown> = {
    actionIndex: input.actionIndex,
    stepIndex: input.stepIndex,
    simulatedTime: input.simulatedTime,
    seed: input.seed,
    state: input.state,
  };

  if (input.streamPositions && input.streamPositions.length > 0) {
    fields.streamPositions = input.streamPositions.map((sp) => ({
      allocationId: sp.allocationId,
      streamKernelId: sp.streamKernelId,
      tile: sp.tile,
      index: sp.index,
    }));
  }

  const result = await scientificDigest(fields as DigestFields);
  return Object.freeze({
    digest: result.digest,
    digestKind: result.digestKind,
  });
}

/**
 * Validates that a digest string matches its declared kind prefix.
 */
export function validateDigestPrefix(digest: string, digestKind: DigestKind): boolean {
  if (digestKind === "host") {
    return digest.startsWith("host:sha256:") && /^host:sha256:[0-9a-f]{64}$/.test(digest);
  }
  if (digestKind === "blake3") {
    return digest.startsWith("blake3:") && /^blake3:[0-9a-f]{64}$/.test(digest);
  }
  return false;
}
