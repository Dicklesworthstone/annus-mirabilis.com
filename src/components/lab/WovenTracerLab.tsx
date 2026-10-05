"use client";

import { type ComponentProps, useId, useMemo, useState } from "react";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { BM01_MODEL, BM01_WEAVE_PREDICATES } from "../../experiments/bm01/definition.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { createSessionWeave } from "../../experiments/weave/sessionSource.ts";
import { BM01_WEAVE_PASSAGES, withWeavePassages } from "../../reader/weave/brownianPassages.ts";
import { ResultWeavePanel } from "../../reader/weave/ResultWeavePanel.tsx";
import { TracerLab } from "./TracerLab.tsx";

const predicates = withWeavePassages(BM01_WEAVE_PREDICATES, BM01_WEAVE_PASSAGES);

/** The lab and the paper pointers share one session and one set of accepted outputs. */
export function WovenTracerLab(props: ComponentProps<typeof TracerLab>) {
  const id = useId();
  const [session] = useState(() => props.session ?? createBm01Session(
    props.instanceId ?? `woven-bm01-${id}`, props.example, createBm01BrowserChannel,
  ));
  const source = useMemo(() => createSessionWeave(session, {
    instrumentId: "bm-01", constantSetId: BM01_MODEL.constantSetId, predicates,
  }), [session]);
  return (
    <>
      <TracerLab {...props} session={session} />
      <ResultWeavePanel source={source} predicates={predicates} passages={BM01_WEAVE_PASSAGES} paper="brownian-motion" />
    </>
  );
}

/** Preserve independent controls, workers and the optional comparison from TracerComparison. */
export function WovenTracerComparison({ example }: { example: PreparedBm01Example }) {
  const [second, setSecond] = useState(false);
  return (
    <>
      <WovenTracerLab example={example} />
      <div className="comparison-toggle">
        <p className="fine">
          Separate controls and workers; both start with the same worked-example seed. Choose a new
          trial to compare independently seeded realizations.
        </p>
        <button type="button" className="secondary" onClick={() => setSecond(!second)}>
          {second ? "Close the second tracer ensemble" : "Open a second separate ensemble"}
        </button>
      </div>
      {second && (
        <WovenTracerLab example={example} title="A separate tracer ensemble" equationScope="compare"
          equationScopeLabel="comparison ensemble" linked={false} />
      )}
    </>
  );
}
