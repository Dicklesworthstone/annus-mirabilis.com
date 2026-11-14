"use client";

import { useId, useState } from "react";
import { LocalPredictions } from "../components/lab/LocalPredictions.tsx";
import { MovingClocksLab } from "../components/lab/sr05/MovingClocksLab.tsx";
import { useInvestigationWitness } from "../discovery/investigation/context.tsx";
import { createSr05Session, type PreparedSr05Example } from "../experiments/sr05/session.ts";
import prepared from "../generated/sr05-example.json";
import { chapterInvestigationSession } from "./chapterInvestigationSession.ts";

/** The same clock session used by Discover, with no URL state borrowed from the paper. */
export default function InlineClockInvestigation({
  session: supplied,
  example = prepared as PreparedSr05Example,
}: {
  session?: ReturnType<typeof createSr05Session>;
  example?: PreparedSr05Example;
} = {}) {
  const id = useId();
  const [session] = useState(() =>
    chapterInvestigationSession(supplied ?? createSr05Session(`reading-sr05-${id}`, example)),
  );
  useInvestigationWitness("sr-05", session, example.sourceDigest);
  return (
    <>
      <LocalPredictions />
      <MovingClocksLab
        example={example}
        session={session}
        restoreFromLocation={false}
        highlightPaper
        onValidationStateChange={session.validationStateChanged}
      />
    </>
  );
}
