/**
 * The caption a lesson link carries back to its passage: "Return to <label>." A label that already
 * ends a sentence keeps its own mark, so a question stays a question: "Return to What would let us
 * count molecules?" rather than "…molecules?.", which live served on 2026-09-24. Readers meet the
 * caption in search results, the offline chapter and the Markdown export.
 */
export function returnCaption(label: string): string {
  const trimmed = label.trim();
  return /[.?!]$/.test(trimmed) ? `Return to ${trimmed}` : `Return to ${trimmed}.`;
}
