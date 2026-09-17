import { notebookFrameHref, parseNotebookDocument, type NotebookDocument } from "./schema.ts";

export function exportNotebookJson(document: NotebookDocument): string {
  return `${JSON.stringify(parseNotebookDocument(document), null, 2)}\n`;
}
function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
/** Self-contained, script-free private export. Text is never interpreted as HTML or Markdown. */
export function exportNotebookHtml(input: NotebookDocument): string {
  const document = parseNotebookDocument(input);
  const entries = document.entries.map((entry) => `<article><h2>${escapeHtml(entry.title)}</h2>
<p>${escapeHtml(entry.kind === "nextStep" ? "Next step" : entry.kind)} · ${escapeHtml(entry.frame.paper.replaceAll("-", " "))}</p>
<pre>${escapeHtml(entry.text)}</pre>
<a href="${escapeHtml(`https://annus-mirabilis.com${notebookFrameHref(entry.frame)}`)}">Return to this reading location</a></article>`).join("\n");
  const last = document.lastPlace;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>My Annus Mirabilis reading notebook</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:1.1rem/1.6 Georgia,serif}article{border-top:1px solid;padding:1rem 0}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}a{overflow-wrap:anywhere}@media print{article{break-inside:avoid}}</style></head>
<body><h1>My reading notebook</h1><p>Private reader notes, exported locally. These are not reviewed edition text. Nothing in this file runs a simulation or uploads notes.</p>
${last ? `<section><h2>Continue reading: ${escapeHtml(last.title)}</h2><p>${last.recapKind === "overview" ? "Saved authored overview" : "Saved authored recap"}; the current edition may have changed.</p><pre>${escapeHtml(last.recap)}</pre><a href="${escapeHtml(`https://annus-mirabilis.com${notebookFrameHref(last.frame)}`)}">Continue where you were</a></section>` : ""}
${entries || "<p>No saved entries.</p>"}</body></html>\n`;
}
