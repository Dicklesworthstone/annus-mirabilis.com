"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  captureTracerEvidence,
  compareTracerEvidence,
  diffusivitySource,
  type EvidenceQuantity,
  type TracerEvidence,
  tracerEvidenceCsv,
} from "../../discovery/brownian/evidence.ts";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { BM01_FIELDS, fromTracerDraft, toTracerDraft } from "../../experiments/bm01/controls.ts";
import { BM01_OUTPUTS, type Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { encodeBm01Settings } from "../../experiments/bm01/permalink.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import type { PreparedBm06Example } from "../../experiments/bm06/session.ts";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { BrownianLab } from "../lab/BrownianLab.tsx";
import { display, identity } from "../lab/presentation.ts";
import { TracerPaths } from "../lab/TracerPlots.tsx";

const READOUTS: readonly [EvidenceQuantity, string, string, number][] = [
  ["observationInterval", "Observation interval", "s", 1],
  ["sampleMean", "Sample signed mean", "μm", 1e6],
  ["sampleMeanSquare", "Sample mean square", "μm²", 1e12],
  ["sampleRms", "Sample coordinate RMS", "μm", 1e6],
  ["rmsDisplacement1d", "Model coordinate RMS", "μm", 1e6],
  ["sampledApparentSpeed", "Sample apparent speed (selected dimension)", "μm/s", 1e6],
  ["modelApparentSpeed", "Model apparent speed (selected dimension)", "μm/s", 1e6],
  ["diffusionCoefficient", "Model diffusion coefficient", "μm²/s", 1e12],
];
function readout(record: TracerEvidence | null, quantity: EvidenceQuantity, factor: number) {
  if (!record) return "Awaiting a completed result";
  const output = record.outputs[quantity];
  return output.value === null ? output.status : display(output.value, factor);
}
function ratio(value: number | null) {
  return value === null ? "Not comparable" : `${display(value)} times the baseline`;
}

/** A teaching composition of the existing BM-01/BM-06 sessions, not a second numerical owner. */
export function BrownianInvestigation({
  tracerExample,
  spreadExample,
}: {
  tracerExample: PreparedBm01Example;
  spreadExample: PreparedBm06Example;
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm01Session(`investigation-${id}`, tracerExample, createBm01BrowserChannel),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const accepted = view.accepted ?? session.getServerSnapshot().accepted;
  if (!accepted) {
    throw new Error("Missing accepted snapshot for BrownianInvestigation");
  }
  const snapshot = accepted;
  const parameters = snapshot.parameters as Bm01Parameters;
  const current = snapshot.final
    ? captureTracerEvidence(snapshot, tracerExample.sourceDigest)
    : null;
  const [baseline, setBaseline] = useState(() => {
    const initAccepted = session.getServerSnapshot().accepted;
    if (!initAccepted) {
      throw new Error("Missing initial accepted snapshot for baseline");
    }
    return captureTracerEvidence(initAccepted, tracerExample.sourceDigest);
  });
  const [records, setRecords] = useState<readonly TracerEvidence[]>([baseline]);
  const [draft, setDraft] = useState(() => toTracerDraft(tracerExample.parameters));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [prediction, setPrediction] = useState("");
  useEffect(() => {
    setReady(true);
    return () => session.disconnect();
  }, [session]);
  const comparison = current ? compareTracerEvidence(baseline, current) : null;
  const execution = deriveHostExecution(
    view,
    BM01_OUTPUTS,
    tracerExample.sourceDigest,
    snapshot === session.getServerSnapshot().accepted,
  );
  const executionKind = executionStateKindFromHostLabel(execution.label);
  const canCapture = ready && !view.pending && current !== null;
  const canCompare =
    canCapture && !dirty && comparison?.sameRecording === true && comparison.sameProjection;
  const baselineInterval = baseline.outputs.observationInterval.value ?? 0;

  function apply(input: Bm01Parameters) {
    const outcome = session.apply(input);
    if (outcome.kind !== "accepted") {
      setError(
        outcome.kind === "refused"
          ? typeof outcome.refusal.details?.requirements === "string"
            ? outcome.refusal.details.requirements
            : outcome.refusal.message
          : outcome.outcome.message,
      );
      return;
    }
    setDraft(toTracerDraft(input));
    setDirty(false);
    setError("");
    setNote("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromTracerDraft(draft));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Check the settings.");
    }
  }
  function capture() {
    if (!canCapture || !current) return;
    const exists = records.some(
      (record) =>
        record.instanceId === current.instanceId &&
        record.runId === current.runId &&
        record.snapshotVersion === current.snapshotVersion,
    );
    if (!exists && records.length >= 12) {
      setError(
        "The notebook holds twelve results. Export it before starting another investigation.",
      );
      return;
    }
    if (!exists) setRecords([...records, current]);
    setBaseline(current);
    setPrediction("");
    setError("");
    setNote(
      "Completed result pinned. It is now the comparison baseline and the offered source for the spreading lab.",
    );
  }
  function download(format: "json" | "csv") {
    try {
      const text =
        format === "csv"
          ? tracerEvidenceCsv(records)
          : JSON.stringify(
              {
                schemaVersion: 1,
                kind: "brownian-investigation-notebook",
                interpretation:
                  "Synthetic host-calculated evidence, not experimental observations.",
                records,
              },
              null,
              2,
            );
      const href = URL.createObjectURL(
        new Blob([text], {
          type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = `brownian-investigation.${format}`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
      setNote(
        `Exported ${records.length} pinned result${records.length === 1 ? "" : "s"} as ${format.toUpperCase()}.`,
      );
    } catch {
      setError(
        "This browser could not download the notebook. The pinned results remain on this page.",
      );
    }
  }

  return (
    <>
      <section
        className="laboratory"
        aria-labelledby={`${id}-title`}
        data-instrument-id="bm-01"
        {...identity(snapshot)}
        data-pending={String(view.pending)}
        data-input-revision={view.requested?.revisions.input ?? snapshot.revisions.input}
        data-accepted-input-revision={snapshot.revisions.input}
        {...labelRootAttributes(executionKind, view, "tracerPositions")}
      >
        <header className="lab-heading">
          <div>
            <p className="eyebrow">01 · Choose an observable</p>
            <h2 id={`${id}-title`}>Keep the trial. Change when you look.</h2>
          </div>
          <ExecutionChrome
            state={executionKind}
            view={view}
            modelNote={modelNoteFromView(view, {
              notModeled: "Molecular collisions, inertia and a physical short-time velocity.",
              showTheCodeHref: "/lab/bm-01/",
            })}
          />
        </header>
        <p>
          The signed mean can nearly vanish while the sample spreads. Pin a completed result,
          predict what will change, then remeasure the same recorded paths at another interval.
        </p>
        <noscript>
          <p className="notice">
            JavaScript is off. The seeded worked example, table and explanations remain readable.
            Running or exporting an investigation requires JavaScript.
          </p>
        </noscript>
        <div className="lab-columns">
          <form onSubmit={submit} aria-label="Brownian investigation settings" noValidate>
            <fieldset disabled={!ready || view.pending} aria-describedby={`${id}-settings-note`}>
              <legend>Record and observe</legend>
              <div className="input-grid">
                {BM01_FIELDS.map(([key, label, unit]) => (
                  <div className="input-field" key={key}>
                    <label htmlFor={`${id}-${key}`}>
                      {label} ({unit})
                    </label>
                    <input
                      id={`${id}-${key}`}
                      name={key}
                      type="text"
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={(event) => {
                        setDraft({ ...draft, [key]: event.target.value });
                        setDirty(true);
                      }}
                    />
                  </div>
                ))}
                <div className="input-field">
                  <label htmlFor={`${id}-seed`}>Trial seed (unsigned 64-bit integer)</label>
                  <input
                    id={`${id}-seed`}
                    name="seed"
                    type="text"
                    inputMode="numeric"
                    value={draft.seed}
                    onChange={(event) => {
                      setDraft({ ...draft, seed: event.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <p id={`${id}-settings-note`} className="fine">
                Only the observation interval changes the measurement of an existing recording.
                Temperature, viscosity, radius, tracer count, recording grid or seed starts a new
                trial. Off-grid intervals are refused, not rounded.
              </p>
              <div className="actions">
                <button type="submit">Apply settings</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply(tracerExample.parameters)}
                >
                  Restore worked settings
                </button>
              </div>
            </fieldset>
            {dirty && (
              <p className="notice">
                Unapplied settings. Every displayed value still belongs to the accepted result.
              </p>
            )}
            <button
              type="button"
              className="secondary"
              disabled={!view.pending}
              onClick={() => session.stop()}
            >
              Stop calculation
            </button>
          </form>
          <TracerPaths snapshot={snapshot} zoom={1} />
        </div>
        {error && <p role="alert">{error}</p>}
        <p role="status" aria-live="polite" aria-atomic="true">
          {view.pending
            ? "Calculating. The previous accepted result remains displayed."
            : view.status === "refused"
              ? `${view.refusal?.message} The last accepted result is unchanged.`
              : view.status === "unavailable"
                ? `${view.outcome?.message} The worked result remains readable.`
                : view.status === "paused"
                  ? "Calculation stopped. The last accepted result is unchanged."
                  : note || `Accepted trial at ${display(parameters.interval)} seconds.`}
        </p>
        <div className="actions">
          <button type="button" disabled={!canCapture} onClick={capture}>
            Pin accepted result as baseline
          </button>
          <a href={`/lab/bm-01/${encodeBm01Settings(parameters)}`}>
            Open these accepted settings in the full tracer lab
          </a>
        </div>
      </section>

      <section className="laboratory" aria-labelledby={`${id}-compare`}>
        <p className="eyebrow">02 · Predict, then compare</p>
        <h2 id={`${id}-compare`}>Does four times as long mean four times as far?</h2>
        <fieldset disabled={!ready}>
          <legend>
            Optional prediction: at four times the pinned baseline interval, the coordinate RMS will
            be…
          </legend>
          {(
            [
              ["same", "About the same"],
              ["twice", "About twice as large"],
              ["four", "About four times as large"],
            ] as const
          ).map(([value, label]) => (
            <label className="check" key={value}>
              <input
                type="radio"
                name={`${id}-prediction`}
                value={value}
                checked={prediction === value}
                onChange={() => setPrediction(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p>
          Every prediction has access to the same evidence and explanation. The comparison below
          uses accepted numbers; it does not replace a finite sample with a perfect square-root
          curve.
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={!canCompare || baselineInterval <= 0 || baselineInterval * 4 > parameters.H}
            onClick={() => apply({ ...parameters, interval: baselineInterval * 4 })}
          >
            Observe at four times the baseline interval
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!canCompare}
            onClick={() => apply({ ...parameters, interval: baselineInterval })}
          >
            Return to the baseline interval
          </button>
        </div>
        <p className="fine">
          These actions are anchored to the pinned baseline, not to the last button press. They use
          the accepted trial, not unapplied edits, and stay within the recording length. To try a
          shorter interval, enter a multiple of the recording resolution above; off-grid requests
          are refused without changing the paths.
        </p>
        <div className="table-scroll" style={{ overflowX: "auto" }}>
          <table>
            <caption>Pinned baseline versus current completed result, in display units</caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Unit</th>
                <th scope="col">Baseline</th>
                <th scope="col">Current</th>
              </tr>
            </thead>
            <tbody>
              {READOUTS.map(([quantity, label, unit, factor]) => (
                <tr key={quantity}>
                  <th scope="row">{label}</th>
                  <td>{unit}</td>
                  <td>{readout(baseline, quantity, factor)}</td>
                  <td>{readout(current, quantity, factor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comparison && (!comparison.sameRecording || !comparison.sameProjection) ? (
          <p className="notice">
            This is a different trial or coordinate projection. The old baseline is retained, but
            paired ratios are withheld. Pin the current result to start a new same-trial comparison.
          </p>
        ) : comparison ? (
          <dl className="readouts">
            <div>
              <dt>Observation interval</dt>
              <dd>{ratio(comparison.intervalRatio)}</dd>
            </div>
            <div>
              <dt>Sample coordinate RMS</dt>
              <dd>{ratio(comparison.sampleRmsRatio)}</dd>
            </div>
            <div>
              <dt>Model coordinate RMS</dt>
              <dd>{ratio(comparison.modelRmsRatio)}</dd>
            </div>
            <div>
              <dt>Model apparent speed</dt>
              <dd>{ratio(comparison.modelApparentSpeedRatio)}</dd>
            </div>
          </dl>
        ) : (
          <p>Waiting for a completed result before comparing.</p>
        )}
        <details>
          <summary>Why displacement, rather than an intrinsic Brownian speed?</summary>
          <p>
            For independent, zero-mean steps the mean squares add. In the diffusion model, four
            times the time gives twice the coordinate RMS displacement. Dividing that displacement
            by the interval therefore gives a smaller apparent speed. Looking more often changes
            that quotient; it does not reveal an interval-independent velocity.
          </p>
          <p>
            The sample fluctuates around the model. This coarse-grained model does not resolve
            inertia or molecular collisions at arbitrarily short times. Its path segments are not a
            microscope film.
          </p>
          <a href="/papers/brownian-motion/#arg-bm-observable">
            Return to the observable argument →
          </a>
        </details>
      </section>

      <section className="reading" aria-labelledby={`${id}-handoff`}>
        <p className="eyebrow">03 · Carry a quantity into a different question</p>
        <h2 id={`${id}-handoff`}>Use the same coefficient to ask about probability.</h2>
        <p>
          The spreading lab below offers the model diffusion coefficient from pinned snapshot{" "}
          {baseline.snapshotVersion} of trial <code>{baseline.runId}</code>. Choose its “Copy D
          from” button to apply that coefficient once. This is not a fitted value from the sample,
          and later tracer changes do not silently update the spreading lab.
        </p>
      </section>
      <BrownianLab
        example={spreadExample}
        title="From this trial to an interval probability"
        externalDiffusivitySource={diffusivitySource(baseline)}
      />

      <section className="laboratory" aria-labelledby={`${id}-notebook`}>
        <h2 id={`${id}-notebook`}>Your investigation notebook</h2>
        <p>
          {records.length} of 12 results pinned. The notebook stays on this page only; export it
          before leaving. Exports include accepted settings, the exact seed, canonical units, typed
          statuses, source digest and snapshot identity. They are synthetic results, not
          experimental measurements.
        </p>
        <div className="actions">
          <button type="button" disabled={!ready} onClick={() => download("json")}>
            Export notebook JSON
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!ready}
            onClick={() => download("csv")}
          >
            Export notebook CSV
          </button>
        </div>
        <ol>
          {records.map((record, index) => (
            <li key={`${record.instanceId}:${record.runId}:${record.snapshotVersion}`}>
              Result {index + 1}: {readout(record, "observationInterval", 1)} s; sample RMS{" "}
              {readout(record, "sampleRms", 1e6)} μm; seed{" "}
              <code>{String(record.parameters.seed)}</code>.
              <button
                type="button"
                className="secondary"
                disabled={!ready}
                onClick={() => {
                  setBaseline(record);
                  setPrediction("");
                  setNote(`Result ${index + 1} selected as baseline.`);
                }}
              >
                Use result {index + 1} as baseline
              </button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
