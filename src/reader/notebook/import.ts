import { parseNotebookDocument, type NotebookDocument } from "./schema.ts";

export type NotebookMerge = Readonly<{
  document: NotebookDocument;
  added: number;
  duplicates: number;
}>;

/** Pure all-or-nothing merge. Colliding ids with different work must never overwrite notes. */
export function mergeNotebook(currentInput: NotebookDocument, importedInput: unknown): NotebookMerge {
  const current = parseNotebookDocument(currentInput);
  const imported = parseNotebookDocument(importedInput);
  const entries = [...current.entries];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let added = 0, duplicates = 0;
  for (const entry of imported.entries) {
    const existing = byId.get(entry.id);
    if (existing) {
      // The schema reconstructs each object in canonical field order before comparison.
      if (JSON.stringify(existing) !== JSON.stringify(entry))
        throw new TypeError("An imported entry has the same id as different work already in this notebook. No entries were imported; keep both exports.");
      duplicates++;
    } else {
      entries.push(entry); byId.set(entry.id, entry); added++;
    }
  }
  return Object.freeze({
    document: parseNotebookDocument({ ...current, entries, lastPlace: current.lastPlace ?? imported.lastPlace }),
    added,
    duplicates,
  });
}
