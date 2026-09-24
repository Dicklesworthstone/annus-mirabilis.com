"use client";
/**
 * The tracer ensemble as the Brownian reading embeds it, with its prepared worked example. This
 * module is only ever imported lazily, by LazyInlineTracerLab: the example is 144 KB of float64
 * tracer endpoints, and whatever a page imports statically is in its first-route JavaScript and,
 * as a client component's props, in its flight data too.
 */
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import type { PreparedBm01Example } from "../experiments/bm01/session.ts";
import tracerExample from "../generated/bm01-example.json";

export default function InlineTracerLab() {
  // The paper reader is the site's own route, so its gate remembers the reader's answers.
  return (
    <>
      <LocalPredictions />
      <TracerLab
        example={tracerExample as PreparedBm01Example}
        title="Investigate the displacement argument"
        equationScope="lab"
        equationScopeLabel="laboratory model"
      />
    </>
  );
}
