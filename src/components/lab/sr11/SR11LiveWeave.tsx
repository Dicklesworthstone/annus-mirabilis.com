"use client";

import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import type { WeaveSession } from "../../../experiments/weave/sessionSource.ts";
import { SR11_LAB_READER_WEAVE, sr11ReaderWeave } from "../../../reader/weave/mirrorPassages.ts";
import { SessionResultWeave } from "../../../reader/weave/SessionResultWeave.tsx";

/** Select source wording from this session's accepted frame without starting another trial. */
export function SR11LiveWeave({
  session,
  suspended = false,
  announcementsEnabled = true,
  highlightPaper = false,
}: Readonly<{
  session: WeaveSession;
  suspended?: boolean;
  announcementsEnabled?: boolean;
  highlightPaper?: boolean;
}>) {
  const view = useInstrumentView(session);
  const binding = sr11ReaderWeave(view.accepted);
  return (
    <SessionResultWeave
      session={session}
      binding={binding ?? SR11_LAB_READER_WEAVE}
      suspended={suspended || binding === null}
      announcementsEnabled={announcementsEnabled}
      highlightPaper={highlightPaper}
    />
  );
}
