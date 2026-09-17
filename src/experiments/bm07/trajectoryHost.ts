import {
  independentModelAdmission,
  estimateIncrements,
  estimatorInterval,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { analyzeTrajectory, type TrajectoryAssumptions } from "./trajectoryAnalysis.ts";
import type { ImportedTrajectory } from "./trajectoryCsv.ts";

const reference = {
  independentModelAdmission,
  estimateIncrements,
  estimatorInterval,
  invertToMolecularNumber,
};
export function analyzeImportedTrajectory(
  trajectory: ImportedTrajectory,
  assumptions: TrajectoryAssumptions,
) {
  return analyzeTrajectory(trajectory, assumptions, reference, () =>
    getConstantSet("modern-si-2019"),
  );
}
