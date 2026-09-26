"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { WorldCheck as WorldCheckType } from "../../content/schemas/journey.ts";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import { WorldCheck } from "../../discovery/WorldCheck.tsx";
import type { Sr05Parameters } from "../../experiments/sr05/definition.ts";
import { createSr05Session, type PreparedSr05Example } from "../../experiments/sr05/session.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import { sentenceNumber } from "../lab/presentation.ts";
import { MovingClocksLab } from "../lab/sr05/MovingClocksLab.tsx";

/** A clock reading as the snapshot publishes it, or the owner's reason when there is none. */
function seconds(result: PublishedResult | undefined): string {
  if (result === undefined) return "not computed at these settings";
  if (result.status === "outside-domain" || result.status === "not-applicable")
    return result.reason;
  if (result.status !== "value" || typeof result.value !== "number")
    return "not available at these settings";
  return `${sentenceNumber(result.value, 3)} s`;
}

const ROUTE_WORDS: Readonly<Record<Sr05Parameters["worldlinePreset"], string>> = {
  inertial: "in a straight line",
  "out-and-back": "out and back",
  circle: "round a circle",
};

/**
 * The relativity journey's check against the world (plan §9.1 item 7): a teaching composition of
 * one SR-05 session, not a second numerical owner. The embedded laboratory and the readout beside
 * it share that session, so the readings are SR-05's own, from the accepted snapshot, and follow the
 * worldline the reader chooses. Nothing here computes a time.
 *
 * The later measurement is stated in words, never as a number: the edition holds no dataset of
 * Ives and Stilwell's, and their card, beside the check, says what their pages say.
 */
export function RelativityWorldCheck({
  example,
  check,
  laterEvidence,
  session: sharedSession,
}: {
  example: PreparedSr05Example;
  check: WorldCheckType;
  laterEvidence: readonly KnowledgeCard[];
  /** A session owned by whoever embeds the check. Omitted, it owns its own. */
  session?: ReturnType<typeof createSr05Session> | undefined;
}) {
  const id = useId();
  const [session] = useState(
    () => sharedSession ?? createSr05Session(`world-check-${id}`, example),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  // Refused, not guessed: without an accepted snapshot there is no reading, and a readout of zeros
  // would be a number the laboratory never produced.
  if (!snapshot) throw new Error("world-check-snapshot-missing", { cause: session });
  const p = snapshot.parameters as Sr05Parameters;
  const output = (quantityId: string) => snapshot.outputs.find((o) => o.quantityId === quantityId);

  const live = (
    <div data-world-check-live>
      <p className="eyebrow">From the laboratory above, as it now stands</p>
      <p>
        A clock moving at {sentenceNumber(p.speed, 3)} of the speed of light,{" "}
        {ROUTE_WORDS[p.worldlinePreset]}:
      </p>
      <dl>
        <div>
          <dt>The resting clocks read</dt>
          <dd data-world-check-quantity="coordinateTime">{seconds(output("coordinateTime"))}</dd>
        </div>
        <div>
          <dt>The moving clock reads</dt>
          <dd data-world-check-quantity="properTime">{seconds(output("properTime"))}</dd>
        </div>
        <div>
          <dt>It falls behind, in every second</dt>
          <dd data-world-check-quantity="dilationLossExact">
            {seconds(output("dilationLossExact"))}
          </dd>
        </div>
      </dl>
      <p className="fine">
        An ideal clock whose rate depends only on its speed, computed here from the relation of § 4.
        Choose another worldline in the laboratory and these readings follow.
      </p>
      <p className="fine" data-world-check-later-measurement>
        In 1938 Ives and Stilwell reported that the light given off by moving hydrogen atoms, each
        atom a clock, is lowered in frequency by the factor this relation gives. That is later
        evidence, not on the 1904 shelf, and this edition holds no table of their measurements, so
        the comparison is made in these words and no figure of theirs is set beside the readings
        above. They read the result within Lorentz&rsquo;s theory, which predicts the same rate: it
        does not choose between that account and the paper&rsquo;s.
      </p>
    </div>
  );

  return (
    <>
      <MovingClocksLab example={example} session={session} />
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
