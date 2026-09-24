"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { WorldCheck as WorldCheckType } from "../../content/schemas/journey.ts";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import { WorldCheck } from "../../discovery/WorldCheck.tsx";
import type { Lq08Parameters } from "../../experiments/lq08/definition.ts";
import { createLq08Session, type PreparedLq08Example } from "../../experiments/lq08/session.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import { PhotoelectricLab } from "../lab/lq08/PhotoelectricLab.tsx";
import { sentenceNumber } from "../lab/presentation.ts";

/** The stopping potential as the snapshot publishes it, or the owner's reason when there is none. */
function stoppingPotential(result: PublishedResult | undefined): string {
  if (result === undefined) return "not computed at these settings";
  if (result.status === "not-applicable") return result.reason;
  if (result.status !== "value" || typeof result.value !== "number")
    return "not available at these settings";
  return `${sentenceNumber(result.value, 3)} V`;
}

/**
 * The light-quanta journey's check against the world (plan §9.1 item 7): a teaching composition of
 * one LQ-08 session, not a second numerical owner. The embedded laboratory and the readout beside
 * it share that session, so the stopping potential the reader reads is LQ-08's own, from the
 * accepted snapshot, and it follows the frequency and the exit cost the reader applies. Nothing
 * here computes a potential.
 */
export function LightQuantaWorldCheck({
  example,
  check,
  printedVolts,
  laterEvidence,
  session: sharedSession,
}: {
  example: PreparedLq08Example;
  check: WorldCheckType;
  /** The paper's §8 figure from its own constants, computed at build time (worldCheck.ts). */
  printedVolts: number;
  laterEvidence: readonly KnowledgeCard[];
  /** A session owned by whoever embeds the check. Omitted, it owns its own. */
  session?: ReturnType<typeof createLq08Session> | undefined;
}) {
  const id = useId();
  const [session] = useState(
    () => sharedSession ?? createLq08Session(`world-check-${id}`, example),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  // Refused, not guessed: without an accepted snapshot there is no potential to read, and a readout
  // of zero would be a number the laboratory never produced.
  if (!snapshot) throw new Error("world-check-snapshot-missing", { cause: session });
  const p = snapshot.parameters as Lq08Parameters;
  const result = snapshot.outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");

  const live = (
    <div data-world-check-live>
      <p className="eyebrow">From the laboratory above, as it now stands</p>
      <p>
        Light of frequency {sentenceNumber(p.frequency, 3)} per second, on a surface whose exit cost
        is {sentenceNumber(p.workFunction, 3)} eV:
      </p>
      <dl>
        <div>
          <dt>Potential that stops the fastest electrons</dt>
          <dd data-world-check-quantity="stoppingPotentialMagnitude">
            {stoppingPotential(result)}
          </dd>
        </div>
      </dl>
      <p className="fine">
        An ideal model computed here, with today&rsquo;s constants. The paper&rsquo;s own constants
        give {sentenceNumber(printedVolts, 3)} V at its frequency with the exit cost neglected;
        today&rsquo;s give a little less, and the difference is the constants, not the argument.
        Change the frequency or the exit cost in the laboratory and apply it, and this number
        follows.
      </p>
    </div>
  );

  return (
    <>
      <PhotoelectricLab example={example} session={session} readings={false} linked={false} />
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
