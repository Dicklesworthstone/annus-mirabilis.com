import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";
import type { Fork } from "../../content/schemas/journey.ts";
import type { NoteManifest } from "../notebook.ts";

type StageFork = Pick<Fork, "afterStageId" | "question"> & {
  readonly branches: readonly Readonly<{ id: string; label: string }>[];
};

/** Keep only the published stage, fork question and branch labels the reader can record. */
export function stageNoteManifest(
  paper: DiscoveryPaper,
  revision: string | number,
  stages: readonly Readonly<{ id: string; title: string }>[],
  forks: readonly StageFork[] = [],
): NoteManifest {
  return Object.freeze({
    paper,
    revision: String(revision),
    stages: Object.freeze(
      stages.map(({ id, title }) =>
        Object.freeze({
          id,
          title,
          alternatives: Object.freeze(
            forks
              .filter((fork) => fork.afterStageId === id)
              .flatMap((fork) =>
                fork.branches.map((branch) => ({
                  id: branch.id,
                  title: branch.label,
                  question: fork.question,
                })),
              ),
          ),
        }),
      ),
    ),
  });
}

export const NOTE_PAPER_TITLES: Readonly<Record<DiscoveryPaper, string>> = Object.freeze({
  "brownian-motion": "Brownian motion",
  "light-quanta": "Light quanta",
  "special-relativity": "Special relativity",
  "mass-energy": "Mass and energy",
});

export function noteStageHref(manifest: NoteManifest, stageId?: string): string {
  return `/discover/${manifest.paper}/${stageId ? `#${encodeURIComponent(stageId)}` : ""}`;
}
