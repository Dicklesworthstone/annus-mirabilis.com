import { comparisonDisplay } from "../../experiments/compare/comparisonStatement.ts";
import { capstoneCaptureHref, capstoneCaptureText } from "./capstoneEntry.ts";
import { comparisonReplayAdapter } from "./comparisonAdapters.ts";
import { exerciseResponseHref, exerciseResponseText } from "./exerciseEntry.ts";
import {
  type NotebookDocument,
  type NotebookExerciseEntry,
  type NotebookReplayEntry,
  type NotebookTeachBackEntry,
  notebookFrameHref,
  parseNotebookDocument,
} from "./schema.ts";
import { teachBackHref } from "./teachBackEntry.ts";

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
  const adapter = comparisonReplayAdapter(replay.baseline.experimentId);
  const candidate =
    prediction?.form === "candidate" && "candidateId" in prediction.payload
      ? prediction.payload.candidateId
      : "";
  const rows = adapter.contract.outputs
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
<p>${escapeHtml(adapter.evidenceDescription)} The table shows five significant figures; the page showed ${replay.displaySignificantDigits}. The full values are below.</p>
<p>Your prediction: ${escapeHtml(Object.hasOwn(adapter.predictions, candidate) ? adapter.predictions[candidate as keyof typeof adapter.predictions] : "none made before you ran it")}</p>
<p>${escapeHtml(replay.statement)}</p><table><caption>The comparison you saved</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Baseline</th><th scope="col">Variant</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Your explanation before</h3><pre>${escapeHtml(replay.explanationBefore)}</pre>
<h3>Your explanation after</h3><pre>${escapeHtml(replay.explanationAfter)}</pre>
<details><summary>Everything saved with it: versions, seeds, full-precision results and the settings to run it again</summary><pre>${escapeHtml(JSON.stringify(entry, null, 2))}</pre></details></section>`;
}
function teachBackHtml(entry: NotebookTeachBackEntry): string {
  return `<section><h3>The question when you answered</h3><p>${escapeHtml(entry.teachBack.prompt)}</p><h3>Your explanation</h3><pre>${escapeHtml(entry.text)}</pre><p>Saved ${escapeHtml(entry.createdAt)}, with guide revision ${escapeHtml(entry.teachBack.guideRevision)}. Earlier explanations are kept separately; none is assessed.</p></section>`;
}
function exerciseHtml(entry: NotebookExerciseEntry): string {
  return `<section><h3>The question when you answered</h3><p>${escapeHtml(entry.exercise.prompt)}</p><h3>Your saved response</h3><pre>${escapeHtml(exerciseResponseText(entry.text, entry.exercise))}</pre><p>Saved ${escapeHtml(entry.createdAt)}, with guide revision ${escapeHtml(entry.exercise.guideRevision)}. This is your response, not a current checker verdict. Return to the exercise to check it again.</p></section>`;
}
/** Self-contained, script-free private export. Text is never interpreted as HTML or Markdown. */
export function exportNotebookHtml(input: NotebookDocument): string {
  const document = parseNotebookDocument(input);
  const entries = document.entries
    .map(
      (entry) => `<article><h2>${escapeHtml(entry.title)}</h2>
<p>${escapeHtml(entry.kind === "nextStep" ? "Next step" : entry.kind === "teachBack" ? "Teach-back explanation" : entry.kind === "exercise" ? "Exercise response" : entry.kind)} · ${escapeHtml(entry.frame.paper.replaceAll("-", " "))}</p>
${entry.kind === "teachBack" ? teachBackHtml(entry) : entry.kind === "exercise" ? exerciseHtml(entry) : `<pre>${escapeHtml(entry.text)}</pre>`}
${entry.kind === "replay" ? replayHtml(entry) : entry.kind === "capstone" ? `<section><h3>Snapshot saved ${escapeHtml(entry.createdAt)}</h3><pre>${escapeHtml(capstoneCaptureText(entry.capstone))}</pre></section>` : ""}
<a href="${escapeHtml(`https://annus-mirabilis.com${entry.kind === "capstone" ? capstoneCaptureHref(entry.capstone) : entry.kind === "teachBack" ? teachBackHref(entry.frame.paper, entry.teachBack) : entry.kind === "exercise" ? exerciseResponseHref(entry.frame.paper, entry.exercise) : notebookFrameHref(entry.frame)}`)}">${entry.kind === "capstone" ? "Open this capstone" : entry.kind === "teachBack" ? "Return to this question" : entry.kind === "exercise" ? "Return to this exercise" : "Return to this passage"}</a></article>`,
    )
    .join("\n");
  const last = document.lastPlace;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>My Annus Mirabilis reading notebook</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:1.1rem/1.6 Georgia,serif}article{border-top:1px solid;padding:1rem 0}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}a{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:.85em}th,td{border:1px solid;padding:.3em;text-align:left;overflow-wrap:anywhere}@media print{article{break-inside:avoid}}</style></head>
<body><h1>My reading notebook</h1><p>Your notes and saved passages, kept in this browser. Copied passages are labeled as excerpts. Nothing in this file runs a calculation or sends anything anywhere.</p>
${last ? `<section><h2>Continue reading: ${escapeHtml(last.title)}</h2><p>${last.recapKind === "source-excerpt" ? "An excerpt from the passage" : last.recapKind === "overview" ? "The overview" : "The recap"} as it read when you saved it; the edition may have changed since.</p><pre>${escapeHtml(last.recap)}</pre><a href="${escapeHtml(`https://annus-mirabilis.com${notebookFrameHref(last.frame)}`)}">Continue where you were</a></section>` : ""}
${entries || "<p>No saved entries.</p>"}</body></html>\n`;
}
