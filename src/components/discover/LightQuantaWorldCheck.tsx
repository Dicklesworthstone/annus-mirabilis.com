"use client";

import { useId, useState } from "react";
import type { WorldCheck as WorldCheckType } from "../../content/schemas/journey.ts";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import type { KnowledgeCard } from "../../discovery/cards/types.ts";
import {
  InvestigationLabLink,
  useInvestigationWitness,
} from "../../discovery/investigation/context.tsx";
import { WorldCheck } from "../../discovery/WorldCheck.tsx";
import type { Lq08Parameters } from "../../experiments/lq08/definition.ts";
import type { MillikanOverlayResult } from "../../experiments/lq08/millikan.ts";
import { createLq08Session, type PreparedLq08Example } from "../../experiments/lq08/session.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import { chapterInvestigationSession } from "../../reader/chapterInvestigationSession.ts";
import { PhotoelectricLab } from "../lab/lq08/PhotoelectricLab.tsx";
import { sentenceNumber } from "../lab/presentation.ts";
import { Sci } from "../lab/Sci.tsx";

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
 * here computes a potential. The later measurement comes through the same admitted dataset as
 * LQ-08's page: its signed intercepts are kept on their own scale, and only the slopes compare.
 */
export function LightQuantaWorldCheck({
  example,
  check,
  printedVolts,
  laterEvidence,
  millikan,
  session: sharedSession,
}: {
  example: PreparedLq08Example;
  check: WorldCheckType;
  /** The paper's §8 figure from its own constants, computed at build time (worldCheck.ts). */
  printedVolts: number;
  laterEvidence: readonly KnowledgeCard[];
  /** Build-time dataset verdict. A withheld record supplies a reason, never measurement values. */
  millikan: MillikanOverlayResult;
  /** A session owned by whoever embeds the check. Omitted, it owns its own. */
  session?: ReturnType<typeof createLq08Session> | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    chapterInvestigationSession(sharedSession ?? createLq08Session(`world-check-${id}`, example)),
  );
  useInvestigationWitness("lq-08", session, example.sourceDigest ?? "");
  const view = useInstrumentView(session);
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
      <InvestigationLabLink experimentId="lq-08" />
      <PhotoelectricLab
        example={example}
        session={session}
        millikan={millikan}
        readings={false}
        linked={false}
        showComparison={false}
        onValidationStateChange={session.validationStateChanged}
      />
      <WorldCheck check={check} live={live} />
      <section data-world-check-later aria-labelledby={`${id}-later`}>
        <h3 id={`${id}-later`}>Later evidence, not on the 1904 shelf</h3>
        <section
          className="journey-world-check"
          aria-labelledby={`${id}-measurement`}
          data-world-check-measurement={millikan.kind}
          data-historical-dataset="millikan-1916-sodium"
          data-comparison-kind={millikan.kind === "plottable" ? "measured-fact" : undefined}
        >
          <h4 id={`${id}-measurement`}>1916: test the predicted slope</h4>
          {millikan.kind === "plottable" ? (
            <>
              <p>
                Millikan measured the potential at which the current stopped for several light
                frequencies. His sodium points are plotted in the laboratory above, on their
                original signed scale. The contact potential shifts that scale, so compare the
                slope, how much the potential rises with frequency, with the model.
              </p>
              <dl className="journey-world-check-columns">
                <div>
                  <dt>Slope fitted here to the points that fixed his line</dt>
                  <dd data-measured-slope>
                    <Sci value={millikan.fittedSlopeVs} digits={3} /> V&middot;s
                  </dd>
                  <dt>Standard error of that fit</dt>
                  <dd>
                    <Sci value={millikan.fittedSlopeStdErr} digits={2} /> V&middot;s
                  </dd>
                </div>
                <div>
                  <dt>Model slope, h/e, from this laboratory&apos;s constants</dt>
                  <dd data-model-slope>
                    <Sci value={millikan.modelLineSlopeVs} digits={4} /> V&middot;s
                  </dd>
                </div>
              </dl>
              <p>
                The fitted slope uses the measured points; the model slope uses today&apos;s
                constants independently. Changing the exit cost shifts the model&apos;s line;
                changing the power changes the current. Neither changes its slope, and neither
                rewrites the measurements. The fit&apos;s standard error describes scatter around
                the fitted line, not every uncertainty in reading the figure or making the
                experiment.
              </p>
              <p className="fine">
                {millikan.citation} The points and the slopes Millikan printed are listed with the
                plot. This later test supports the predicted relation; it was unavailable to the
                1905 argument.
              </p>
            </>
          ) : (
            <p>
              The measured comparison is unavailable: {millikan.reason} {millikan.citation}
            </p>
          )}
        </section>
        {laterEvidence.map((card) => (
          <KnowledgeCardView key={card.id} card={card} />
        ))}
      </section>
    </>
  );
}
