import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";
import type { NoteManifest } from "../notebook.ts";

/** Only the public step identities cross into the private notebook's client island. */
export function stageNoteManifest(
  paper: DiscoveryPaper,
  revision: string | number,
  stages: readonly Readonly<{ id: string; title: string }>[],
): NoteManifest {
  return Object.freeze({
    paper,
    revision: String(revision),
    stages: Object.freeze(
      stages.map(({ id, title }) => Object.freeze({ id, title, alternatives: Object.freeze([]) })),
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
