"use client";

import { ElectronDynamicsLab } from "../components/lab/sr13/ElectronDynamicsLab.tsx";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import type { PreparedSr13Example } from "../experiments/sr13/session.ts";
import prepared from "../generated/sr13-example.json";

/** The laboratory owns its accepted session; this placement never borrows the reader's URL state. */
export default function InlineElectronInvestigation() {
  return (
    <>
      <LocalPredictions />
      <ElectronDynamicsLab
        example={prepared as PreparedSr13Example}
        restoreFromLocation={false}
        highlightPaper
      />
    </>
  );
}
