"use client";

import { useMemo } from "react";
import { createSessionWeave, type WeaveSession } from "../../experiments/weave/sessionSource.ts";
import type { WeavePredicate } from "../../experiments/weave/types.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import { ResultWeavePanel } from "./ResultWeavePanel.tsx";

export type ReaderWeaveBinding = Readonly<{
  instrumentId: string;
  constantSetId: string;
  paper: string;
  predicates: readonly WeavePredicate[];
  passages: Readonly<Record<string, WeavePassage>>;
  contextFields: readonly WeaveContextField[];
}>;

/** Subscribe to the laboratory's existing session; construction starts no calculation. */
export function SessionResultWeave({
  session,
  binding,
  suspended = false,
  announcementsEnabled = true,
}: Readonly<{
  session: WeaveSession;
  binding: ReaderWeaveBinding;
  /** Local validation can refuse a form before it issues a store request. */
  suspended?: boolean;
  /** Prediction gates can hide this result without announcing it through another channel. */
  announcementsEnabled?: boolean;
}>) {
  const source = useMemo(() => createSessionWeave(session, binding), [session, binding]);
  return (
    <ResultWeavePanel
      source={source}
      predicates={binding.predicates}
      passages={binding.passages}
      paper={binding.paper}
      contextFields={binding.contextFields}
      suspended={suspended}
      announcementsEnabled={announcementsEnabled}
    />
  );
}
