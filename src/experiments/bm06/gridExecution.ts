/**
 * The optional grid's own execution label (am-frankensim-repin-and-bind-jvhg).
 *
 * BM-06's instrument label describes its primary output, the analytic density, which is always a
 * host calculation. The grid beside it can be stepped by FrankenSim's compiled
 * diffusion1d_frames, so it carries a label of its own, earned by the owner this accepted
 * snapshot's gridDensity names. Nothing here can see whether a module is loaded: a worker that
 * loaded FrankenSim and stepped the grid with the host reference publishes the host's owner, and
 * the grid is labelled a host calculation.
 */
import { deriveExecutionStateKind, type ExecutionStateKind } from "../provenance/executionState.ts";
import { BM06_FRANKENSIM_GRID_OWNER } from "./definition.ts";

type Output = Readonly<{ quantityId: string; ownerId: string; status: string }>;

/** Who stepped this snapshot's grid, or null when it has no stepped grid. */
export function gridOwner(outputs: readonly Output[] | undefined): string | null {
  const grid = outputs?.find((o) => o.quantityId === "gridDensity");
  return grid?.status === "value" ? grid.ownerId : null;
}

export function gridExecutionKind(
  outputs: readonly Output[] | undefined,
  isStatic: boolean,
): ExecutionStateKind | null {
  const owner = gridOwner(outputs);
  if (owner === null) return null;
  return deriveExecutionStateKind({
    isStatic,
    isUnavailable: false,
    primaryOutputs: [
      {
        outputId: "gridDensity",
        ownerKind: owner === BM06_FRANKENSIM_GRID_OWNER ? "frankensim" : "host-reference",
        acceptedThisSnapshot: true,
      },
    ],
  });
}
