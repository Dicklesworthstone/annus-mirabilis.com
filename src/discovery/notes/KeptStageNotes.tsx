"use client";

import type { NoteManifest } from "../notebook.ts";
import { DiscoveryNotebookProvider, useDiscoveryNotebook, useNotebookView } from "./context.tsx";
import { NOTE_PAPER_TITLES, noteStageHref } from "./manifest.ts";
import { DiscoveryNotebookControls } from "./NotebookControls.tsx";

type RevisitStageLink = Readonly<{ paper: NoteManifest["paper"]; stageId: string; href: string }>;

/** Reads the guide's same registered document; no mirrored notebook or migration. */
export function KeptStageNotes({
  manifests,
  revisits = [],
}: {
  manifests: readonly NoteManifest[];
  revisits?: readonly RevisitStageLink[];
}) {
  return (
    <section
      id="discovery-notes"
      className="discovery-notes-kept"
      aria-labelledby="discovery-notes-title"
    >
      <h2 id="discovery-notes-title">Your discovery predictions and observations</h2>
      <p>
        Return to the step where you recorded a prediction and add what you noticed. Downloaded
        notes can be checked and reopened here before you choose to replace anything.
      </p>
      {manifests.map((manifest) => (
        <DiscoveryNotebookProvider key={manifest.paper} manifest={manifest}>
          <KeptGuideNotes manifest={manifest} revisits={revisits} />
        </DiscoveryNotebookProvider>
      ))}
    </section>
  );
}

function KeptGuideNotes({
  manifest,
  revisits,
}: {
  manifest: NoteManifest;
  revisits: readonly RevisitStageLink[];
}) {
  const notebook = useDiscoveryNotebook();
  if (!notebook) return null;
  return <GuideNotes notebook={notebook} manifest={manifest} revisits={revisits} />;
}

function GuideNotes({
  notebook,
  manifest,
  revisits,
}: {
  notebook: NonNullable<ReturnType<typeof useDiscoveryNotebook>>;
  manifest: NoteManifest;
  revisits: readonly RevisitStageLink[];
}) {
  const view = useNotebookView(notebook.session);
  return (
    <section aria-label={`${NOTE_PAPER_TITLES[manifest.paper]} recorded notes`}>
      <h3>
        <a href={noteStageHref(manifest)}>{NOTE_PAPER_TITLES[manifest.paper]}</a>
      </h3>
      {view.document.entries.map((entry) => {
        const stage = manifest.stages.find((item) => item.id === entry.stageId);
        const revisit = revisits.find(
          (item) => item.paper === manifest.paper && item.stageId === entry.stageId,
        );
        return (
          <section className="discovery-note-attempt" key={entry.stageId}>
            <h4>
              <a href={noteStageHref(manifest, entry.stageId)}>{stage?.title}</a>
            </h4>
            {entry.attempts.map((attempt, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: recorded attempts retain their original order and have no editable state here
              <div key={`${index}-${attempt.prediction}`}>
                <p className="discovery-note-text">
                  <strong>Prediction {index + 1}:</strong> {attempt.prediction}
                </p>
                <p className="discovery-note-text">
                  <strong>Observation:</strong> {attempt.observation || "None recorded yet."}
                </p>
              </div>
            ))}
            <p>
              <a href={noteStageHref(manifest, entry.stageId)}>
                Return to this step and add an observation
              </a>
            </p>
            {revisit && (
              <p>
                <a href={revisit.href}>Try this idea in a changed case</a>
              </p>
            )}
          </section>
        );
      })}
      <DiscoveryNotebookControls />
    </section>
  );
}
