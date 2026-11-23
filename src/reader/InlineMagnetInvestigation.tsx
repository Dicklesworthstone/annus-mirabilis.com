"use client";

import { MagnetConductorLab } from "../components/lab/MagnetConductorLab.tsx";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import type { PreparedSr02Example } from "../experiments/sr02/session.ts";
import prepared from "../generated/sr02-example.json";

/** The laboratory owns its accepted session; this placement never borrows the reader's URL state. */
export default function InlineMagnetInvestigation() {
  return (
    <>
      <LocalPredictions />
      <MagnetConductorLab
        example={prepared as PreparedSr02Example}
        restoreFromLocation={false}
      />
    </>
  );
}
