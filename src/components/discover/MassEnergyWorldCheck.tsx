"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { WorldCheck as WorldCheckType } from "../../content/schemas/journey.ts";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import { WorldCheck } from "../../discovery/WorldCheck.tsx";
import type { Me03Parameters } from "../../experiments/me03/definition.ts";
import { createMe03Session, type PreparedMe03Example } from "../../experiments/me03/session.ts";
import type { AcceptedSnapshot, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { BoundaryLedgerLab } from "../lab/me03/BoundaryLedgerLab.tsx";
import { sentenceNumber } from "../lab/presentation.ts";

const BOUNDARY_WORDS: Readonly<Record<Me03Parameters["boundary"], string>> = {
  "body-alone": "around the body alone",
  radiation: "around the radiation alone",
  "combined-isolated-system": "around the body and its light together",
};

/** One output of the accepted snapshot, or none: the 1906 box mode publishes no ledger outputs. */
function output(snapshot: AcceptedSnapshot, id: string): PublishedResult | undefined {
  return snapshot.outputs.find((o) => o.quantityId === id);
}

/**
 * A value in the SI unit the ledger publishes and in the paper's own unit beside it. The second is
 * a change of unit (a joule is 10⁷ erg, a kilogram 10³ grams), not a second calculation.
 */
function twoUnits(
  result: PublishedResult | undefined,
  si: string,
  printed: string,
  factor: number,
): string {
  if (result === undefined) return "not published in this mode";
  if (result.status === "not-applicable") return result.reason;
  if (result.status !== "value" || typeof result.value !== "number")
    return "not available at these settings";
  return `${sentenceNumber(result.value, 3)} ${si}, or ${sentenceNumber(result.value * factor, 3)} ${printed}`;
}

/**
 * The mass-energy journey's check against the world (plan §9.1 item 7): a teaching composition of
 * one ME-03 session, not a second numerical owner. The embedded boundary ledger and the readout
 * beside it share that session, so the mass the reader reads is the ledger's own massChange from
 * the accepted snapshot, and it follows the energy and the boundary the reader applies. Nothing
 * here divides an energy by anything.
 */
export function MassEnergyWorldCheck({
  example,
  check,
  laterEvidence,
  session: sharedSession,
}: {
  example: PreparedMe03Example;
  check: WorldCheckType;
  laterEvidence: readonly KnowledgeCard[];
  /** A session owned by whoever embeds the check. Omitted, it owns its own. */
  session?: ReturnType<typeof createMe03Session> | undefined;
}) {
  const id = useId();
  const [session] = useState(
    () => sharedSession ?? createMe03Session(`world-check-${id}`, example.parameters),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  // Refused, not guessed: without an accepted snapshot there is no mass to read, and a readout of
  // zeros would be a number the ledger never produced.
  if (!snapshot) throw new Error("world-check-snapshot-missing", { cause: session });
  const p = snapshot.parameters as Me03Parameters;
  const box = p.mode === "box-1906";

  const live = (
    <div data-world-check-live>
      <p className="eyebrow">From the boundary ledger above, as it now stands</p>
      {box ? (
        <p>
          The ledger is showing the 1906 box, which asks where the light&rsquo;s mass goes rather
          than what the body loses. Switch it back to the 1905 ledger to read a change of mass here.
        </p>
      ) : (
        <>
          <p>With the boundary drawn {BOUNDARY_WORDS[p.boundary]}:</p>
          <dl>
            <div>
              <dt>Change of energy inside the boundary</dt>
              <dd data-world-check-quantity="energyChange">
                {twoUnits(output(snapshot, "energyChange"), "J", "erg", 1e7)}
              </dd>
            </div>
            <div>
              <dt>Change of mass inside the boundary</dt>
              <dd data-world-check-quantity="massChange">
                {twoUnits(output(snapshot, "massChange"), "kg", "g", 1e3)}
              </dd>
            </div>
          </dl>
        </>
      )}
      <p className="fine">
        An ideal model computed here, with today&rsquo;s speed of light, for the one joule the
        ledger lets leave. Divide the energy in erg by 9·10<sup>20</sup> and set it beside the mass
        in grams. Move the boundary or choose a setup in the ledger, and these numbers follow.
      </p>
    </div>
  );

  return (
    <>
      <BoundaryLedgerLab
        example={example}
        session={session}
        title="The boundary ledger, for the check"
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
