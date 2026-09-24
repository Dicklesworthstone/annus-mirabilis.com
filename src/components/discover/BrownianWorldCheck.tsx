"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import type { WorldCheck as WorldCheckType } from "../../content/schemas/journey.ts";
import { EINSTEIN_TRACER_INPUTS } from "../../discovery/brownian/journeyII.ts";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import { WorldCheck } from "../../discovery/WorldCheck.tsx";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import type { Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { fixed, result, sentenceNumber } from "../lab/presentation.ts";
import { TracerLab } from "../lab/TracerLab.tsx";

/** One output of the accepted snapshot, in micrometres, to the precision the model supports. */
function micrometres(snapshot: AcceptedSnapshot, id: string): string {
  const output = result(snapshot, id);
  return output.status === "value" && typeof output.value === "number"
    ? `${sentenceNumber(output.value * 1e6, 2)} µm`
    : "not available at these settings";
}

/**
 * The Brownian journey's check against the world (plan §9.1 item 7): a teaching composition of
 * one BM-01 session, not a second numerical owner. The embedded tracer ensemble and the readout
 * beside it share that session, so the numbers the reader compares are the ensemble's own
 * one-second and one-minute displacements from the accepted snapshot, and they change when the
 * reader applies a new radius, temperature or viscosity. Nothing here computes a displacement.
 */
export function BrownianWorldCheck({
  example,
  check,
  laterEvidence,
}: {
  example: PreparedBm01Example;
  check: WorldCheckType;
  laterEvidence: readonly KnowledgeCard[];
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm01Session(`world-check-${id}`, example, createBm01BrowserChannel),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) throw new Error("Missing accepted tracer snapshot");
  const p = snapshot.parameters as Bm01Parameters;
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => setReady(true), []);

  function applyEinsteinInputs() {
    const outcome = session.apply({ ...p, ...EINSTEIN_TRACER_INPUTS });
    setNote(
      outcome.kind === "accepted"
        ? ""
        : "The tracer ensemble did not accept Einstein's inputs. Its settings are unchanged.",
    );
  }

  const live = (
    <div data-world-check-live>
      <p className="eyebrow">From the tracer ensemble above, as it now stands</p>
      <p>
        At {fixed(p.T - 273.15, 2)} °C, a viscosity of {sentenceNumber(p.eta * 1e3, 3)} mPa·s and a
        radius of {sentenceNumber(p.a * 1e6, 3)} µm, a particle typically gets:
      </p>
      <dl>
        <div>
          <dt>In one second</dt>
          <dd data-world-check-quantity="lambdaX1s">{micrometres(snapshot, "lambdaX1s")}</dd>
        </div>
        <div>
          <dt>In one minute</dt>
          <dd data-world-check-quantity="lambdaX60s">{micrometres(snapshot, "lambdaX60s")}</dd>
        </div>
      </dl>
      <p className="fine">
        An ideal model computed here, with today’s constants. Change the radius in the ensemble and
        apply it, and these numbers follow.
      </p>
      {ready && (
        <p>
          <button type="button" className="secondary" onClick={applyEinsteinInputs}>
            Use Einstein’s inputs: 17 °C, 1.35 mPa·s, particles 0.001 mm across
          </button>
        </p>
      )}
      {note && <p role="status">{note}</p>}
    </div>
  );

  return (
    <>
      <TracerLab
        example={example}
        session={session}
        title="The tracer ensemble, for the check"
        equationScope="world-check"
        equationScopeLabel="check against the world"
      />
      <WorldCheck check={check} live={live} />
      <section data-world-check-later aria-labelledby={`${id}-later`}>
        <h3 id={`${id}-later`}>Later evidence, not on the 1904 shelf</h3>
        {laterEvidence.map((card) => (
          <KnowledgeCardView key={card.id} card={card} />
        ))}
      </section>
    </>
  );
}
