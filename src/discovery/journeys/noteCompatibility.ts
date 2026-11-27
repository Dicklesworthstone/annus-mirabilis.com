import { createHash } from "node:crypto";
import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";
import type { Journey } from "../../content/schemas/journey.ts";
import { canonicalJsonStringify } from "../../equations/tree/serialize.ts";
import type { NoteManifest } from "../notebook.ts";
import { stageNoteManifest } from "../notes/manifest.ts";

/**
 * Two published move-only revisions retain their full authored stage contract. These hashes
 * identify the prior questions, predictions, alternatives, and explanations, not merely ids.
 * ME's stage module is unchanged between 15b9629 (guide 4) and 5ac7f05 (guide 5); SR's guide-4
 * stages are pinned at 5ac7f05. The fork digests cover the earlier published fork records, including
 * each proposal's hypothesis, scope and outcome, so reused branch ids cannot relabel old notes.
 * This runs in the server bridge; the browser receives revision strings, never crypto code.
 */
const COMPATIBLE_STAGES = Object.freeze([
  {
    paper: "mass-energy",
    current: "5",
    previous: "4",
    forkDigest: "5173cf78399340b7100694a760a8ab3e88ae452d35270d4a814722b53e3f6783",
    digest: "7d798c4621c84026d9fe31576540d6c847d08e58054b2557803a98ef211fd9dc",
  },
  {
    paper: "special-relativity",
    current: "5",
    previous: "4",
    forkDigest: "8f237f2e250b8e1326d1ef792f3fe3781723444ac36a1f5298b68575078aecf0",
    digest: "8b3e92aac4a9d351783ceb272992847d13dd2fa62d0c81e21bb80e3610eefe09",
  },
] as const);

export function journeyNoteManifest(
  paper: DiscoveryPaper,
  revision: string | number,
  stages: Journey["stages"],
  forks: Journey["forks"],
): NoteManifest {
  const manifest = stageNoteManifest(paper, revision, stages, forks);
  const declared = COMPATIBLE_STAGES.find(
    (entry) => entry.paper === paper && entry.current === manifest.revision,
  );
  if (
    !declared ||
    createHash("sha256").update(JSON.stringify(stages)).digest("hex") !== declared.digest ||
    createHash("sha256").update(canonicalJsonStringify(forks)).digest("hex") !== declared.forkDigest
  )
    return manifest;
  return Object.freeze({ ...manifest, compatibleRevisions: Object.freeze([declared.previous]) });
}
