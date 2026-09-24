"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { fromSr06Draft, toSr06Draft } from "../../../experiments/sr06/controls.ts";
import {
  SR06_CAPTION,
  SR06_NOT_MODELED,
  SR06_OUTPUTS,
  SR06_PRESETS,
  type Sr06Mode,
  type Sr06Parameters,
} from "../../../experiments/sr06/definition.ts";
import { decodeSr06Settings, encodeSr06Settings } from "../../../experiments/sr06/permalink.ts";
import { createSr06Session, type PreparedSr06Example } from "../../../experiments/sr06/session.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { fixed, result } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { VelocityCompositionPlot } from "./VelocityCompositionPlot.tsx";

function Readout({
  snapshot,
  id,
  digits = 6,
}: {
  snapshot: NonNullable<
    ReturnType<ReturnType<typeof createSr06Session>["getSnapshot"]>["accepted"]
  >;
  id: string;
  digits?: number;
}) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number")
    return <span data-output={id}>{r.value.toFixed(digits)}</span>;
  const text = r.status === "not-applicable" ? r.reason : "reason" in r ? r.reason : "No value.";
  return (
    <span data-output={id} data-result-status={r.status}>
      {text}
    </span>
  );
}

/** The three arrangements in the reader's words. The mode values stay the model's own ids. */
const SR06_MODE_LABELS: Readonly<Record<Sr06Mode, string>> = {
  collinear: "Along one line",
  angled: "At an angle α",
  "two-boosts": "Two boosts in turn",
};

/** The prediction's three options, as [id, words]. The reveal names the reader's choice in words. */
const SR06_CANDIDATES = [
  ["galilean-sum", "1.2 times light speed"],
  ["relativistic-15-17", "About 0.88 of light speed"],
  ["unchanged-0-6c", "0.6 of light speed"],
] as const;

export function VelocityCompositionLab({
  example,
  title = "Why speeds do not simply add",
}: {
  example: PreparedSr06Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr06Session(`sr06-${id}`, example.parameters));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr06Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv). The eyebrow used to print "Ideal model,
  // host calculation" as fixed text over the case the build computed.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR06_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  const [draft, setDraft] = useState(() => toSr06Draft(p));
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [predict, setPredict] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // One sentence for the status line: the composed speed beside the Galilean sum.
  const numberAt = (quantityId: string) => {
    const item = result(snapshot, quantityId);
    return item.status === "value" && typeof item.value === "number" ? item.value : null;
  };
  const composed = numberAt("composedSpeedOverC");
  const galilean = numberAt("galileanSpeedOverC");
  const statusSummary =
    composed === null
      ? "the composed speed is not defined at these settings."
      : `composing ${fixed(p.frameBeta, 4)}c with ${fixed(p.movingSpeed, 4)}c at ${fixed(p.alphaDeg, 1)}° gives ${fixed(composed, 4)}c${galilean === null ? "" : `, where Galileo's addition gives ${fixed(galilean, 4)}c`}.`;

  useEffect(() => {
    setReady(true);
    const shared = decodeSr06Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toSr06Draft(shared.parameters));
      setNote(
        "Shared settings are loaded as a draft. The worked example stays until you apply them.",
      );
    } else if (shared.kind === "invalid") setNote(shared.message);
  }, []);

  function apply(next: Sr06Parameters) {
    const r = session.apply(next);
    if (r.kind !== "accepted") {
      setError(String(r.refusal.details?.requirements ?? r.refusal.message));
      return;
    }
    setError("");
    setDraft(toSr06Draft(next));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromSr06Draft(draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those settings were refused.");
    }
  }

  function setMode(mode: Sr06Mode) {
    apply({ ...p, mode });
  }

  // α is the question in "angled" mode, so it sits under the mode choice there. In the other
  // two modes it is still an input to the composition, so it stays reachable in the drawer.
  const alphaField = (
    <div className="input-field">
      <label htmlFor={`${id}-alpha`}>Angle α in the moving frame (degrees)</label>
      <input
        id={`${id}-alpha`}
        name="alphaDeg"
        type="number"
        step="1"
        value={draft.alphaDeg}
        onChange={(e) => setDraft({ ...draft, alphaDeg: e.target.value })}
      />
    </div>
  );

  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id="sr-06"
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "composedSpeedOverC")}
    >
      <header className="lab-heading">
        <p className="eyebrow">An executable model</p>
        <h2>{title}</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome state={executionKind} view={view} />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. The worked case 0.6c with 0.6c composes to 15/17 of light speed, about
          0.882353c. Changing settings requires JavaScript.
        </p>
      </noscript>
      <details className="lab-predict sr06-predict">
        <summary>Predict first</summary>
        {predict === null ? (
          <form
            className="predict-block"
            onSubmit={(e) => {
              e.preventDefault();
              const chosen = new FormData(e.currentTarget).get("candidate");
              if (typeof chosen === "string") setPredict(chosen);
            }}
          >
            <fieldset>
              <legend id={`${id}-predict`}>
                An object moves at 0.6c relative to a frame that moves at 0.6c. What speed does the
                platform measure?
              </legend>
              {SR06_CANDIDATES.map(([value, label]) => (
                <label key={value} className="lab-predict-candidate">
                  <input type="radio" name="candidate" value={value} /> <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <button type="submit" disabled={!ready}>
              Record this prediction
            </button>
          </form>
        ) : (
          <p
            className="lab-predict-reveal"
            data-prompt-id="sr-06-predict-collinear"
            data-candidate-id={predict}
          >
            You predicted: {SR06_CANDIDATES.find(([value]) => value === predict)?.[1] ?? predict}.
            The composition below is the model&apos;s answer, not a score.
          </p>
        )}
      </details>
      <div className="lab-columns">
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend>Compose two motions</legend>
            <div className="input-field">
              <label htmlFor={`${id}-v`}>Frame speed v/c</label>
              <input
                id={`${id}-v`}
                name="frameBeta"
                type="number"
                step="0.01"
                min="-0.95"
                max="0.95"
                value={draft.frameBeta}
                onChange={(e) => setDraft({ ...draft, frameBeta: e.target.value })}
              />
            </div>
            <div className="input-field">
              <label htmlFor={`${id}-w`}>Moving-frame speed w/c</label>
              <input
                id={`${id}-w`}
                name="movingSpeed"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={draft.movingSpeed}
                onChange={(e) => setDraft({ ...draft, movingSpeed: e.target.value })}
              />
            </div>
            <fieldset>
              <legend>How the two motions meet</legend>
              {(["collinear", "angled", "two-boosts"] as const).map((mode) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    checked={p.mode === mode}
                    onChange={() => setMode(mode)}
                  />
                  {SR06_MODE_LABELS[mode]}
                </label>
              ))}
            </fieldset>
            {p.mode === "angled" ? alphaField : null}
            {p.mode === "two-boosts" ? (
              <>
                <div className="input-field">
                  <label htmlFor={`${id}-v2`}>Second boost speed / c</label>
                  <input
                    id={`${id}-v2`}
                    type="number"
                    step="0.01"
                    min="-0.95"
                    max="0.95"
                    value={draft.secondBeta}
                    onChange={(e) => setDraft({ ...draft, secondBeta: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-a2`}>Second boost angle (degrees)</label>
                  <input
                    id={`${id}-a2`}
                    type="number"
                    step="1"
                    value={draft.secondAngleDeg}
                    onChange={(e) => setDraft({ ...draft, secondAngleDeg: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            <label>
              <input
                type="checkbox"
                checked={p.showRapidity}
                onChange={() => apply({ ...p, showRapidity: !p.showRapidity })}
              />
              Show rapidity (a later aid, named by Robb in 1911; not the 1905 presentation)
            </label>
            <button type="submit">Apply settings</button>
            {p.mode === "angled" ? null : (
              <ExperimentSettings contents="the angle α in the moving frame">
                {alphaField}
                <p className="fine">Changes here apply with Apply settings.</p>
              </ExperimentSettings>
            )}
          </fieldset>
          {error ? <p className="notice error">{error}</p> : null}
          {note ? <p className="fine">{note}</p> : null}
          <p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const href = encodeSr06Settings(p);
                if (typeof window !== "undefined") window.history.replaceState(null, "", href);
              }}
            >
              Copy these settings into the address
            </button>
          </p>
        </form>
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
        />
        <div>
          <VelocityCompositionPlot snapshot={snapshot} />
          <table className="inference-summary">
            <caption>Accepted composition (fractions of c)</caption>
            <tbody>
              <tr>
                <th scope="row">
                  U<sub>x</sub> / c
                </th>
                <td>
                  <Readout snapshot={snapshot} id="composedUxOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">
                  U<sub>y</sub> / c
                </th>
                <td>
                  <Readout snapshot={snapshot} id="composedUyOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">U / c</th>
                <td>
                  <Readout snapshot={snapshot} id="composedSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Printed §5 U / c</th>
                <td>
                  <Readout snapshot={snapshot} id="printedSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Galilean |v + w| / c</th>
                <td>
                  <Readout snapshot={snapshot} id="galileanSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Shortfall 1 − U/c</th>
                <td>
                  <Readout snapshot={snapshot} id="shortfall" digits={8} />
                </td>
              </tr>
              <tr>
                <th scope="row">Wigner rotation (degrees)</th>
                <td>
                  <Readout snapshot={snapshot} id="rotationDeg" digits={4} />
                </td>
              </tr>
            </tbody>
          </table>
          {p.showRapidity ? (
            <table className="inference-summary">
              <caption>Rapidity, a later geometric aid (Minkowski 1908)</caption>
              <tbody>
                <tr>
                  <th scope="row">φ(v)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapidityFrame" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">φ(w)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapidityMoving" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">φ(v) + φ(w)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapiditySum" />
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
          <table className="inference-summary">
            <caption>Fizeau limit panel (Laue 1907 interpretation; no 1851 dataset here)</caption>
            <tbody>
              <tr>
                <th scope="row">Composition increment (m/s)</th>
                <td>
                  <Readout snapshot={snapshot} id="fizeauIncrement" digits={8} />
                </td>
              </tr>
              <tr>
                <th scope="row">Fresnel first order (m/s)</th>
                <td>
                  <Readout snapshot={snapshot} id="fresnelIncrement" digits={8} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section className="action-contract">
        <h3>Same scientific action without the plot</h3>
        <p>
          Type v/c, w/c, and the angle. Read U<sub>x</sub>, U<sub>y</sub>, U, the shortfall from
          light speed, and, in two-boosts mode, the rotation angle from the table. Ask whether the
          result is still below light speed.
        </p>
      </section>
      <p className="not-modeled">Not modeled: {SR06_NOT_MODELED.join("; ")}.</p>
      <div>
        <p className="eyebrow">Presets</p>
        {SR06_PRESETS.map((preset) => (
          <button
            key={preset.presetId}
            type="button"
            className="secondary"
            onClick={() => apply({ ...p, ...preset.parameterValues })}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(SR06_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR06_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR06_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR06_CAPTION.r3)}
      </p>
    </section>
  );
}

export function VelocityCompositionComparison({ example }: { example: PreparedSr06Example }) {
  return <VelocityCompositionLab example={example} />;
}
