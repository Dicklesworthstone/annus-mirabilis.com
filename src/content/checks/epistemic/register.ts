/**
 * Register epistemic rejections and flags (am-cm-checks-epistemic-o7n).
 */

import { type ContentCheck, registerCheck } from "../../compiler/checks/registry.ts";
import {
  EPISTEMIC_BEAD_ID,
  runApproximationUnlabeled,
  runCircularMolecularCount,
  runCircularRestEnergy,
  runCoverageWithoutOwner,
  runFlags,
  runLaterEvidenceUnlabeled,
  runMisconceptionMinimum,
  runMissingAccessibility,
  runMissingNotModeled,
  runOracleInHistoricalRoute,
  runProofCycle,
  runShelfDate,
  runSimulationAsEvidence,
} from "./run.ts";

function errorCheck(id: string, description: string, run: ContentCheck["run"]): ContentCheck {
  return {
    id,
    family: "epistemic",
    severity: "error",
    beadId: EPISTEMIC_BEAD_ID,
    description,
    run,
  };
}

export const EPISTEMIC_CHECKS: readonly ContentCheck[] = Object.freeze([
  errorCheck(
    "epistemic.proof-cycle",
    "Selected proofs must be acyclic on derivation and proof-edge premises.",
    runProofCycle,
  ),
  errorCheck(
    "epistemic.oracle-in-historical-route",
    "source-order and discovery proofs may not use modern-verification-oracle as a derivation premise.",
    runOracleInHistoricalRoute,
  ),
  errorCheck(
    "epistemic.shelf-date-violation",
    "Discovery shelf, chain, fork, and move stages obey the 1904 cutoff.",
    runShelfDate,
  ),
  errorCheck(
    "epistemic.later-evidence-unlabeled",
    "Post-1904 evidence and world-checks must carry a date label and a quantity id.",
    runLaterEvidenceUnlabeled,
  ),
  errorCheck(
    "epistemic.missing-accessibility-alternative",
    "Instruments, canvas/Three.js views, and foundations need textual equivalents.",
    runMissingAccessibility,
  ),
  errorCheck(
    "epistemic.missing-not-modeled",
    "Every experiment manifest must declare a non-empty notModeled list.",
    runMissingNotModeled,
  ),
  errorCheck(
    "epistemic.coverage-without-owner",
    "Instrument treatment needs a resolvable experiment owner and a correspondence note when shared.",
    runCoverageWithoutOwner,
  ),
  errorCheck(
    "epistemic.misconception-minimum",
    "A declared or complete misconception ledger has at least five entries.",
    runMisconceptionMinimum,
  ),
  errorCheck(
    "epistemic.approximation-unlabeled",
    "Approximations in authoring contracts and equation modelStatus must agree.",
    runApproximationUnlabeled,
  ),
  errorCheck(
    "epistemic.circular-molecular-count",
    "Historical molecular-number inference must not resolve modern exact k_B or N_A.",
    runCircularMolecularCount,
  ),
  errorCheck(
    "epistemic.circular-rest-energy",
    "Historical mass-energy body energy must stay symbolic, not Mc^2.",
    runCircularRestEnergy,
  ),
  errorCheck(
    "epistemic.simulation-as-evidence",
    "empirical-observation nodes may not be supported by a simulator output.",
    runSimulationAsEvidence,
  ),
  {
    id: "epistemic.flags",
    family: "epistemic",
    severity: "flag",
    beadId: EPISTEMIC_BEAD_ID,
    description:
      "Translation alternatives, influence claims, approximation prose, and source disagreements are flagged, never auto-resolved.",
    run: runFlags,
  },
]);

export function registerEpistemicChecks(): void {
  for (const check of EPISTEMIC_CHECKS) {
    registerCheck(check);
  }
}

registerEpistemicChecks();
