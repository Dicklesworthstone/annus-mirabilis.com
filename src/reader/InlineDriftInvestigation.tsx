"use client";

import { DriftDiffusionLab } from "../components/lab/DriftDiffusionLab.tsx";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import type { PreparedBm04Example } from "../experiments/bm04/session.ts";
import prepared from "../generated/bm04-example.json";

/** The laboratory owns its accepted session; this placement never borrows the reader's URL state. */
export default function InlineDriftInvestigation() {
  return (
    <>
      <LocalPredictions />
      <DriftDiffusionLab
        example={prepared as PreparedBm04Example}
        restoreFromLocation={false}
        highlightPaper
      />
    </>
  );
}
