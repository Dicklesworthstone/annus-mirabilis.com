import { BM01_COMPARISON } from "../../experiments/bm01/comparison.ts";
import { comparisonDisplay } from "../../experiments/compare/comparisonStatement.ts";
import { REPLAY_PREDICTIONS } from "./replayEntry.ts";
import {
  type NotebookDocument,
  type NotebookReplayEntry,
  notebookFrameHref,
  parseNotebookDocument,
} from "./schema.ts";

export function exportNotebookJson(document: NotebookDocument): string {
  return `${JSON.stringify(parseNotebookDocument(document), null, 2)}\n`;
}
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function replayHtml(entry: NotebookReplayEntry): string {
  const replay = entry.replay,
    prediction = replay.tape.predictions?.[0];
  const candidate =
    prediction?.form === "candidate" && "candidateId" in prediction.payload
      ? prediction.payload.candidateId
      : "";
  const rows = BM01_COMPARISON.outputs
    .map((spec) => {
      const a = replay.baseline.outputs[spec.id],
        b = replay.variant.outputs[spec.id];
      function value(output: typeof a) {
        return output?.value === null || !output
          ? `${output?.status ?? "missing"}: ${output?.reason ?? "No numeric value"}`
          : comparisonDisplay(output.value, spec.displayFactor);
      }
      return `<tr><th scope="row">${escapeHtml(spec.label)}</th><td>${escapeHtml(spec.displayUnit)}</td><td>${escapeHtml(value(a))}</td><td>${escapeHtml(value(b))}</td></tr>`;
    })
    .join("");
  return `<section><h3>What you saw on ${escapeHtml(entry.createdAt)}, with version ${escapeHtml(replay.baseline.identity.modelVersion)} of the model</h3>
<p>These are the numbers you saw, from simulated particles, as they were when you saved them. They are not recomputed, and the particles' paths were not kept. The table shows five significant figures; the page showed ${replay.displaySignificantDigits}. The full values are below.</p>
<p>Your prediction: ${escapeHtml(Object.hasOwn(REPLAY_PREDICTIONS, candidate) ? REPLAY_PREDICTIONS[candidate as keyof typeof REPLAY_PREDICTIONS] : "none made before you ran it")}</p>
<p>${escapeHtml(replay.statement)}</p><table><caption>The comparison you saved</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Baseline</th><th scope="col">Variant</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Your explanation before</h3><pre>${escapeHtml(replay.explanationBefore)}</pre>
<h3>Your explanation after</h3><pre>${escapeHtml(replay.explanationAfter)}</pre>
<details><summary>Everything saved with it: versions, seeds, full-precision results and the settings to run it again</summary><pre>${escapeHtml(JSON.stringify(entry, null, 2))}</pre></details></section>`;
}
/** Self-contained, script-free private export. Text is never interpreted as HTML or Markdown. */
export function exportNotebookHtml(input: NotebookDocument): string {
  const document = parseNotebookDocument(input);
  const entries = document.entries
    .map(
      (entry) => `<article><h2>${escapeHtml(entry.title)}</h2>
<p>${escapeHtml(entry.kind === "nextStep" ? "Next step" : entry.kind)} · ${escapeHtml(entry.frame.paper.replaceAll("-", " "))}</p>
<pre>${escapeHtml(entry.text)}</pre>
${entry.kind === "replay" ? replayHtml(entry) : ""}
<a href="${escapeHtml(`https://annus-mirabilis.com${notebookFrameHref(entry.frame)}`)}">Return to this passage</a></article>`,
    )
    .join("\n");
  const last = document.lastPlace;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>My Annus Mirabilis reading notebook</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:1.1rem/1.6 Georgia,serif}article{border-top:1px solid;padding:1rem 0}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}a{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:.85em}th,td{border:1px solid;padding:.3em;text-align:left;overflow-wrap:anywhere}@media print{article{break-inside:avoid}}</style></head>
<body><h1>My reading notebook</h1><p>Your notes, saved from this browser. They are your words, not the edition's. Nothing in this file runs a calculation or sends anything anywhere.</p>
${last ? `<section><h2>Continue reading: ${escapeHtml(last.title)}</h2><p>${last.recapKind === "overview" ? "The overview" : "The recap"} as it read when you saved it; the edition may have changed since.</p><pre>${escapeHtml(last.recap)}</pre><a href="${escapeHtml(`https://annus-mirabilis.com${notebookFrameHref(last.frame)}`)}">Continue where you were</a></section>` : ""}
${entries || "<p>No saved entries.</p>"}</body></html>\n`;
}
