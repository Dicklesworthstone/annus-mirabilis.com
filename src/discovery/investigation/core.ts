/**
 * A reader's prediction and a bounded comparison of accepted laboratory readings.
 * This is teaching composition (am-disc-ppe-teachback-wnp7), never a numerical owner.
 * No DOM, React, storage, clocks, network, or replay execution lives on this path.
 */
export const INVESTIGATION_LIMITS = Object.freeze({
  prediction: 4000,
  explanation: 8000,
  label: 160,
  observations: 6,
  bytes: 262144,
});
export type InvestigationSpec = Readonly<{
  paper: string;
  promptId: string;
  experimentId: string;
  laboratoryAnchor: string;
  sourceHref: string;
  quantities: readonly Readonly<{ id: string; label: string }>[];
  parameterLabels: Readonly<Record<string, string>>;
}>;
export type InvestigationTask = Readonly<{
  promptId: string;
  task: string;
  perturbPrompt: string;
  explainPrompt: string;
}>;
type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type Reading = Readonly<{
  experimentId: string;
  instanceId: string;
  runId: string;
  actionIndex: number;
  snapshotVersion: number;
  stepIndex: number;
  simulationTime: number;
  revisions: Readonly<Record<string, number>>;
  parameters: Readonly<Record<string, number | string | boolean>>;
  sourceDigest: string;
  origin: "prepared-worked-example" | "accepted-laboratory-result";
  /** Complete selected scalar results, including owners, status, domain and uncertainty. */
  outputs: readonly Readonly<Record<string, Json>>[];
}>;
export type Observation = Readonly<{ label: string; reading: Reading }>;
export type InvestigationReport = Readonly<{
  format: "annus-discovery-investigation";
  version: 1;
  paper: string;
  experimentId: string;
  promptId: string;
  sourceHref: string;
  task: InvestigationTask;
  prediction: string;
  baseline: Observation;
  observations: readonly Observation[];
  explanation: string;
}>;
export type InvestigationState = Readonly<{
  current: Reading | null;
  availability: string;
  report: InvestigationReport | null;
}>;
export type InvestigationChange = Readonly<{ ok: true } | { ok: false; message: string }>;
/** The existing session is the owner. Its view is read afresh at every explicit capture. */
export type InvestigationSource = Readonly<{
  getSnapshot(): unknown;
  getServerSnapshot?(): unknown;
  subscribe(listener: () => void): () => void;
}>;
const ok = Object.freeze({ ok: true as const });
const refused = (message: string): InvestigationChange => ({ ok: false, message });
const REVISION_KEYS = ["input", "observer", "measurement", "estimator"] as const;
const STATUSES = new Set([
  "value",
  "symbolic",
  "analytic-limit",
  "underdetermined",
  "not-applicable",
  "outside-domain",
]);
function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError("A laboratory record is not a plain object.");
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      !("value" in (Object.getOwnPropertyDescriptor(value, key) ?? {}))
    )
      throw new TypeError("A laboratory record contains a non-data property.");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 4096, empty = false): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim()))
    throw new TypeError("Text is missing or exceeds this investigation's limit.");
  for (const c of value) {
    const n = c.codePointAt(0) ?? 0;
    if (n < 32 && n !== 9 && n !== 10 && n !== 13)
      throw new TypeError("Text contains a control character.");
  }
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("A laboratory identity is missing a nonnegative integer.");
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError("A laboratory number is not finite.");
  return value;
}
/** Detach without invoking accessors or silently losing unsupported values through JSON.stringify. */
function copyJson(value: unknown, depth = 0, budget = { nodes: 12000 }): Json {
  if (--budget.nodes < 0 || depth > 16)
    throw new TypeError("The selected readings exceed the recording bound.");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return finite(value);
  if (typeof value === "string") return text(value, 16000, true);
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => copyJson(item, depth + 1, budget)));
  const record = object(value);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record)
        // Optional properties with undefined values are not data; JSON's ordinary optional-field form.
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, copyJson(item, depth + 1, budget)]),
    ),
  );
}
function parameters(value: unknown): Reading["parameters"] {
  const record = object(value);
  if (Object.keys(record).length > 256) throw new TypeError("Too many laboratory settings.");
  const entries = Object.entries(record).map(([key, item]) => {
    text(key, 160);
    if (typeof item === "number") finite(item);
    else if (typeof item === "string") text(item, 4096, true);
    else if (typeof item !== "boolean")
      throw new TypeError("A laboratory setting cannot be captured.");
    return [key, item] as const;
  });
  return Object.freeze(Object.fromEntries(entries));
}
function sameParameters(a: Reading["parameters"], b: Reading["parameters"]): boolean {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([key, value]) => Object.hasOwn(b, key) && Object.is(value, b[key]))
  );
}
function revisions(value: unknown): Reading["revisions"] {
  const record = object(value);
  return Object.freeze(Object.fromEntries(REVISION_KEYS.map((key) => [key, integer(record[key])])));
}
/** JSON numbers round-trip binary64 values; explicitly preserve the otherwise-lost sign of zero. */
function exactJson(value: unknown, level = 0): string {
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : JSON.stringify(finite(value));
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  const pad = "  ".repeat(level + 1),
    end = "  ".repeat(level);
  if (Array.isArray(value))
    return value.length
      ? `[\n${value.map((item) => pad + exactJson(item, level + 1)).join(",\n")}\n${end}]`
      : "[]";
  const entries = Object.entries(object(value)).filter(([, item]) => item !== undefined);
  return entries.length
    ? `{\n${entries.map(([key, item]) => `${pad}${JSON.stringify(key)}: ${exactJson(item, level + 1)}`).join(",\n")}\n${end}}`
    : "{}";
}
function byteBound(report: unknown): void {
  if (new TextEncoder().encode(exactJson(report) + "\n").length > INVESTIGATION_LIMITS.bytes)
    throw new TypeError(
      "This investigation is full. Export it before starting another; no saved reading was discarded.",
    );
}
/** Reject retained-but-stale results, partial worker publications and refused requests. */
export function readInvestigationEvidence(
  spec: InvestigationSpec,
  source: InvestigationSource,
  sourceDigest: string,
): Readonly<{ current: Reading | null; availability: string }> {
  try {
    const view = object(source.getSnapshot());
    if (view.pending !== false || view.status !== "accepted")
      return {
        current: null,
        availability:
          "Wait for the laboratory to accept a complete result. A pending, paused, or refused request is not a new reading.",
      };
    const snapshot = object(view.accepted);
    const requested = object(view.requested);
    if (snapshot.final !== true || snapshot.experimentId !== spec.experimentId)
      throw new TypeError("The required laboratory has no complete accepted result.");
    const p = parameters(snapshot.parameters);
    const r = revisions(snapshot.revisions);
    const requestedRevisions = revisions(requested.revisions);
    for (const key of ["experimentId", "instanceId", "runId", "actionIndex"])
      if (snapshot[key] !== requested[key])
        throw new TypeError("The shown reading belongs to an earlier request.");
    if (
      REVISION_KEYS.some((key) => r[key] !== requestedRevisions[key]) ||
      !sameParameters(p, parameters(requested.parameters))
    )
      throw new TypeError("The accepted settings do not match the requested calculation.");
    if (!Array.isArray(snapshot.outputs))
      throw new TypeError("The laboratory did not publish its outputs.");
    const outputs = spec.quantities.map(({ id }) => {
      const matches = (snapshot.outputs as unknown[]).filter(
        (candidate) => object(candidate).quantityId === id,
      );
      if (matches.length !== 1)
        throw new TypeError(
          `This mode does not publish exactly one ${id} reading. Choose the task's laboratory mode.`,
        );
      const result = object(matches[0]);
      if (!STATUSES.has(String(result.status)))
        throw new TypeError(`The status of ${id} is not supported.`);
      text(result.ownerId);
      text(result.unit);
      text(result.semanticKind);
      if (result.status === "value") finite(result.value); // Array/trajectory outputs never get flattened to a number.
      return copyJson(result) as Readonly<Record<string, Json>>;
    });
    let prepared = false;
    // Identification of the prepared example is optional; failure must never earn that label.
    try {
      prepared = object(source.getServerSnapshot?.()).accepted === view.accepted;
    } catch {
      /* No server identity. */
    }
    const current: Reading = Object.freeze({
      experimentId: text(snapshot.experimentId, 160),
      instanceId: text(snapshot.instanceId),
      runId: text(snapshot.runId),
      actionIndex: integer(snapshot.actionIndex),
      snapshotVersion: integer(snapshot.snapshotVersion),
      stepIndex: integer(snapshot.stepIndex),
      simulationTime: finite(snapshot.simulationTime),
      revisions: r,
      parameters: p,
      sourceDigest: text(sourceDigest, 256),
      origin: prepared ? "prepared-worked-example" : "accepted-laboratory-result",
      outputs: Object.freeze(outputs),
    });
    byteBound(current);
    return {
      current,
      availability:
        "A complete accepted reading is ready to capture. Unapplied form edits are not included.",
    };
  } catch (error) {
    return {
      current: null,
      availability:
        error instanceof Error ? error.message : "The laboratory reading is unavailable.",
    };
  }
}
/** Exactly which accepted settings changed, including measurement and presentation choices. */
export function changedInvestigationParameters(a: Reading, b: Reading): readonly string[] {
  return [...new Set([...Object.keys(a.parameters), ...Object.keys(b.parameters)])]
    .filter(
      (key) =>
        !Object.hasOwn(a.parameters, key) ||
        !Object.hasOwn(b.parameters, key) ||
        !Object.is(a.parameters[key], b.parameters[key]),
    )
    .sort();
}
function samePublication(a: Reading, b: Reading): boolean {
  return (
    a.instanceId === b.instanceId &&
    a.runId === b.runId &&
    a.actionIndex === b.actionIndex &&
    a.snapshotVersion === b.snapshotVersion &&
    a.stepIndex === b.stepIndex &&
    REVISION_KEYS.every((key) => a.revisions[key] === b.revisions[key])
  );
}
/** An isolated teaching store per discovery route, connected to its existing laboratory session. */
export function createInvestigationStore(spec: InvestigationSpec) {
  const connections = new Map<object, { source: InvestigationSource; sourceDigest: string }>();
  const listeners = new Set<() => void>();
  let baselineSource: InvestigationSource | null = null;
  let state: InvestigationState = Object.freeze({
    current: null,
    availability: "The task's laboratory has not connected yet.",
    report: null,
  });
  function publish(next: InvestigationState) {
    state = Object.freeze(next);
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* One detached view cannot discard reader work. */
      }
    }
  }
  function connection() {
    return connections.size === 1 ? connections.values().next().value : undefined;
  }
  function refresh() {
    const active = connection();
    const next = active
      ? readInvestigationEvidence(spec, active.source, active.sourceDigest)
      : {
          current: null,
          availability:
            connections.size > 1
              ? "More than one laboratory placement is connected. No ambiguous reading will be captured."
              : "The task's laboratory is not connected. Previously captured readings are kept.",
        };
    publish({ ...state, ...next });
  }
  function change(work: () => void): InvestigationChange {
    try {
      work();
      return ok;
    } catch (error) {
      return refused(
        error instanceof Error ? error.message : "The investigation could not be changed.",
      );
    }
  }
  function replaceReport(report: InvestigationReport) {
    byteBound(report);
    publish({ ...state, report: Object.freeze(report) });
  }
  return Object.freeze({
    spec,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect(source: InvestigationSource, sourceDigest: string) {
      const token = {};
      connections.set(token, { source, sourceDigest });
      let off: (() => void) | undefined;
      try {
        off = source.subscribe(refresh);
        refresh();
      } catch {
        connections.delete(token);
        refresh();
      }
      return () => {
        connections.delete(token);
        try {
          off?.();
        } finally {
          refresh();
        }
      };
    },
    refresh,
    begin(prediction: string, task: InvestigationTask): InvestigationChange {
      return change(() => {
        if (state.report)
          throw new TypeError(
            "An investigation is already in progress. Export it before explicitly starting another.",
          );
        const words = text(prediction, INVESTIGATION_LIMITS.prediction);
        if (task.promptId !== spec.promptId)
          throw new TypeError("This prediction belongs to a different task.");
        const admittedTask = Object.freeze({
          promptId: task.promptId,
          task: text(task.task, 12000),
          perturbPrompt: text(task.perturbPrompt, 12000),
          explainPrompt: text(task.explainPrompt, 12000),
        });
        refresh(); // Read at the action, not merely at the last React render or effect.
        const active = connection();
        if (!state.current || !active) throw new TypeError(state.availability);
        const report: InvestigationReport = {
          format: "annus-discovery-investigation",
          version: 1,
          paper: spec.paper,
          promptId: spec.promptId,
          experimentId: spec.experimentId,
          sourceHref: spec.sourceHref,
          task: admittedTask,
          prediction: words,
          baseline: Object.freeze({ label: "Starting reading", reading: state.current }),
          observations: Object.freeze([]),
          explanation: "",
        };
        byteBound(report);
        baselineSource = active.source;
        replaceReport(report);
      });
    },
    capture(label: string): InvestigationChange {
      return change(() => {
        const report = state.report;
        if (!report) throw new TypeError("Record your prediction and starting reading first.");
        if (report.observations.length >= INVESTIGATION_LIMITS.observations)
          throw new TypeError(
            "All six comparison slots are used. Export this investigation before starting another.",
          );
        const name = text(label, INVESTIGATION_LIMITS.label);
        refresh();
        const current = state.current;
        if (!current) throw new TypeError(state.availability);
        if (
          connection()?.source !== baselineSource ||
          current.instanceId !== report.baseline.reading.instanceId
        )
          throw new TypeError(
            "The laboratory placement changed. Start a new investigation rather than mixing instances.",
          );
        if (current.sourceDigest !== report.baseline.reading.sourceDigest)
          throw new TypeError(
            "The laboratory source changed. Keep this investigation and start another with the new model.",
          );
        if (
          [report.baseline, ...report.observations].some((item) =>
            samePublication(item.reading, current),
          )
        )
          throw new TypeError(
            "This accepted reading is already captured. Apply a change and wait for a new result.",
          );
        replaceReport({
          ...report,
          observations: Object.freeze([
            ...report.observations,
            Object.freeze({ label: name, reading: current }),
          ]),
        });
      });
    },
    explain(explanation: string): InvestigationChange {
      return change(() => {
        if (!state.report)
          throw new TypeError("Begin an investigation before saving its explanation.");
        replaceReport({
          ...state.report,
          explanation: text(explanation, INVESTIGATION_LIMITS.explanation, true),
        });
      });
    },
    /** Caller supplies an explicit in-page confirmation; no calculation or storage is cleared. */
    restartConfirmed() {
      baselineSource = null;
      publish({ ...state, report: null });
    },
  });
}
export type InvestigationStore = ReturnType<typeof createInvestigationStore>;

/** JSON retains raw numbers and all selected result metadata; it is evidence to inspect, not executable replay. */
export function exportInvestigationJson(report: InvestigationReport): string {
  byteBound(report);
  return `${exactJson(report)}\n`;
}
const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
/** Self-contained, inert, printable report. No external resources or scripts accompany private text. */
export function exportInvestigationHtml(report: InvestigationReport): string {
  byteBound(report);
  const sections = [report.baseline, ...report.observations]
    .map(
      ({ label, reading }) =>
        `<section><h2>${escapeHtml(label)}</h2><p>${escapeHtml(reading.origin)} · ${escapeHtml(reading.experimentId)}</p><h3>Accepted settings</h3><pre>${escapeHtml(exactJson(reading.parameters))}</pre><h3>Selected readings and their metadata</h3><pre>${escapeHtml(exactJson(reading.outputs))}</pre><p>Instance ${escapeHtml(reading.instanceId)}; run ${escapeHtml(reading.runId)}; action ${reading.actionIndex}; snapshot ${reading.snapshotVersion}; source ${escapeHtml(reading.sourceDigest)}.</p></section>`,
    )
    .join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>My discovery investigation</title><style>body{max-width:52rem;margin:2rem auto;padding:0 1rem;font:1rem/1.6 system-ui}pre,p{white-space:pre-wrap;overflow-wrap:anywhere}pre{font-size:.85rem}section{border-top:1px solid;padding-top:1rem}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}}</style><main><h1>My discovery investigation</h1><p>Saved model calculations, not measurements or a correctness certificate. Capturing did not replay or independently verify the laboratory. The prediction records what was written when the starting reading was pinned; it does not establish that the reader had not already seen a result.</p><h2>The question</h2><p>${escapeHtml(report.task.task)}</p><h2>My prediction</h2><p>${escapeHtml(report.prediction)}</p><h2>What to change</h2><p>${escapeHtml(report.task.perturbPrompt)}</p>${sections}<h2>My explanation</h2><p>${escapeHtml(report.explanation || "No explanation saved yet.")}</p><p>Task ${escapeHtml(report.promptId)}. Source location: ${escapeHtml(report.sourceHref)}. Private notes; nothing was uploaded.</p></main></html>\n`;
}
