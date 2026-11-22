"use client";

import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import type { WeaveSession } from "../../../experiments/weave/sessionSource.ts";
import {
  LQ05_INDEPENDENT_READER_WEAVE,
  lq05ReaderWeave,
} from "../../../reader/weave/configurationPassages.ts";
import { SessionResultWeave } from "../../../reader/weave/SessionResultWeave.tsx";

export function LQ05LiveWeave({
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
  const binding = lq05ReaderWeave(view.accepted);
  return (
    <SessionResultWeave
      session={session}
      binding={binding ?? LQ05_INDEPENDENT_READER_WEAVE}
      suspended={suspended || binding === null}
      announcementsEnabled={announcementsEnabled}
      highlightPaper={highlightPaper}
    />
  );
}
