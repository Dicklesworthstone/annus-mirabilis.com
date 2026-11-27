import type { NoteManifest } from "../notebook.ts";
import { noteStageHref } from "./manifest.ts";

/** Use only a branch belonging to this published step to build the return link. */
export function RecordedAlternative({
  manifest,
  stageId,
  alternativeId,
}: {
  manifest: NoteManifest;
  stageId: string;
  alternativeId: string | null;
}) {
  if (!alternativeId) return null;
  const stage = manifest.stages.find((item) => item.id === stageId);
  const alternative = stage?.alternatives.find((item) => item.id === alternativeId);
  if (!alternative) return null;
  return (
    <p>
      Proposal considered: <a href={noteStageHref(manifest, alternative.id)}>{alternative.title}</a>
    </p>
  );
}
