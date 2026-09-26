/**
 * BM-05's execution label, earned by who drew this snapshot's walk (dispatch 269).
 *
 * A Gaussian walk's steps can be drawn by FrankenSim's compiled philox_normals. The walk is then
 * FrankenSim's, and the host sums the draws and reduces them into every statistic. The primary
 * output is the recorded positions (walkPositions), and its owner is the one the draws carried,
 * so a worker that loaded the module and drew with the host reference still reads as a host
 * calculation. A coin or uniform walk draws no normals and is always the host's.
 */
import { deriveExecutionStateKind, type ExecutionStateKind } from "../provenance/executionState.ts";
import { BM05_FRANKENSIM_DRAW_OWNER } from "./definition.ts";

type Output = Readonly<{ quantityId: string; ownerId: string; status: string }>;

export function walkExecutionKind(
  outputs: readonly Output[] | undefined,
  isStatic: boolean,
): ExecutionStateKind {
  const positions = outputs?.find((o) => o.quantityId === "walkPositions");
  return deriveExecutionStateKind({
    isStatic,
    isUnavailable: false,
    primaryOutputs: positions
      ? [
          {
            outputId: "walkPositions",
            ownerKind:
              positions.ownerId === BM05_FRANKENSIM_DRAW_OWNER ? "frankensim" : "host-reference",
            acceptedThisSnapshot: positions.status === "value",
          },
        ]
      : [],
  });
}
