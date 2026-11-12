import { type DiscoveryNotebook, type NoteManifest, validateNotebook } from "../notebook.ts";
import { NOTE_PAPER_TITLES, noteStageHref } from "./manifest.ts";

function escapeHtml(value: string): string {
  const escapes: Readonly<Record<string, string>> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => escapes[character] ?? character);
}

/** A self-contained, printable local file. Reader text is never interpreted as markup. */
export function notebookHtml(document: DiscoveryNotebook, manifest: NoteManifest): string {
  const accepted = validateNotebook(document, manifest);
  const title = `${NOTE_PAPER_TITLES[manifest.paper]}: my discovery notes`;
  const revision =
    accepted.journeyRevision === manifest.revision
      ? `Guide revision: ${escapeHtml(accepted.journeyRevision)}.`
      : `Original guide revision: ${escapeHtml(accepted.journeyRevision)}. Compatible current guide revision: ${escapeHtml(manifest.revision)}.`;
  // Validation already requires every entry to belong to the manifest. Walk its published
  // stages in order, omitting only those on which the reader has not recorded a prediction.
  const entries = manifest.stages
    .map((stage) => {
      const entry = accepted.entries.find((item) => item.stageId === stage.id);
      if (!entry) return "";
      const href = `https://annus-mirabilis.com${noteStageHref(manifest, stage.id)}`;
      return `<section><h2><a href="${escapeHtml(href)}">${escapeHtml(stage.title)}</a></h2>${entry.attempts
        .map((attempt, index) => {
          const alternative = stage.alternatives.find((item) => item.id === attempt.alternativeId);
          return `<article><h3>Prediction ${index + 1}</h3><p>${escapeHtml(attempt.prediction)}</p>${alternative ? `<p>Tentative alternative: ${escapeHtml(alternative.title)}</p>` : ""}<h4>What I noticed</h4><p>${escapeHtml(attempt.observation) || "No observation recorded."}</p></article>`;
        })
        .join("")}</section>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:1rem/1.6 system-ui,sans-serif}section{border-top:1px solid;padding-top:1rem}p{white-space:pre-wrap;overflow-wrap:anywhere}article{margin-bottom:2rem}@media print{body{margin:0;max-width:none}article{break-inside:avoid}}</style></head><body><h1>${escapeHtml(title)}</h1><p>Private recorded predictions and observations. Draft fields are not included. ${revision}</p>${entries || "<p>No predictions recorded.</p>"}</body></html>`;
}
