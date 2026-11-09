import {
  changedInvestigationParameters,
  exportInvestigationHtml,
  exportInvestigationJson,
  INVESTIGATION_LIMITS,
  type InvestigationChange,
  type InvestigationReport,
  type InvestigationStore,
  type InvestigationTask,
  type Observation,
  type Reading,
} from "./core.ts";
import { readInvestigationImport } from "./import.ts";

let sequence = 0;
const STATUS_WORDS: Readonly<Record<string, string>> = {
  symbolic: "Symbolic result",
  "analytic-limit": "A limiting result",
  underdetermined: "Not determined by these inputs",
  "not-applicable": "Not applicable in this case",
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
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join(" ");
  return `${STATUS_WORDS[String(output.status)] ?? "No numeric reading"}${reason ? `. ${reason}` : ""}`;
}
/** Native island, exercised in a real browser without loading a second physics implementation. */
export function mountInvestigationWorkspace(
  host: HTMLElement,
  store: InvestigationStore,
  task: InvestigationTask,
) {
  const spec = store.spec;
  if (task.promptId !== spec.promptId)
    throw new TypeError("The investigation and task do not match.");
  const prefix = `investigation-${++sequence}`;
  const events = new AbortController();
  const urls = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;
  function node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  function button(label: string, action: () => void) {
    const element = node("button", label);
    element.type = "button";
    element.addEventListener(
      "click",
      () => {
        if (!disposed) action();
      },
      { signal: events.signal },
    );
    return element;
  }
  const root = node("section");
  root.className = "investigation-workspace";
  root.dataset.investigation = spec.promptId;
  const title = node("h4", "Your prediction, the readings, and your explanation");
  title.id = `${prefix}-title`;
  root.setAttribute("aria-labelledby", title.id);
  const privacy = node(
    "p",
    "Nothing is uploaded. The saving notice above shows whether this browser is keeping a copy on this device. Download the investigation before leaving if it is not being saved. Captures are model calculations, not observations or a correctness certificate; results elsewhere on this page are not hidden from you.",
  );
  privacy.className = "fine";
  const availability = node("p");
  availability.setAttribute("role", "status");
  availability.setAttribute("aria-live", "polite");
  const restoredNotice = node(
    "p",
    "These saved readings belong to an earlier laboratory session. You can revise the explanation; start another investigation to capture readings from the current laboratory.",
  );
  restoredNotice.className = "fine";
  restoredNotice.dataset.investigationRestored = "";
  const error = node("p");
  error.setAttribute("role", "alert");
  const feedback = node("p");
  feedback.setAttribute("role", "status");
  const importHelp = node("p");
  importHelp.hidden = true;
  const predictionLabel = node("label", "What do you predict, and why?");
  const prediction = node("textarea");
  prediction.id = `${prefix}-prediction`;
  predictionLabel.htmlFor = prediction.id;
  prediction.rows = 3;
  prediction.maxLength = INVESTIGATION_LIMITS.prediction;
  const begin = button("Pin prediction and starting reading", () => {
    const result = store.begin(prediction.value, task);
    show(
      result,
      "Prediction and starting reading pinned. Change the laboratory next; later results cannot rewrite your prediction.",
    );
    if (result.ok) lab.focus();
  });
  const starting = node("div");
  starting.append(predictionLabel, prediction, begin);
  const committed = node("p");
  committed.className = "investigation-words";
  committed.dataset.investigationPrediction = "";
  const lab = node("a", "Go to this task's laboratory on this page");
  lab.href = `#${spec.laboratoryAnchor}`;
  const labLine = node("p");
  labLine.append(lab);
  const live = node("div");
  live.dataset.investigationCurrent = "";
  const nameLabel = node("label", "Label for the changed reading (optional)");
  const name = node("input");
  name.id = `${prefix}-label`;
  nameLabel.htmlFor = name.id;
  name.maxLength = INVESTIGATION_LIMITS.label;
  // This island may be embedded in an Apply form. Metadata must not submit or change the lab.
  name.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" && !event.isComposing) event.preventDefault();
    },
    { signal: events.signal },
  );
  const capture = button("Capture changed reading", () => {
    const count = store.getSnapshot().report?.observations.length ?? 0;
    const result = store.capture(name.value.trim() || `Comparison ${count + 1}`);
    show(
      result,
      "Reading captured. Both the starting settings and the changed settings are kept below.",
    );
    if (result.ok) name.value = "";
  });
  const captureTools = node("div");
  captureTools.append(nameLabel, name, capture);
  const readings = node("div");
  readings.className = "investigation-readings";
  const explanationLabel = node(
    "label",
    "Explain what changed, what stayed fixed, and what this model cannot establish",
  );
  const explanation = node("textarea");
  explanation.id = `${prefix}-explanation`;
  explanationLabel.htmlFor = explanation.id;
  explanation.rows = 5;
  explanation.maxLength = INVESTIGATION_LIMITS.explanation;
  const saveExplanation = button("Keep my explanation", () =>
    show(
      store.explain(explanation.value),
      "Explanation added to this investigation. Download it to keep a copy.",
    ),
  );
  const reflection = node("div");
  reflection.append(explanationLabel, explanation, saveExplanation);
  const controls = node("div");
  controls.className = "investigation-actions";
  const json = button("Download investigation JSON", () => download(false));
  const html = button("Download printable investigation", () => download(true));
  const restart = button("Start another investigation", () => {
    confirmation.hidden = false;
    confirm.focus();
  });
  controls.append(json, html, restart);
  const confirmation = node("div");
  confirmation.hidden = true;
  confirmation.append(
    node(
      "p",
      "Download first to take this prediction and its captured readings elsewhere. Starting another replaces this investigation on this page and clears its saved copy when storage is available. It does not reset the laboratory.",
    ),
  );
  const confirm = button("Replace this investigation", () => {
    const result = store.restartConfirmed();
    if (!result.ok) {
      show(result, "");
      return;
    }
    prediction.value = "";
    explanation.value = "";
    name.value = "";
    confirmation.hidden = true;
    error.textContent = "";
    feedback.textContent =
      result.message ??
      "New investigation. The copy kept on this device is cleared; the laboratory itself is unchanged.";
    prediction.focus();
  });
  confirmation.append(
    confirm,
    button("Keep this investigation", () => {
      confirmation.hidden = true;
      restart.focus();
    }),
  );
  const transfer = node("details");
  transfer.dataset.investigationImport = "";
  transfer.append(node("summary", "Open an investigation JSON file"));
  transfer.append(
    node(
      "p",
      "Choose an investigation you downloaded from this journey, up to 256 KiB. The file is read only on this device. Review it before opening; your current work stays here until you choose to replace it.",
    ),
  );
  const fileLabel = node("label", "Investigation JSON file");
  const fileInput = node("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.id = `${prefix}-import`;
  fileLabel.htmlFor = fileInput.id;
  const importPreview = node("div");
  importPreview.hidden = true;
  importPreview.dataset.investigationImportPreview = "";
  const importedTask = node("p");
  const importedPrediction = node("p");
  importedPrediction.className = "investigation-words";
  const importedExplanation = node("p");
  importedExplanation.className = "investigation-words";
  const importWarning = node("p");
  let importSequence = 0;
  let pendingImport: {
    report: InvestigationReport;
    reviewedReport: InvestigationReport | null;
    prediction: string;
    explanation: string;
    observationLabel: string;
  } | null = null;
  function cancelImport() {
    importSequence++;
    pendingImport = null;
    fileInput.value = "";
    importPreview.hidden = true;
    importHelp.hidden = true;
  }
  const openImport = button("Open this investigation", () => {
    const pending = pendingImport;
    if (!pending) return;
    if (
      store.getSnapshot().report !== pending.reviewedReport ||
      prediction.value !== pending.prediction ||
      explanation.value !== pending.explanation ||
      name.value !== pending.observationLabel
    ) {
      error.textContent =
        "Your work changed while you were reviewing this file. Choose the file again to review it against your current work. Nothing here was replaced.";
      cancelImport();
      return;
    }
    const current = store.getSnapshot().report;
    if (current && exportInvestigationJson(current) === exportInvestigationJson(pending.report)) {
      feedback.textContent =
        "This investigation is already open. Your typed explanation and saved copy are unchanged.";
      error.textContent = "";
      cancelImport();
      return;
    }
    if (current) {
      const cleared = store.restartConfirmed();
      if (!cleared.ok) {
        show(cleared, "");
        return;
      }
    }
    const opened = store.restore(pending.report);
    if (!opened.ok) {
      show(opened, "");
      return;
    }
    prediction.value = "";
    name.value = "";
    explanation.value = pending.report.explanation;
    confirmation.hidden = true;
    show(
      opened,
      "Investigation opened. These are saved model readings, not results from this laboratory session. You can finish your explanation and download it. Start another investigation to capture new readings.",
    );
    cancelImport();
    explanation.focus();
  });
  const cancel = button("Keep my current work", () => {
    cancelImport();
    feedback.textContent = "File import cancelled. Your work is unchanged.";
    error.textContent = "";
    fileInput.focus();
  });
  importPreview.append(
    node("h5", "Review the saved investigation"),
    importedTask,
    importedPrediction,
    importedExplanation,
    importWarning,
    openImport,
    cancel,
  );
  transfer.append(fileLabel, fileInput, importPreview, importHelp);
  fileInput.addEventListener(
    "change",
    async () => {
      const file = fileInput.files?.[0];
      cancelImport();
      if (!file) return;
      const request = importSequence;
      error.textContent = "";
      feedback.textContent = "Reading the investigation file on this device.";
      const result = await readInvestigationImport(file, spec);
      if (disposed || request !== importSequence) return;
      feedback.textContent = "";
      if (!result.ok) {
        error.textContent = result.message;
        if (result.journeyHref) {
          const link = node("a", "Open the discovery journey for this file");
          link.href = result.journeyHref;
          importHelp.replaceChildren(link);
          importHelp.hidden = false;
        }
        return;
      }
      pendingImport = {
        report: result.report,
        reviewedReport: store.getSnapshot().report,
        prediction: prediction.value,
        explanation: explanation.value,
        observationLabel: name.value,
      };
      importedTask.textContent = `Saved task: ${result.report.task.task}`;
      importedPrediction.textContent = `Pinned prediction: ${result.report.prediction}`;
      importedExplanation.textContent = `Saved explanation: ${result.report.explanation || "No explanation saved yet."}`;
      importWarning.textContent =
        `This file holds a starting reading and ${result.report.observations.length} changed readings. ` +
        (pendingImport.reviewedReport
          ? "Replacing will remove the investigation currently open here, including any typed explanation or comparison name. Download your current investigation first if you want to keep both."
          : "Opening will replace any prediction you have typed here. It does not run or change the laboratory.");
      openImport.textContent = pendingImport.reviewedReport
        ? "Replace with this investigation"
        : "Open this investigation";
      importPreview.hidden = false;
      feedback.textContent = "The file is ready to review. Nothing has been replaced.";
      openImport.focus();
    },
    { signal: events.signal },
  );
  const sourceLine = node("p");
  const sourceLink = node("a", "Return to the source argument");
  sourceLink.href = spec.sourceHref;
  sourceLine.append(sourceLink);
  root.append(
    title,
    privacy,
    starting,
    committed,
    availability,
    restoredNotice,
    labLine,
    live,
    captureTools,
    readings,
    reflection,
    controls,
    confirmation,
    transfer,
    error,
    feedback,
    sourceLine,
  );
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
      section.append(
        node(
          "p",
          changed.length === 0
            ? "No accepted settings changed. This is another publication, not a single-setting perturbation."
            : changed.length === 1
              ? "One accepted setting changed from the starting reading."
              : `${changed.length} accepted settings changed. Do not attribute the difference to just one of them.`,
        ),
      );
      if (changed.length) {
        const list = node("dl");
        for (const key of changed) {
          list.append(
            node("dt", spec.parameterLabels[key] ?? key),
            node(
              "dd",
              `${number(baseline.parameters[key] ?? "not present")} → ${number(reading.parameters[key] ?? "not present")}`,
            ),
          );
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
      if (
        earlier &&
        (earlier.unit !== output.unit ||
          earlier.semanticKind !== output.semanticKind ||
          earlier.ownerId !== output.ownerId)
      ) {
        values.append(
          node(
            "dd",
            "The unit, meaning, or computational owner changed; these readings are not a like-for-like numeric comparison.",
          ),
        );
      }
      if (output.uncertainty !== undefined)
        values.append(
          node(
            "dd",
            "This reading carries uncertainty or a qualification. Inspect its complete metadata below before comparing it.",
          ),
        );
    }
    section.append(
      values,
      node(
        "p",
        reading.origin === "prepared-worked-example"
          ? "Prepared worked example, not a measurement."
          : "Accepted laboratory calculation, not a measurement.",
      ),
    );
    const details = node("details");
    details.append(node("summary", "Exact values, accepted settings, identity and qualifications"));
    const raw = node(
      "pre",
      JSON.stringify(
        reading,
        (_key, value) => (Object.is(value, -0) ? "−0 (signed numeric zero)" : value),
        2,
      ),
    );
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
    if (availability.textContent !== state.availability)
      availability.textContent = state.availability;
    restoredNotice.hidden = !state.restored;
    starting.hidden = report !== null;
    committed.hidden = report === null;
    committed.textContent = report ? `Your pinned prediction: ${report.prediction}` : "";
    begin.disabled = state.current === null;
    captureTools.hidden = report === null;
    capture.disabled =
      state.restored ||
      !state.current ||
      !report ||
      report.observations.length >= INVESTIGATION_LIMITS.observations;
    reflection.hidden = !report;
    controls.hidden = !report;
    if (report && document.activeElement !== explanation && !explanation.value)
      explanation.value = report.explanation;
    const nextLive = JSON.stringify(state.current);
    if (nextLive !== liveKey) {
      liveKey = nextLive;
      live.replaceChildren();
      if (state.current) {
        const current = node("details");
        current.append(
          node("summary", "Inspect the laboratory's current accepted reading"),
          readingCard({ label: "Current, not yet pinned", reading: state.current }),
        );
        live.append(current);
      }
    }
    if (lastBaseline !== report?.baseline.reading || lastObservations !== report?.observations) {
      lastBaseline = report?.baseline.reading;
      lastObservations = report?.observations;
      readings.replaceChildren();
      if (report) {
        readings.append(
          node(
            "p",
            `Starting reading plus ${report.observations.length} of ${INVESTIGATION_LIMITS.observations} comparison readings. Display numbers use six significant figures; exact values and metadata are retained below and in the export.`,
          ),
        );
        readings.append(readingCard(report.baseline));
        for (const observation of report.observations)
          readings.append(readingCard(observation, report.baseline.reading));
      }
    }
  }
  function download(printable: boolean) {
    // Downloading the draft just reviewed is the recommended way to keep both investigations.
    // Its save changes the report object, but must not invalidate that unchanged review.
    const reviewed =
      pendingImport?.reviewedReport === store.getSnapshot().report &&
      pendingImport?.explanation === explanation.value &&
      pendingImport?.prediction === prediction.value &&
      pendingImport?.observationLabel === name.value;
    // Typed reflection is included deliberately; an invalid draft must not produce an older export.
    const saved = store.explain(explanation.value);
    if (!saved.ok) {
      show(saved, "");
      return;
    }
    const report = store.getSnapshot().report;
    if (!report) return;
    if (reviewed && pendingImport) pendingImport.reviewedReport = report;
    let url: string | undefined;
    try {
      const text = printable ? exportInvestigationHtml(report) : exportInvestigationJson(report);
      url = URL.createObjectURL(
        new Blob([text], { type: printable ? "text/html;charset=utf-8" : "application/json" }),
      );
      const link = node("a");
      link.href = url;
      link.download = `${spec.paper}-investigation.${printable ? "html" : "json"}`;
      root.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const keep = url;
      urls.set(
        keep,
        setTimeout(() => {
          URL.revokeObjectURL(keep);
          urls.delete(keep);
        }, 1000),
      );
      feedback.textContent =
        "Investigation file prepared. It includes your prediction, selected readings and their metadata, and your explanation. Keep the file private.";
      error.textContent = "";
    } catch {
      if (url) URL.revokeObjectURL(url);
      error.textContent =
        "The download could not start. Your investigation and typed explanation remain in this page.";
    }
  }
  const off = store.subscribe(render);
  store.refresh();
  render();
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      off();
      events.abort();
      root.remove();
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    },
  });
}
