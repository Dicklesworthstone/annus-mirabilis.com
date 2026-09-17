/**
 * Planted Recomputing View Fixture (am-inst-2d-view-kit-u75r).
 *
 * A deliberately defective component, planted to prove that the View Kit audit
 * and runtime contracts catch components recomputing physical quantities locally
 * instead of reading them from the accepted snapshot.
 *
 * DEFECTS:
 * 1. Private useState copy of a parameter (localD).
 * 2. Independent local recomputation of diffusion quantities (2 * localD * t).
 */

import { type ReactElement, useState } from "react";

export interface PlantedRecomputingViewProps {
  readonly D: number;
  readonly t: number;
  readonly acceptedMeanSquareDisplacement: number;
}

export function PlantedRecomputingView({
  D,
  t,
  acceptedMeanSquareDisplacement,
}: PlantedRecomputingViewProps): ReactElement {
  // DEFECT 1: Private useState parameter copy
  const [localD] = useState<number>(D);

  // DEFECT 2: Independent local physics recomputation
  const recomputedMSD = 2 * localD * t;
  const recomputedRms = Math.sqrt(2 * localD * t);

  return (
    <div
      className="planted-recomputing-view"
      data-recomputed-msd={recomputedMSD}
      data-recomputed-rms={recomputedRms}
      data-accepted-msd={acceptedMeanSquareDisplacement}
    >
      <span className="recomputed-value">{recomputedMSD}</span>
      <span className="accepted-value">{acceptedMeanSquareDisplacement}</span>
    </div>
  );
}
