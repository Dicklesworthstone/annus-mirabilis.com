"use client";
/**
 * The tracer ensemble as the Brownian reading embeds it, with its prepared worked example. This
 * module is only ever imported lazily, by LazyInlineTracerLab: the example is 144 KB of float64
 * tracer endpoints, and whatever a page imports statically is in its first-route JavaScript and,
 * as a client component's props, in its flight data too.
 */
import { useId, useState } from "react";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import { WovenTracerLab as TracerLab } from "../components/lab/WovenTracerLab.tsx";
import { useInvestigationWitness } from "../discovery/investigation/context.tsx";
import { createBm01BrowserChannel } from "../experiments/bm01/browser.ts";
import { createBm01Session, type PreparedBm01Example } from "../experiments/bm01/session.ts";
import tracerExample from "../generated/bm01-example.json";

export default function InlineTracerLab({
  session: sharedSession,
  example = tracerExample as PreparedBm01Example,
}: {
  /** An embedding may supply the actual owner, as WovenTracerLab and TracerLab allow. */
  session?: ReturnType<typeof createBm01Session>;
  example?: PreparedBm01Example;
} = {}) {
  const id = useId();
  const [session] = useState(
    () =>
      sharedSession ?? createBm01Session(`reading-bm01-${id}`, example, createBm01BrowserChannel),
  );
  // The optional chapter workspace, result weave and controls read this one accepted owner.
  // Construction and connection still happen only after the reader opens the lazy laboratory.
  useInvestigationWitness("bm-01", session, example.sourceDigest);
  // The paper reader is the site's own route, so its gate remembers the reader's answers.
  return (
    <>
      <LocalPredictions />
      <TracerLab
        highlightPaper
        example={example}
        session={session}
        title="Investigate the displacement argument"
        equationScope="lab"
        equationScopeLabel="laboratory model"
      />
    </>
  );
}
