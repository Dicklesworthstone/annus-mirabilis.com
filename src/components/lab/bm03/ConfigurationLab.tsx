"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromBm03Draft, toBm03Draft } from "../../../experiments/bm03/controls.ts";
import {
  BM03_CAPTION,
  BM03_DEFAULTS,
  BM03_MODEL,
  BM03_NOT_MODELED,
  BM03_PRESETS,
  type Bm03Model,
  type Bm03Notation,
  type Bm03Parameters,
  type Bm03Step,
} from "../../../experiments/bm03/definition.ts";
import { decodeBm03Settings, encodeBm03Settings } from "../../../experiments/bm03/permalink.ts";
import {
  buildBm03Snapshot,
  createBm03Session,
  evaluateBm03,
  type PreparedBm03Example,
} from "../../../experiments/bm03/session.ts";
import { executionLabelFor } from "../../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { fixed, identity, numberText } from "../presentation.ts";
import { ConfigurationPlot } from "./ConfigurationPlot.tsx";
import "./bm03.css";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { Sci } from "../Sci.tsx";
import { withScripts } from "../subscripts.tsx";

const PREDICT_REASONING =
  "The model gives 4. Each particle's own positions double, and the two particles are placed independently, so their joint arrangements multiply: 2 × 2 = 4. For Np particles the factor is 2 to the power Np.";

const STEPS: readonly { id: Bm03Step; label: string; number: number }[] = [
  { id: "one-particle", label: "1. One particle", number: 1 },
  { id: "two-particles", label: "2. Two particles", number: 2 },
  { id: "many-particles", label: "3. Many particles, and the logarithm", number: 3 },
  { id: "derivative", label: "4. Volume derivative", number: 4 },
];

export function ConfigurationLab({
  example,
  title = "The configuration integral laboratory",
  readings = true,
}: {
  example?: PreparedBm03Example | undefined;
  title?: string | undefined;
  /** False for the optional second laboratory, so the page carries the caption readings once. */
  readings?: boolean;
}) {
  const id = useId();
  const [session] = useState(() =>
    createBm03Session(`bm03-${id}`, example?.parameters ?? BM03_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildBm03Snapshot(`bm03-${id}`, "bm03-init", BM03_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  // Earned per snapshot, as CameraLab's is: the build's worked example until a reader's settings
  // are accepted, a host calculation after. It was a fixed "host" and read "host calculation" on
  // first paint, about a page the build had calculated.
  const serverAccepted = session.getServerSnapshot().accepted;
  const executionKind =
    view.accepted === null || snapshot === serverAccepted ? "static-example" : "host-accepted";
  const p = snapshot.parameters as Bm03Parameters;
  const [draft, setDraft] = useState(() => toBm03Draft(p));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<string | null>(null);

  const evaluation = evaluateBm03(p);

  useEffect(() => {
    setReady(true);
    const shared = decodeBm03Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toBm03Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Bm03Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(
        typeof outcome.refusal.details?.requirements === "string"
          ? outcome.refusal.details.requirements
          : outcome.refusal.message,
      );
      return;
    }
    setError("");
    setDirty(false);
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromBm03Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Bm03Parameters) {
    setDraft(toBm03Draft(parameters));
    apply(parameters);
    setError("");
  }

  function setStep(step: Bm03Step) {
    const next = { ...p, step };
    setDraft(toBm03Draft(next));
    apply(next);
  }

  function setModel(model: Bm03Model) {
    const next = { ...p, model };
    setDraft(toBm03Draft(next));
    apply(next);
  }

  function setNotation(notation: Bm03Notation) {
    const next = { ...p, notation };
    setDraft(toBm03Draft(next));
    apply(next);
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeBm03Settings(session.acceptedParameters());
    setSharedUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  const currentStepIdx = STEPS.findIndex((s) => s.id === p.step);

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-03"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...executionLabelAttributes(executionKind)}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Statistical mechanics derivation</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{executionLabelFor(executionKind).text}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its derivation steps, values, model assumptions and explanations remain available;
          changing settings requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Configuration integral settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          {/* The model's answer comes after a choice and reads the same whichever was chosen: a
              prediction is a starting point, never a score. Without JavaScript the choices do
              nothing, so the same reasoning is a disclosure a reader can open. */}
          <details className="lab-predict">
            <summary>Predict before deriving</summary>
            <fieldset>
              <legend>
                Doubling the volume available to two independent particles multiplies the number of
                position arrangements by 2, 4, or 8?
              </legend>
              {(["2", "4", "8"] as const).map((factor) => (
                <label key={factor} className="lab-predict-candidate">
                  <input
                    type="radio"
                    name={`${id}-predict`}
                    value={factor}
                    checked={predictAnswer === factor}
                    onChange={() => setPredictAnswer(factor)}
                  />
                  <span>Multiplies by {factor}</span>
                </label>
              ))}
              {predictAnswer ? (
                <p className="lab-predict-reveal" role="status">
                  You chose {predictAnswer}. {PREDICT_REASONING}
                </p>
              ) : (
                <details>
                  <summary>The model&apos;s answer</summary>
                  <p className="fine">{PREDICT_REASONING}</p>
                </details>
              )}
            </fieldset>
          </details>
          <fieldset disabled={!ready}>
            <legend>Presets and parameters</legend>
            <div className="preset-list">
              {Object.entries(BM03_PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  className="secondary"
                  onClick={() => preset(item.parameters)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div>
                <strong>Particle placement model</strong>
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}
              >
                <button
                  type="button"
                  className={p.model === "independent" ? "primary" : "secondary"}
                  aria-pressed={p.model === "independent"}
                  onClick={() => setModel("independent")}
                >
                  Independent (§2 premise)
                </button>
                <button
                  type="button"
                  className={p.model === "locked-cluster" ? "primary" : "secondary"}
                  aria-pressed={p.model === "locked-cluster"}
                  onClick={() => setModel("locked-cluster")}
                >
                  Locked cluster (counterexample)
                </button>
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <div>
                <strong>Notation</strong>
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}
              >
                <button
                  type="button"
                  className={p.notation === "printed" ? "primary" : "secondary"}
                  aria-pressed={p.notation === "printed"}
                  onClick={() => setNotation("printed")}
                >
                  Einstein 1905 printed (B, J, n, V*, 2κ)
                </button>
                <button
                  type="button"
                  className={p.notation === "modern" ? "primary" : "secondary"}
                  aria-pressed={p.notation === "modern"}
                  onClick={() => setNotation("modern")}
                >
                  Modern (N<sub>p</sub>, V, ln, k<sub>B</sub>)
                </button>
              </div>
            </div>

            <ExperimentSettings contents="particle count, volume ratio, reference volume, temperature">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-Np`}>
                    Particle count Np <span>(count)</span>
                  </label>
                  <input
                    id={`${id}-Np`}
                    name="Np"
                    type="text"
                    inputMode="numeric"
                    value={draft.Np}
                    onChange={(e) => {
                      setDraft({ ...draft, Np: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="input-field">
                  <label htmlFor={`${id}-volumeRatio`}>
                    Volume ratio V/V₀ <span>(ratio)</span>
                  </label>
                  <input
                    id={`${id}-volumeRatio`}
                    name="volumeRatio"
                    type="text"
                    inputMode="decimal"
                    value={draft.volumeRatio}
                    onChange={(e) => {
                      setDraft({ ...draft, volumeRatio: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="input-field">
                  <label htmlFor={`${id}-V0`}>
                    Reference volume V₀ <span>(μm³)</span>
                  </label>
                  <input
                    id={`${id}-V0`}
                    name="V0"
                    type="text"
                    inputMode="decimal"
                    value={draft.V0}
                    onChange={(e) => {
                      setDraft({ ...draft, V0: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>

                <div className="input-field">
                  <label htmlFor={`${id}-T`}>
                    Temperature T <span>(K)</span>
                  </label>
                  <input
                    id={`${id}-T`}
                    name="T"
                    type="text"
                    inputMode="decimal"
                    value={draft.T}
                    onChange={(e) => {
                      setDraft({ ...draft, T: e.target.value });
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <p className="fine" style={{ marginTop: "1rem" }}>
                Whole integer Np ≥ 1, positive volume ratio V/V₀, reference volume V₀ and
                temperature T.
              </p>

              <div className="actions">
                <button type="submit">Apply settings</button>
              </div>
            </ExperimentSettings>
          </fieldset>

          {dirty && (
            <p className="draft-note">
              Unapplied settings. Results still describe the accepted settings shown beside them.
            </p>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="notice error">
              {error}
            </p>
          )}
        </form>

        <div className="lab-results" {...identity(snapshot)}>
          {/* SVG Construction Visual */}
          <ConfigurationPlot
            parameters={p}
            evaluation={evaluation}
            clipId={`bm03-plot-${id.replace(/[^a-zA-Z0-9]/g, "")}`}
          />

          {/* Step navigation */}
          <div className="step-navigation" style={{ marginBottom: "1rem" }}>
            <p>
              <strong>
                Step {currentStepIdx + 1} of {STEPS.length}
              </strong>
            </p>
            <fieldset
              aria-label="Go to a step of the derivation"
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                margin: "0.5rem 0",
                padding: 0,
                border: 0,
                minInlineSize: 0,
              }}
            >
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={p.step === s.id}
                  className={p.step === s.id ? "primary" : "secondary"}
                  onClick={() => setStep(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </fieldset>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                className="secondary"
                disabled={currentStepIdx <= 0}
                onClick={() => {
                  const prev = STEPS[currentStepIdx - 1];
                  if (prev) setStep(prev.id);
                }}
              >
                ← Previous step
              </button>
              <button
                type="button"
                className="secondary"
                disabled={currentStepIdx >= STEPS.length - 1}
                onClick={() => {
                  const next = STEPS[currentStepIdx + 1];
                  if (next) setStep(next.id);
                }}
              >
                Next step →
              </button>
            </div>
          </div>

          {/* Accepted values table */}
          <div className="table-scroll" style={{ marginTop: "1.5rem" }}>
            <table {...identity(snapshot)}>
              <caption>One accepted calculation, in explicit units</caption>
              <tbody>
                <tr>
                  <th scope="row">Particle count</th>
                  <td>{p.Np.toLocaleString()}</td>
                </tr>
                <tr>
                  <th scope="row">Volume expansion ratio V/V₀</th>
                  <td>{numberText(p.volumeRatio)}</td>
                </tr>
                <tr>
                  <th scope="row">Position arrangement factor</th>
                  <td data-output="factorRatio">
                    {evaluation.exactDecimalString !== undefined ? (
                      <strong>{evaluation.exactDecimalString}</strong>
                    ) : (
                      <span>
                        10<sup>{fixed(evaluation.log10Exponent, 4)}</sup> (natural log{" "}
                        {evaluation.naturalLogExponent.toFixed(2)})
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Free-energy difference ΔF</th>
                  <td data-output="deltaF">
                    {evaluation.deltaF.result.status === "value" &&
                    typeof evaluation.deltaF.result.value === "number" ? (
                      <>
                        <Sci value={evaluation.deltaF.result.value} digits={5} /> J
                      </>
                    ) : (
                      evaluation.deltaF.result.status
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Ideal pressure p</th>
                  <td data-output="pressure">
                    {evaluation.pressure.result.status === "value" &&
                    typeof evaluation.pressure.result.value === "number" ? (
                      <>
                        <Sci value={evaluation.pressure.result.value} digits={7} /> Pa
                      </>
                    ) : "reason" in evaluation.pressure.result ? (
                      `${evaluation.pressure.result.status} (${String(evaluation.pressure.result.reason)})`
                    ) : (
                      evaluation.pressure.result.status
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Locked-cluster pressure</th>
                  <td data-output="lockedClusterPressure">
                    {evaluation.lockedClusterPressure.result.status === "value" &&
                    typeof evaluation.lockedClusterPressure.result.value === "number" ? (
                      <>
                        <Sci value={evaluation.lockedClusterPressure.result.value} digits={7} /> Pa
                      </>
                    ) : (
                      evaluation.lockedClusterPressure.result.status
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Volume-independent factor J</th>
                  <td>
                    <em>symbolic (cancels in derivative)</em>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Momentum integrals</th>
                  <td>
                    <em>symbolic (cancels in derivative)</em>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Free-energy offset F₀</th>
                  <td>
                    <em>symbolic (cancels in derivative)</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: they
          are direct children of .laboratory, which labShell.css's detail rules select with ">".
          They were printed all at once under internal labels, "R0 (Overview):" to "R3 (Historical
          notation & counterexample):", and nested one level deeper the rules could not reach them. */}
      {readings && (
        <>
          <p data-detail="0">{withScripts(BM03_CAPTION.r0)}</p>
          <p data-detail="1">{withScripts(BM03_CAPTION.r1)}</p>
          <p data-detail="2" hidden>
            {withScripts(BM03_CAPTION.r2)}
          </p>
          <p data-detail="3" hidden>
            {withScripts(BM03_CAPTION.r3)}
          </p>
        </>
      )}

      <div className="lab-bottom" style={{ marginTop: "2rem" }}>
        <section>
          <h3>What this model assumes</h3>
          {BM03_MODEL.assumptions.map((note) => (
            <p key={note}>• {note}</p>
          ))}
          <p className="fine">Not modeled: {BM03_NOT_MODELED.join("; ")}.</p>
        </section>
      </div>

      <details style={{ marginTop: "1.5rem" }}>
        <summary>Show the calculation owner and source identity</summary>
        <p>
          Configuration volume term, factor ratio and locked cluster pressure are computed by{" "}
          <code>src/physics/reference/diffusion/routeA.ts</code>.
        </p>
        <p>
          Live terms bind <code>particleCount</code>, <code>volume</code>, <code>temperature</code>,
          and <code>freeEnergy</code>.
        </p>
      </details>

      <div className="actions" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => {
            void share();
          }}
        >
          Copy accepted-settings link
        </button>
      </div>
      {sharedUrl && (
        <div className="share-field" style={{ marginTop: "0.5rem" }}>
          <label htmlFor={`${id}-shared-url`}>Accepted-settings link</label>
          <input
            id={`${id}-shared-url`}
            type="text"
            readOnly
            value={sharedUrl}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
      {linkNote && <p className="notice">{linkNote}</p>}
    </section>
  );
}

export function ConfigurationComparison({ example }: { example?: PreparedBm03Example }) {
  const [second, setSecond] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <ConfigurationLab example={example} />
      <div className="comparison-toggle" style={{ margin: "1.5rem 0" }}>
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second ? "Close the second laboratory" : "Open an independent second laboratory"}
        </button>
        <p className="fine">
          Compare two setups side by side in your reading. Each laboratory has its own settings,
          stepwise state and accepted results.
        </p>
      </div>
      {second && (
        <ConfigurationLab example={example} title="An independent comparison" readings={false} />
      )}
    </>
  );
}
