import { existsSync } from "node:fs";
import { join } from "node:path";

/** How far a paper's transcription has got, read from the files, never typed into copy. */
export type Transcription = "reviewed" | "draft" | "none";

export function transcriptionOf(key: string): Transcription {
  const dir = join(process.cwd(), "public", "papers", "transcripts");
  if (existsSync(join(dir, `${key}-reviewed.txt`))) return "reviewed";
  if (existsSync(join(dir, `${key}-machine-draft.txt`))) return "draft";
  return "none";
}

export const TRANSCRIPTION_WORDS: Readonly<Record<Transcription, string>> = {
  reviewed: "Transcribed from the page images.",
  draft: "Read by machine and corrected by hand against the page images.",
  none: "Not yet transcribed.",
};
