import {
  INVESTIGATION_LIMITS,
  changedInvestigationParameters,
  exportInvestigationHtml,
  exportInvestigationJson,
  type InvestigationChange,
  type InvestigationStore,
  type InvestigationTask,
  type Observation,
  type Reading,
} from "./core.ts";

let sequence = 0;
const STATUS_WORDS: Readonly<Record<string, string>> = {
  symbolic: "Symbolic result", "analytic-limit": "A limiting result",
  underdetermined: "Not determined by these inputs", "not-applicable": "Not applicable in this case",
  "outside-domain": "Outside this model's domain",
};
function number(value: unknown): string {
  if (typeof value !== "number") return String(value);
  if (Object.is(value, -0)) return "−0";
  return Number(value.toPrecision(6)).toString();
}
function resultText(output: Reading["outputs"][number]): string {
  if (output.status === "value") return `${number(output.value)} ${output.unit}`;
  const reason = [output.reason, output.compatibleFamily, output.expression, output.limitExpression]
    .filter((item): item is string => typeof item === "string" && item.length > 0).join(" ");
  return `${STATUS_WORDS[String(output.status)] ?? "No numeric reading"}${reason ? `. ${reason}` : ""}`;
}
/** Native island, exercised in a real browser without loading a second physics implementation. */
export function mountInvestigationWorkspace(
  host: HTMLElement,
  store: InvestigationStore,
  task: InvestigationTask,
) {
  const spec = store.spec;
  if (task.promptId !== spec.promptId) throw new TypeError("The investigation and task do not match.");
  const prefix = `investigation-${++sequence}`;
  const events = new AbortController();
  const urls = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;
  function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  function button(label: string, action: () => void) {
    const element = node("button", label);
    element.type = "button";
    element.addEventListener("click", () => { if (!disposed) action(); }, { signal: events.signal });
    return element;
  }
  const root = node("section");
  root.className = "investigation-workspace";
  root.dataset.investigation = spec.promptId;
  const title = node("h4", "Your prediction, the readings, and your explanation");
  title.id = `${prefix}-title`;
  root.setAttribute("aria-labelledby", title.id);
  const privacy = node("p", "This work stays in this page until you download it. Nothing is uploaded. Captures are model calculations, not observations or a correctness certificate; results elsewhere on this page are not hidden from you.");
  privacy.className = "fine";
  const availability = node("p");
  availability.setAttribute("role", "status");
  availability.setAttribute("aria-live", "polite");
  const error = node("p");
  error.setAttribute("role", "alert");
  const feedback = node("p");
  feedback.setAttribute("role", "status");
  const predictionLabel = node("label", "What do you predict, and why?");
  const prediction = node("textarea");
  prediction.id = `${prefix}-prediction`;
  predictionLabel.htmlFor = prediction.id;
  prediction.rows = 3;
  prediction.maxLength = INVESTIGATION_LIMITS.prediction;
  const begin = button("Pin prediction and starting reading", () => {
    const result = store.begin(prediction.value, task);
    show(result, "Prediction and starting reading pinned. Change the laboratory next; later results cannot rewrite your prediction.");
    if (result.ok) lab.focus();
  });
  const starting = node("div");
  starting.append(predictionLabel, prediction, begin);
  const committed = node("p");
  committed.className = "investigation-words";
  committed.dataset.investigationPrediction = "";
  const lab = node("a", "Go to this task's laboratory on this page");
  lab.href = `#${spec.laboratoryAnchor}`;
  const labLine = node("p"); labLine.append(lab);
  const live = node("div");
  live.dataset.investigationCurrent = "";
  const nameLabel = node("label", "Label for the changed reading (optional)");
  const name = node("input");
  name.id = `${prefix}-label`; nameLabel.htmlFor = name.id;
  name.maxLength = INVESTIGATION_LIMITS.label;
  // This island may be embedded in an Apply form. Metadata must not submit or change the lab.
  name.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) event.preventDefault(); }, { signal: events.signal });
  const capture = button("Capture changed reading", () => {
    const count = store.getSnapshot().report?.observations.length ?? 0;
    const result = store.capture(name.value.trim() || `Comparison ${count + 1}`);
    show(result, "Reading captured. Both the starting settings and the changed settings are kept below.");
    if (result.ok) name.value = "";
  });
  const captureTools = node("div");
  captureTools.append(nameLabel, name, capture);
  const readings = node("div");
  readings.className = "investigation-readings";
  const explanationLabel = node("label", "Explain what changed, what stayed fixed, and what this model cannot establish");
  const explanation = node("textarea");
  explanation.id = `${prefix}-explanation`; explanationLabel.htmlFor = explanation.id;
  explanation.rows = 5;
  explanation.maxLength = INVESTIGATION_LIMITS.explanation;
  const saveExplanation = button("Keep my explanation", () => show(store.explain(explanation.value), "Explanation kept in this page. Download the investigation to keep it after leaving."));
  const reflection = node("div");
  reflection.append(explanationLabel, explanation, saveExplanation);
  const controls = node("div"); controls.className = "investigation-actions";
  const json = button("Download investigation JSON", () => download(false));
  const html = button("Download printable investigation", () => download(true));
  const restart = button("Start another investigation", () => { confirmation.hidden = false; confirm.focus(); });
  controls.append(json, html, restart);
  const confirmation = node("div");
  confirmation.hidden = true;
  confirmation.append(node("p", "Download first to keep this prediction and its captured readings. Starting another replaces only this investigation in the page; it does not reset the laboratory."));
  const confirm = button("Replace this investigation", () => {
    prediction.value = ""; explanation.value = ""; name.value = "";
    confirmation.hidden = true;
    store.restartConfirmed();
    error.textContent = ""; feedback.textContent = "New investigation. The laboratory itself is unchanged.";
    prediction.focus();
  });
  confirmation.append(confirm, button("Keep this investigation", () => { confirmation.hidden = true; restart.focus(); }));
  const sourceLine = node("p");
  const sourceLink = node("a", "Return to the source argument"); sourceLink.href = spec.sourceHref;
  sourceLine.append(sourceLink);
  root.append(title, privacy, starting, committed, availability, labLine, live, captureTools, readings, reflection, controls, confirmation, error, feedback, sourceLine);
  host.append(root);

  function show(result: InvestigationChange, success: string) {
    error.textContent = result.ok ? "" : result.message;
    feedback.textContent = result.ok ? success : "";
  }
  function readingCard(observation: Observation, baseline?: Reading) {
    const { reading, label } = observation;
    const section = node("section");
    section.className = "investigation-reading";
    section.dataset.investigationReading = label;
    section.append(node("h5", label));
    if (baseline) {
      const changed = changedInvestigationParameters(baseline, reading);
      section.append(node("p", changed.length === 0
        ? "No accepted settings changed. This is another publication, not a single-setting perturbation."
        : changed.length === 1
          ? "One accepted setting changed from the starting reading."
          : `${changed.length} accepted settings changed. Do not attribute the difference to just one of them.`));
      if (changed.length) {
        const list = node("dl");
        for (const key of changed) {
          list.append(node("dt", spec.parameterLabels[key] ?? key), node("dd", `${number(baseline.parameters[key] ?? "not present")} → ${number(reading.parameters[key] ?? "not present")}`));
        }
        section.append(list);
      }
    }
    const values = node("dl");
    for (const quantity of spec.quantities) {
      const output = reading.outputs.find((candidate) => candidate.quantityId === quantity.id);
      if (!output) continue;
      const row = node("dd", resultText(output));
      row.dataset.investigationQuantity = quantity.id;
      values.append(node("dt", quantity.label), row);
      const earlier = baseline?.outputs.find((candidate) => candidate.quantityId === quantity.id);
      if (earlier && (earlier.unit !== output.unit || earlier.semanticKind !== output.semanticKind || earlier.ownerId !== output.ownerId)) {
        values.append(node("dd", "The unit, meaning, or computational owner changed; these readings are not a like-for-like numeric comparison."));
      }
      if (output.uncertainty !== undefined) values.append(node("dd", "This reading carries uncertainty or a qualification. Inspect its complete metadata below before comparing it."));
    }
    section.append(values, node("p", reading.origin === "prepared-worked-example" ? "Prepared worked example, not a measurement." : "Accepted laboratory calculation, not a measurement."));
    const details = node("details");
    details.append(node("summary", "Exact values, accepted settings, identity and qualifications"));
    const raw = node("pre", JSON.stringify(reading, (_key, value) => Object.is(value, -0) ? "−0 (signed numeric zero)" : value, 2));
    details.append(raw);
    section.append(details);
    return section;
  }
  let lastBaseline: Reading | undefined;
  let lastObservations: readonly Observation[] | undefined;
  let liveKey = "";
  function render() {
    if (disposed) return;
    const state = store.getSnapshot();
    const report = state.report;
    if (availability.textContent !== state.availability) availability.textContent = state.availability;
    starting.hidden = report !== null;
    committed.hidden = report === null;
    committed.textContent = report ? `Your pinned prediction: ${report.prediction}` : "";
    begin.disabled = state.current === null;
    captureTools.hidden = report === null;
    capture.disabled = !state.current || !report || report.observations.length >= INVESTIGATION_LIMITS.observations;
    reflection.hidden = !report;
    controls.hidden = !report;
    if (report && document.activeElement !== explanation && !explanation.value) explanation.value = report.explanation;
    const nextLive = JSON.stringify(state.current);
    if (nextLive !== liveKey) {
      liveKey = nextLive;
      live.replaceChildren();
      if (state.current) {
        const current = node("details");
        current.append(node("summary", "Inspect the laboratory's current accepted reading"), readingCard({ label: "Current, not yet pinned", reading: state.current }));
        live.append(current);
      }
    }
    if (lastBaseline !== report?.baseline.reading || lastObservations !== report?.observations) {
      lastBaseline = report?.baseline.reading;
      lastObservations = report?.observations;
      readings.replaceChildren();
      if (report) {
        readings.append(node("p", `Starting reading plus ${report.observations.length} of ${INVESTIGATION_LIMITS.observations} comparison readings. Display numbers use six significant figures; exact values and metadata are retained below and in the export.`));
        readings.append(readingCard(report.baseline));
        for (const observation of report.observations) readings.append(readingCard(observation, report.baseline.reading));
      }
    }
  }
  function download(printable: boolean) {
    // Typed reflection is included deliberately; an invalid draft must not produce an older export.
    const saved = store.explain(explanation.value);
    if (!saved.ok) { show(saved, ""); return; }
    const report = store.getSnapshot().report;
    if (!report) return;
    let url: string | undefined;
    try {
      const text = printable ? exportInvestigationHtml(report) : exportInvestigationJson(report);
      url = URL.createObjectURL(new Blob([text], { type: printable ? "text/html;charset=utf-8" : "application/json" }));
      const link = node("a");
      link.href = url; link.download = `${spec.paper}-investigation.${printable ? "html" : "json"}`;
      root.append(link);
      try { link.click(); } finally { link.remove(); }
      const keep = url;
      urls.set(keep, setTimeout(() => { URL.revokeObjectURL(keep); urls.delete(keep); }, 1000));
      feedback.textContent = "Investigation file prepared. It includes your prediction, selected readings and their metadata, and your explanation. Keep the file private.";
      error.textContent = "";
    } catch {
      if (url) URL.revokeObjectURL(url);
      error.textContent = "The download could not start. Your investigation and typed explanation remain in this page.";
    }
  }
  const off = store.subscribe(render);
  store.refresh();
  render();
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true; off(); events.abort(); root.remove();
      for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    },
  });
}
