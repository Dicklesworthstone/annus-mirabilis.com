import { BM01_COMPARISON } from "../../experiments/bm01/comparison.ts";
import { comparisonDisplay } from "../../experiments/compare/comparisonStatement.ts";
import type { Baseline } from "../../experiments/compare/Baseline.ts";
import type { NotebookStore } from "./notebookStore.ts";
import { replayCompatibility, type ReplayCatalogue } from "./replayCompatibility.ts";
import { REPLAY_LIMITS, REPLAY_PREDICTIONS } from "./replayEntry.ts";
import type { createComparisonReplayRunner } from "./replayRunner.ts";
import { notebookFrameHref, type NotebookReplayEntry } from "./schema.ts";

type Runner = ReturnType<typeof createComparisonReplayRunner>;
export type ReplayViewEnvironment = Readonly<{
  loadCatalogue(): Promise<ReplayCatalogue>;
  createRunner(): Promise<Runner>;
}>;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.textContent = text; return element;
}
function button(text: string, action: () => void) {
  const b = node("button", text); b.type = "button"; b.className = "secondary"; b.addEventListener("click", action); return b;
}
function comparison(a: Baseline, b: Baseline, caption: string) {
  const region = node("div"); region.className = "replay-table";
  region.setAttribute("role", "region"); region.setAttribute("aria-label", caption); region.tabIndex = 0;
  const table = node("table"); table.append(node("caption", caption));
  const head = node("thead"), headings = node("tr");
  for (const text of ["Quantity", "Unit", "Baseline", "Variant"]) { const th = node("th", text); th.scope = "col"; headings.append(th); }
  head.append(headings); table.append(head); const body = node("tbody");
  for (const spec of BM01_COMPARISON.outputs) {
    const row = node("tr"), th = node("th", spec.label); th.scope = "row"; row.append(th, node("td", spec.displayUnit));
    for (const source of [a,b]) {
      const output = source.outputs[spec.id];
      row.append(node("td", output?.value === null || !output ? `${output?.status ?? "missing"}: ${output?.reason ?? "No numeric value"}` : comparisonDisplay(output.value, spec.displayFactor)));
    }
    body.append(row);
  }
  table.append(body); region.append(table); return region;
}
function rawEvidence(text: string, data: unknown) {
  const details = node("details"); details.append(node("summary", text), node("pre", JSON.stringify(data, null, 2))); return details;
}

/** Private text is assigned only via textContent/value. A saved entry never auto-runs a recipe. */
export function mountReplayView(host: HTMLElement, entry: NotebookReplayEntry, store: NotebookStore, environment: ReplayViewEnvironment) {
  const root = node("section"); root.className = "notebook-replay"; root.dataset.replayEntry = entry.id;
  const saved = entry.replay;
  root.append(node("h5", `What you saw on ${entry.createdAt} (model ${saved.baseline.identity.modelVersion})`),
    node("p", "Saved synthetic scalar readouts. They are not current results and do not include the latent trajectory history."));
  const prediction = saved.tape.predictions?.[0];
  const candidate = prediction?.form === "candidate" && "candidateId" in prediction.payload ? prediction.payload.candidateId : "";
  root.append(node("p", `Prediction: ${Object.hasOwn(REPLAY_PREDICTIONS, candidate) ? REPLAY_PREDICTIONS[candidate as keyof typeof REPLAY_PREDICTIONS] : "None recorded before this request"}`),
    node("p", saved.statement), comparison(saved.baseline, saved.variant, "Saved accepted comparison"));
  const fields = node("form"); fields.setAttribute("aria-label", "Edit your comparison explanations");
  const values = { before: saved.explanationBefore, after: saved.explanationAfter, notes: entry.text };
  const inputs = {} as Record<keyof typeof values, HTMLTextAreaElement>;
  for (const [key, label] of [["before", "Your explanation before"], ["after", "Your explanation after"], ["notes", "Your notes"]] as const) {
    const input = node("textarea"); input.rows = 4; input.maxLength = REPLAY_LIMITS.text; input.value = values[key];
    input.id = `replay-${entry.id}-${key}`; input.dataset.replayField = key;
    const heading = node("label", label); heading.htmlFor = input.id; fields.append(heading, input); inputs[key] = input;
  }
  const save = node("button", "Save explanations"); save.type = "submit"; fields.append(save);
  const error = node("p"); error.setAttribute("role", "alert");
  fields.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = store.updateReplayWords(entry.id, { before: inputs.before.value, after: inputs.after.value, notes: inputs.notes.value });
    error.textContent = result.ok ? "" : result.message;
    if (result.ok && !root.isConnected)
      document.querySelector<HTMLButtonElement>(`[data-replay-inspect="${entry.id}"]`)?.focus();
  });
  root.append(fields, node("p", "Your words are kept as written. They are not scored, analyzed or uploaded."),
    rawEvidence("All saved identities, revisions, full-precision outputs and replay recipe", entry));
  const compatibility = node("p", "Checking current model and passage revisions. No calculation has started.");
  const passage = node("a", "Open the current passage"); passage.href = notebookFrameHref(entry.frame);
  const runStatus = node("p", "Saved evidence only. No replay has started."); runStatus.setAttribute("role", "status");
  runStatus.setAttribute("aria-live", "polite"); runStatus.setAttribute("aria-atomic", "true");
  const fresh = node("section"); fresh.dataset.freshReplay = "true";
  const controls = node("div"); controls.className = "actions";
  let disposed = false, generation = 0, changedModel = false, runner: Runner | null = null, off: (() => void) | null = null;
  function clearRunner() { generation++; off?.(); off = null; runner?.dispose(); runner = null; }
  function renderFresh() {
    if (disposed || !runner) return;
    const state = runner.getSnapshot(); runStatus.textContent = state.message;
    const busy = ["checking", "baseline", "variant"].includes(state.phase);
    start.disabled = busy; stop.disabled = !busy; fresh.dataset.phase = state.phase;
    if (state.phase === "complete" && state.baseline && state.variant) {
      fresh.replaceChildren(node("h5", "New run — current evaluator results"),
        node("p", state.message), comparison(state.baseline, state.variant, "New accepted comparison — not the saved evidence"),
        rawEvidence("New run identities and full-precision outputs", {baseline:state.baseline,variant:state.variant}));
    }
  }
  const start = button("Replay saved comparison as a new run", () => {
    clearRunner(); const run = generation; start.disabled = true; stop.disabled = false; fresh.replaceChildren();
    runStatus.textContent = "Loading the current evaluator after your replay request.";
    void environment.createRunner().then((created) => {
      if (disposed || run !== generation) { created.dispose(); return; }
      runner = created; off = runner.subscribe(renderFresh); void runner.start(changedModel); renderFresh();
    }).catch(() => { if (!disposed && run === generation) { runStatus.textContent = "This browser could not load the current evaluator. Saved evidence is unchanged."; start.disabled = false; stop.disabled = true; } });
  });
  start.disabled = true;
  const stop = button("Stop replay", () => { clearRunner(); start.disabled = false; stop.disabled = true; runStatus.textContent = "Replay stopped. Saved evidence is unchanged."; });
  stop.disabled = true;
  controls.append(start,stop); root.append(compatibility,passage,controls,runStatus,error,fresh); host.append(root);
  void environment.loadCatalogue().then((catalogue) => {
    if (disposed) return;
    const status = replayCompatibility(saved, entry.frame.anchor, catalogue); changedModel = status.modelChanged;
    compatibility.textContent = `${status.modelMessage} ${status.passageMessage} ${status.aliasMessage}`;
    passage.href = status.anchor ? notebookFrameHref({...entry.frame,anchor:status.anchor}) : `/papers/${entry.frame.paper}/`;
    passage.textContent = status.anchor ? "Open the current passage" : "Open the saved paper";
    start.textContent = changedModel ? "Start a new run under the changed model" : "Replay saved comparison as a new run";
    start.disabled = false;
  }).catch(() => { if (!disposed) compatibility.textContent = "Current model identity could not be loaded. Saved evidence and exports remain available; replay is disabled."; });
  return Object.freeze({dispose(){disposed=true;clearRunner();root.remove();}});
}
