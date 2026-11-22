"use client";

import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import type { WeaveSession } from "../../../experiments/weave/sessionSource.ts";
import {
  BM03_INDEPENDENT_READER_WEAVE,
  bm03ReaderWeave,
} from "../../../reader/weave/osmoticPassages.ts";
import { SessionResultWeave } from "../../../reader/weave/SessionResultWeave.tsx";

export function BM03LiveWeave({
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
  const selected = bm03ReaderWeave(view.accepted);
  return (
    <SessionResultWeave
      session={session}
      binding={selected ?? BM03_INDEPENDENT_READER_WEAVE}
      suspended={suspended || selected === null}
      announcementsEnabled={announcementsEnabled}
      highlightPaper={highlightPaper}
    />
  );
}
