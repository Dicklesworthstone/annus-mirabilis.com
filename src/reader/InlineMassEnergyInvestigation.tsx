"use client";

import { useId, useState } from "react";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import { BoundaryLedgerLab } from "../components/lab/me03/BoundaryLedgerLab.tsx";
import { useInvestigationWitness } from "../discovery/investigation/context.tsx";
import {
  createMe03Session,
  DEFAULT_PREPARED_EXAMPLE,
  type PreparedMe03Example,
} from "../experiments/me03/session.ts";
import labDigests from "../generated/lab-source-digests.json";
import { chapterInvestigationSession } from "./chapterInvestigationSession.ts";

const prepared = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };

/** The boundary ledger's own accepted result supplies the chapter's saved evidence. */
export default function InlineMassEnergyInvestigation({
  session: supplied,
  example = prepared,
}: {
  session?: ReturnType<typeof createMe03Session>;
  example?: PreparedMe03Example;
} = {}) {
  const id = useId();
  const [session] = useState(() =>
    chapterInvestigationSession(
      supplied ?? createMe03Session(`reading-me03-${id}`, example.parameters),
    ),
  );
  useInvestigationWitness("me-03", session, example.sourceDigest);
  return (
    <>
      <LocalPredictions />
      <BoundaryLedgerLab
        example={example}
        session={session}
        restoreFromLocation={false}
        showComparison={false}
        title="Investigate which system loses mass"
      />
    </>
  );
}
