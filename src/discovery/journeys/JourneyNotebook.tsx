import type { ReactNode } from "react";
import { DISCOVERY_PAPERS } from "../../content/schemas/discovery.ts";
import type { NoteManifest } from "../notebook.ts";
import { DiscoveryNotebookProvider } from "../notes/context.tsx";
import { stageNoteManifest } from "../notes/manifest.ts";
import { REAL_JOURNEYS } from "./realJourneys.ts";

/**
 * Server-component bridge. The authored records stay here; the client receives only the
 * current guide revision and public step identities needed to reopen its private notes.
 */
export const JOURNEY_NOTE_MANIFESTS: readonly NoteManifest[] = Object.freeze(
  DISCOVERY_PAPERS.flatMap((paper) => {
    const journey = REAL_JOURNEYS.find((item) => item.paper === paper);
    return journey && journey.stages.length > 0
      ? [stageNoteManifest(paper, journey.revision, journey.stages)]
      : [];
  }),
);

export function JourneyNotebook({
  paper,
  children,
}: {
  paper: NoteManifest["paper"];
  children: ReactNode;
}) {
  const manifest = JOURNEY_NOTE_MANIFESTS.find((item) => item.paper === paper);
  if (!manifest) return <>{children}</>;
  return <DiscoveryNotebookProvider manifest={manifest}>{children}</DiscoveryNotebookProvider>;
}
