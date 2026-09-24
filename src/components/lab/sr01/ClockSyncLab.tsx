"use client";

import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import {
  SR01_CAPTION,
  SR01_DEFAULTS,
  SR01_MODEL,
  SR01_NOT_MODELED,
  SR01_OUTPUTS,
  SR01_PRESETS,
  type Sr01Parameters,
} from "../../../experiments/sr01/definition.ts";
import { decodeSr01Settings, encodeSr01Settings } from "../../../experiments/sr01/permalink.ts";
import {
  computeSr01Ledger,
  createSr01Session,
  type PreparedSr01Example,
} from "../../../experiments/sr01/session.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { withScripts } from "../subscripts.tsx";
import "../labControls.css";
import "../showTheCode.css";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { PredictGatePanels, usePredictGate } from "../PredictGate.tsx";
import { numberText, sentenceNumber } from "../presentation.ts";

function outputByQuantityId(
  outputs: readonly PublishedResult[],
  id: string,
): PublishedResult | undefined {
  return outputs.find((o) => o.quantityId === id);
}

function formatOutput(output: PublishedResult | undefined): string {
  if (!output) return "unavailable";
  if (output.status === "value")
    return typeof output.value === "number" ? numberText(output.value) : String(output.value);
  if (output.status === "not-applicable")
    return `not applicable (${output.reason ?? "by convention"})`;
  if (output.status === "outside-domain") return `outside domain`;
  return output.status;
}

// The manifest's prompt (scripts/generate-predict-prompts.mjs), one stable array for the gate. It
// replaces the lab's use of SR01_PREDICT_MOVING_PAIR, whose question it drew below the ledger.
const SR01_PREDICT_PROMPTS = PREDICT_PROMPTS["sr-01"] ?? [];

export function ClockSyncLab({
  example,
  restoreFromLocation = false,
  title = "Clock synchronization with the event ledger",
}: {
  example?: PreparedSr01Example | undefined;
  restoreFromLocation?: boolean;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createSr01Session(`sr01-${id}`, example?.parameters ?? SR01_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const fallbackParams = example?.parameters ?? SR01_DEFAULTS;
  const accepted = view.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; an example without a source digest
  // earns no label at all.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR01_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
  const p = (accepted?.parameters ?? fallbackParams) as Sr01Parameters;

  const [draft, setDraft] = useState<Record<keyof Sr01Parameters, string>>(() => ({
    stationSeparationLs: String(p.stationSeparationLs),
    emissionTimeA: String(p.emissionTimeA),
    clockOffsetB: String(p.clockOffsetB),
    rodBeta: String(p.rodBeta),
    pairBeta: String(p.pairBeta),
    pairSeparationLs: String(p.pairSeparationLs),
    frameBeta: String(p.frameBeta),
  }));
  const [error, setError] = useState("");
  const [refusalCode, setRefusalCode] = useState<string | null>(null);
  const [sharedUrl, setSharedUrl] = useState("");
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-01", SR01_PREDICT_PROMPTS);
  const [linkNote, setLinkNote] = useState("");
  const restored = useRef(false);

  // Only the standalone route opts into URL state. Embedded instruments keep their own setup.
  useEffect(() => {
    if (!restoreFromLocation || restored.current) return;
    restored.current = true;
    const decoded = decodeSr01Settings(window.location.search);
    if (decoded.kind === "none") return;
    if (decoded.kind === "invalid") {
      setError(decoded.message);
      setRefusalCode("invalid-permalink");
      return;
    }
    const result = session.apply(decoded.parameters);
    if (result.kind === "refused") {
      setError(refusalSentence(result.refusal));
      setRefusalCode(result.refusal.code);
      return;
    }
    setDraft(
      Object.fromEntries(
        Object.entries(decoded.parameters).map(([key, value]) => [key, String(value)]),
      ) as Record<keyof Sr01Parameters, string>,
    );
    setLinkNote(
      "Loaded the linked setup and recalculated the event ledger. These are ideal-model results, not observations.",
    );
  }, [restoreFromLocation, session]);

  const outputs = accepted?.outputs ?? [];
  // One sentence for the status line: the time the light-signal rule gives the remote clock, and
  // how far apart the moving pair's clocks read.
  const numberAt = (quantityId: string) => {
    const item = outputByQuantityId(outputs, quantityId);
    return item?.status === "value" && typeof item.value === "number" ? item.value : null;
  };
  const assigned = numberAt("assignedRemoteTime");
  const desync = numberAt("desynchronization");
  const statusSummary = [
    assigned === null
      ? null
      : `the light-signal rule sets the clock at B, ${sentenceNumber(p.stationSeparationLs)} ls from A, to ${sentenceNumber(assigned)} s`,
    desync === null
      ? null
      : `the pair moving at ${sentenceNumber(p.pairBeta)}c, ${sentenceNumber(p.pairSeparationLs)} ls apart, has clocks that read ${sentenceNumber(desync)} s apart, judged from the platform`,
  ]
    .filter((part) => part !== null)
    .join("; ")
    .concat(".");
  const ledger = computeSr01Ledger(p);

  function apply(next: Sr01Parameters) {
    const outcome = session.apply(next);
    if (outcome.kind === "refused") {
      const details = outcome.refusal.details;
      const code = typeof details?.code === "string" ? details.code : outcome.refusal.code;
      setError(refusalSentence(outcome.refusal));
      setRefusalCode(code);
      return;
    }
    setError("");
    setRefusalCode(null);
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed: Sr01Parameters = {
      stationSeparationLs: Number.parseFloat(draft.stationSeparationLs),
      emissionTimeA: Number.parseFloat(draft.emissionTimeA),
      clockOffsetB: Number.parseFloat(draft.clockOffsetB),
      rodBeta: Number.parseFloat(draft.rodBeta),
      pairBeta: Number.parseFloat(draft.pairBeta),
      pairSeparationLs: Number.parseFloat(draft.pairSeparationLs),
      frameBeta: Number.parseFloat(draft.frameBeta),
    };
    apply(parsed);
  }

  function loadPreset(presetId: string) {
    const found = SR01_PRESETS.find((pr) => pr.presetId === presetId);
    if (!found) return;
    const next = found.parameterValues;
    setDraft({
      stationSeparationLs: String(next.stationSeparationLs),
      emissionTimeA: String(next.emissionTimeA),
      clockOffsetB: String(next.clockOffsetB),
      rodBeta: String(next.rodBeta),
      pairBeta: String(next.pairBeta),
      pairSeparationLs: String(next.pairSeparationLs),
      frameBeta: String(next.frameBeta),
    });
    apply(next);
  }

  function share() {
    const query = encodeSr01Settings(p);
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    setSharedUrl(url);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id="sr-01"
      {...instrumentRootAttributes(view)}
      {...executionLabelAttributes(executionKind)}
      data-refusal-code={refusalCode ?? undefined}
    >
      <div className="lab-header">
        <p className="eyebrow">An executable model</p>
        <h2>{title}</h2>
      </div>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR01_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      {linkNote && (
        <p role="status" data-shared-clock-settings>
          {linkNote}
        </p>
      )}
      {/*
        A six-column ledger whose content cannot fit a phone: measured 437px against viewports of
        320, 360 and 390, so the document overflowed at every phone width. A table is at least its
        min-content width, so nothing in CSS on the table itself can contain it; it needs a
        container, and .table-scroll is the house one (globals.css, am-14at).

        The tabIndex and the name ship WITH the container, not after it. Letting a region scroll is
        the move that makes its off-screen columns unreachable by keyboard, so a container without
        a tab stop trades a visual defect for an access defect - which is what 8ece778c did on
        /notation/ and f6f8a9ea had to repair (am-bc6s). RECORDED_NON_OVERFLOWING is not the
        honest alternative here: it admits only a region measured at diff 0, and this one is 437
        against 320.
      */}
      <PredictGatePanels gate={gate} />
      <section
        {...gate.response}
        className="table-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns cannot be reached by keyboard at all (am-bc6s)
        tabIndex={0}
        aria-label="Event ledger: each event with its kind, clock, the clock's own reading, coordinate time and coordinate position"
      >
        <table className="event-ledger" data-view="table-event-ledger">
          <caption>Event ledger (frame of description: v/c = {p.frameBeta})</caption>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Kind</th>
              <th scope="col">Clock</th>
              <th scope="col">Clock's own reading (s)</th>
              <th scope="col">Coordinate time (s)</th>
              <th scope="col">Coordinate position (ls)</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((row) => (
              <tr key={row.id} data-event-id={row.id}>
                <td>{row.id}</td>
                <td>{row.kind}</td>
                <td>{row.clockId}</td>
                <td>{numberText(row.ownClockReading)}</td>
                <td>{numberText(row.t)}</td>
                <td>{numberText(row.x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <dl className="derived-outputs" {...gate.response}>
        <dt>Assigned remote time (stated procedure)</dt>
        <dd>{formatOutput(outputByQuantityId(outputs, "assignedRemoteTime"))} s</dd>
        <dt>Round-trip speed</dt>
        <dd>{formatOutput(outputByQuantityId(outputs, "roundTripSpeed"))} ls/s</dd>
        <dt>Criterion check (declared clock B)</dt>
        <dd>
          {p.clockOffsetB === 0
            ? "synchronized by definition"
            : `${formatOutput(outputByQuantityId(outputs, "criterionOffset"))} s`}
        </dd>
        <dt>Section 2 rod chase: outbound / return legs</dt>
        <dd>
          {formatOutput(outputByQuantityId(outputs, "chaseOutboundLeg"))} s /{" "}
          {formatOutput(outputByQuantityId(outputs, "chaseReturnLeg"))} s
        </dd>
        <dt>Desynchronization of the moving pair (platform frame)</dt>
        <dd>{formatOutput(outputByQuantityId(outputs, "desynchronization"))} s</dd>
        <dt>One-way light speed</dt>
        <dd>{formatOutput(outputByQuantityId(outputs, "oneWayLightSpeed"))}</dd>
        <dt>Three-station transitivity (A, B, C, mutually at rest)</dt>
        <dd>{ledger.transitivity?.status ?? "unavailable"}</dd>
      </dl>

      {/* The presets follow the ledger they fill, as the family's "Try" group does. Above it they
          were 431px of buttons between a phone's heading and its first result. */}
      <div className="presets-bar">
        <span className="presets-label">Presets:</span>
        {SR01_PRESETS.map((pr) => (
          <button
            key={pr.presetId}
            type="button"
            className="button-preset"
            onClick={() => loadPreset(pr.presetId)}
          >
            {pr.label}
          </button>
        ))}
      </div>

      <form noValidate className="lab-controls" onSubmit={submit}>
        <fieldset className="control-group">
          <legend>Stations and signal</legend>
          <div className="control-row">
            <label htmlFor={`sep-${id}`}>Station separation AB (ls):</label>
            <input
              id={`sep-${id}`}
              type="number"
              step="0.1"
              value={draft.stationSeparationLs}
              onChange={(e) => setDraft({ ...draft, stationSeparationLs: e.target.value })}
            />
          </div>
          <div className="control-row">
            <label htmlFor={`offb-${id}`}>Initial clock offset (B, s):</label>
            <input
              id={`offb-${id}`}
              type="number"
              step="0.1"
              value={draft.clockOffsetB}
              onChange={(e) => setDraft({ ...draft, clockOffsetB: e.target.value })}
            />
          </div>
        </fieldset>

        <fieldset className="control-group">
          <legend>Motion</legend>
          <div className="control-row">
            <label htmlFor={`pairv-${id}`}>Moving clock pair velocity (fraction of c):</label>
            <input
              id={`pairv-${id}`}
              type="number"
              step="0.01"
              min="-0.95"
              max="0.95"
              value={draft.pairBeta}
              onChange={(e) => setDraft({ ...draft, pairBeta: e.target.value })}
            />
          </div>
        </fieldset>

        <ExperimentSettings contents="the emission time at A, the stations' motion, the pair's proper length, the frame of description">
          <div className="control-row">
            <label htmlFor={`emit-${id}`}>Signal emission time at A (s):</label>
            <input
              id={`emit-${id}`}
              type="number"
              step="0.1"
              value={draft.emissionTimeA}
              onChange={(e) => setDraft({ ...draft, emissionTimeA: e.target.value })}
            />
          </div>
          <div className="control-row">
            <label htmlFor={`rodv-${id}`}>Station motion, section 2 (fraction of c):</label>
            <input
              id={`rodv-${id}`}
              type="number"
              step="0.01"
              min="-0.95"
              max="0.95"
              value={draft.rodBeta}
              onChange={(e) => setDraft({ ...draft, rodBeta: e.target.value })}
            />
          </div>
          <div className="control-row">
            <label htmlFor={`pairl-${id}`}>Moving pair proper separation L (ls):</label>
            <input
              id={`pairl-${id}`}
              type="number"
              step="0.1"
              value={draft.pairSeparationLs}
              onChange={(e) => setDraft({ ...draft, pairSeparationLs: e.target.value })}
            />
          </div>
          <div className="control-row">
            <label htmlFor={`frame-${id}`}>Frame of description (fraction of c):</label>
            <input
              id={`frame-${id}`}
              type="number"
              step="0.01"
              min="-0.95"
              max="0.95"
              value={draft.frameBeta}
              onChange={(e) => setDraft({ ...draft, frameBeta: e.target.value })}
            />
          </div>
          <p className="fine">Changes here apply with Apply changes.</p>
        </ExperimentSettings>

        <div className="form-actions">
          <button type="submit" className="button button-primary">
            Apply changes
          </button>
          <button type="button" className="button" onClick={share}>
            Share configuration link
          </button>
        </div>

        {error && (
          <div className="notice error" role="alert" data-refusal-code={refusalCode ?? undefined}>
            {error}
          </div>
        )}
        {sharedUrl && (
          <div className="notice">
            Link copied to clipboard: <code>{sharedUrl}</code>
          </div>
        )}
      </form>
      <AcceptedStatus
        worked={accepted === undefined || accepted === session.getServerSnapshot().accepted}
        summary={statusSummary}
        response={gate.response}
      />

      <details className="show-the-code">
        <summary>Show the reference code &amp; kernel bindings</summary>
        <div className="code-panel">
          <p>
            Reference evaluator: <code>{SR01_MODEL.source}</code>
          </p>
          {/* A code line does not wrap, so the block scrolls inside its own named region
              instead of widening the page (+378px on a phone with this section open). */}
          <section
            className="show-the-code-scroll"
            aria-label="SR-01 reference code"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
            tabIndex={0}
          >
            <pre>
              <code>{`// desynchronizationObserved
const signed = kinematicDesynchronization(properSeparationLs, beta, 1 /* c, ls/s */);
const verdict = beta === 0 ? "they-agree" : beta > 0 ? "trailing-clock-ahead" : "leading-clock-ahead";

// synchronizationRound (Einstein's midpoint rule)
const assignedRemoteTime = (emissionTimeA + receptionTimeA) / 2;
const roundTripSpeedLsPerS = (2 * separationLs) / (receptionTimeA - emissionTimeA);`}</code>
            </pre>
          </section>
        </div>
      </details>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of .laboratory-shell, which labShell.css's detail rules select. Only R0 was shown,
          under the title, whatever the reader chose. */}
      <p data-detail="0">{withScripts(SR01_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR01_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR01_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR01_CAPTION.r3)}
      </p>

      <p className="assumptions-note">
        {SR01_MODEL.assumptions[0]} Alternative:{" "}
        {SR01_MODEL.alternativeProcedures[0]?.label.toLowerCase()}.{" "}
        {SR01_MODEL.alternativeProcedures[0]?.assumption}
      </p>

      <footer className="lab-not-modeled">
        <p className="not-modeled-heading">Not modeled in this ideal reference calculation:</p>
        <p className="not-modeled-line">{SR01_NOT_MODELED.join(" · ")}</p>
      </footer>
    </section>
  );
}

export function ClockSyncComparison({
  example,
  restoreFromLocation = false,
}: {
  example: PreparedSr01Example;
  restoreFromLocation?: boolean;
}) {
  return <ClockSyncLab example={example} restoreFromLocation={restoreFromLocation} />;
}

export { decodeSr01Settings };
