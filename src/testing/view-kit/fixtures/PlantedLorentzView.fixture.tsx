/**
 * Planted Lorentz Recomputing View Fixture (am-inst-2d-view-kit-u75r).
 *
 * A deliberately defective component, planted to prove that the View Kit audit
 * catches components recomputing transformed coordinates locally instead of reading
 * them from the accepted snapshot.
 *
 * DEFECTS:
 * 1. Private useState copy of velocity parameter.
 * 2. Independent local recomputation of transformed coordinates and Lorentz boost.
 */

import { type ReactElement, useState } from "react";

export interface PlantedLorentzViewProps {
  readonly x: number;
  readonly t: number;
  readonly v: number;
  readonly acceptedXPrime: number;
}

export function PlantedLorentzView({
  x,
  t,
  v,
  acceptedXPrime,
}: PlantedLorentzViewProps): ReactElement {
  // DEFECT 1: Private useState parameter copy
  const [localVelocity] = useState<number>(v);

  // DEFECT 2: Independent local recomputation of transformed coordinates
  const c = 299792458;
  const localXPrime = (x - localVelocity * t) / Math.sqrt(1 - (localVelocity * localVelocity) / (c * c));

  return (
    <div
      className="planted-lorentz-view"
      data-recomputed-x-prime={localXPrime}
      data-accepted-x-prime={acceptedXPrime}
    >
      <span>{localXPrime}</span>
    </div>
  );
}
