"use client";

import { useInstrumentView } from "../../experiments/store/useExperimentSnapshot.ts";
import type { WeaveSession } from "../../experiments/weave/sessionSource.ts";
import {
  closingQuantaReaderWeave,
  LQ07_READER_WEAVES,
  LQ09_READER_WEAVES,
} from "./closingQuantaPassages.ts";
import { SessionResultWeave } from "./SessionResultWeave.tsx";

/** Subscribe to the laboratory's existing session; selecting source wording starts no calculation. */
export function ClosingQuantaLiveWeave({
  instrumentId,
  session,
  suspended = false,
  announcementsEnabled = true,
  highlightPaper = false,
}: Readonly<{
  instrumentId: "lq-07" | "lq-09";
  session: WeaveSession;
  suspended?: boolean;
  announcementsEnabled?: boolean;
  highlightPaper?: boolean;
}>) {
  const view = useInstrumentView(session);
  const selected = closingQuantaReaderWeave(instrumentId, view.accepted);
  const fallback = instrumentId === "lq-07"
    ? LQ07_READER_WEAVES["standard-stokes"]
    : LQ09_READER_WEAVES["all-absorbed-ionizes"];
  return (
    <SessionResultWeave
      session={session}
      binding={selected ?? fallback}
      suspended={suspended || selected === null}
      announcementsEnabled={announcementsEnabled}
      highlightPaper={highlightPaper}
    />
  );
}
