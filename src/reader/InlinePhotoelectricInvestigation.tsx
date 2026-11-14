"use client";

import { useId, useState } from "react";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import { PhotoelectricLab } from "../components/lab/lq08/PhotoelectricLab.tsx";
import { useInvestigationWitness } from "../discovery/investigation/context.tsx";
import { createLq08Session, type PreparedLq08Example } from "../experiments/lq08/session.ts";
import prepared from "../generated/lq08-example.json";
import { chapterInvestigationSession } from "./chapterInvestigationSession.ts";

/** Loaded only by the chapter's explicit load action; the lab and notebook share one owner. */
export default function InlinePhotoelectricInvestigation({
  session: supplied,
  example = prepared as PreparedLq08Example,
}: {
  session?: ReturnType<typeof createLq08Session>;
  example?: PreparedLq08Example;
} = {}) {
  const id = useId();
  const [session] = useState(() =>
    chapterInvestigationSession(supplied ?? createLq08Session(`reading-lq08-${id}`, example)),
  );
  useInvestigationWitness("lq-08", session, example.sourceDigest);
  return (
    <>
      <LocalPredictions />
      <PhotoelectricLab
        example={example}
        session={session}
        linked={false}
        highlightPaper
        onValidationStateChange={session.validationStateChanged}
      />
    </>
  );
}
