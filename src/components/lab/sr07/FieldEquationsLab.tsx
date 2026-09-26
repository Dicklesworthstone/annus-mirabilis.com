"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { readTypedNumber } from "../../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import {
  SR07_CAPTION,
  SR07_COMPONENTS,
  SR07_EQUATIONS,
  SR07_NOT_MODELED,
  SR07_OUTPUTS,
  SR07_PRESETS,
  SR07_STEPS,
  type Sr07EquationId,
  type Sr07Parameters,
  type Sr07Polarization,
  type Sr07UnitLayer,
  type Sr07Wave,
} from "../../../experiments/sr07/definition.ts";
import { decodeSr07Settings } from "../../../experiments/sr07/permalink.ts";
import { createSr07Session, type PreparedSr07Example } from "../../../experiments/sr07/session.ts";
import { SR07_TAPE } from "../../../experiments/sr07/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { withScripts } from "../subscripts.tsx";

/**
 * The SI forms write a field component as E_x or B_z, and a reader was shown the underscore. Every
 * component here is a single x, y or z after E or B, so this pattern cannot reach anything else; it
 * typesets them with a real subscript and leaves the stored strings as they are.
 */
function fieldComponents(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/([EB])_([xyz])/g)) {
    const at = match.index ?? 0;
    parts.push(text.slice(last, at), match[1]);
    parts.push(<sub key={at}>{match[2]}</sub>);
    last = at + match[0].length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Readout({
  snapshot,
  id,
  digits = 6,
}: {
  snapshot: NonNullable<
    ReturnType<ReturnType<typeof createSr07Session>["getSnapshot"]>["accepted"]
  >;
  id: string;
  digits?: number;
}) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number")
    return (
      <span data-output={id}>
        <Sci value={r.value} digits={digits} />
      </span>
    );
  const text = "reason" in r ? r.reason : "No value.";
  return (
    <span data-output={id} data-result-status={r.status}>
      {text}
    </span>
  );
}

const EQUATION_IDS = Object.keys(SR07_EQUATIONS) as Sr07EquationId[];
const WAVES: readonly Sr07Wave[] = ["plus-x", "minus-x", "plus-y", "oblique"];
const POLS: readonly Sr07Polarization[] = ["primary", "secondary"];

export function FieldEquationsLab({
  example,
  title = "The field equations keep their form",
}: {
  example: PreparedSr07Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr07Session(`sr07-${id}`, example.parameters));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(SR07_TAPE, session, session.acceptedParameters());
  const snapshot = view.accepted;
  const p = (snapshot?.parameters ?? example.parameters) as Sr07Parameters;
  const [error, setError] = useState("");
  const [predict, setPredict] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [betaDraft, setBetaDraft] = useState(String(p.boostBeta));

  useEffect(() => {
    setReady(true);
    const shared = decodeSr07Settings(window.location.search);
    if (shared.kind !== "settings") return;
    const r = session.apply(shared.parameters);
    if (r.kind !== "accepted") {
      setError(String(r.refusal.details?.requirements ?? r.refusal.message));
      return;
    }
    setError("");
  }, [session]);

  useEffect(() => {
    setBetaDraft(String(p.boostBeta));
  }, [p.boostBeta]);

  function apply(next: Sr07Parameters) {
    const r = session.apply(next);
    if (r.kind !== "accepted") {
      setError(String(r.refusal.details?.requirements ?? r.refusal.message));
      return;
    }
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Number("") is 0: a cleared field, or "abc", which a number field hands over as "", was
    // applied as a boost of 0 without a word (dispatch 170).
    const boost = readTypedNumber(betaDraft, "the boost speed β");
    if (boost.kind === "refused") return setError(boost.requirement);
    apply({ ...p, boostBeta: boost.value });
  }

  if (!snapshot) throw new Error("SR-07 requires an accepted snapshot.");

  const eq = SR07_EQUATIONS[p.equationId];
  const displayed = p.unitLayer === "printed-gaussian" ? eq.printed : eq.si;
  const unitLabel =
    p.unitLayer === "printed-gaussian"
      ? "Printed Gaussian (Annalen 1905). X, Y, Z electric; L, M, N magnetic."
      : "Modern SI. Conversion from Gaussian is labeled; it is not a silent rewrite.";
  const formOk = result(snapshot, "formInvariant");
  const invariant =
    formOk.status === "value" && typeof formOk.value === "number" && formOk.value === 1;
  // One sentence for the status line: whether the six equations keep their form, and the largest
  // residual the plane-wave check found.
  const residual = result(snapshot, "residualMax");
  const statusSummary = `boosting at ${fixed(p.boostBeta, 4)}c, the six Maxwell–Hertz equations ${invariant ? "keep their form" : "do not keep their form"} in the moving system${residual.status === "value" && typeof residual.value === "number" ? `; the largest residual at twenty seeded events is ${sentenceNumber(residual.value)}` : ""}.`;

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation of the residuals a host calculation. The algebra above them
  // is always a static worked example, and the text beside the residuals says so.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR07_OUTPUTS,
      example.sourceDigest,
      snapshot !== undefined && snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id="sr-07"
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "residualMax")}
      data-source-digest={example.sourceDigest}
      data-unit-layer={p.unitLayer}
      {...identity(snapshot)}
    >
      <header className="lab-heading">
        <p className="eyebrow">An executable model</p>
        <h2>{title}</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR07_NOT_MODELED.join("; ")}.` })}
        />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. The first Maxwell-Hertz equation in printed Gaussian form is (1/V)
          ∂X/∂t = ∂N/∂y − ∂M/∂z. After the section 3 chain rule and grouping, the same form holds in
          the moving frame for the transformed fields. N is a magnetic component. Stepping and live
          residuals require JavaScript.
        </p>
      </noscript>
      <div className="lab-columns">
        <div>
          <form noValidate onSubmit={submit}>
            <fieldset>
              <legend>Equation and step</legend>
              <div className="input-field">
                <label htmlFor={`${id}-eq`}>Maxwell-Hertz equation</label>
                <select
                  id={`${id}-eq`}
                  value={p.equationId}
                  onChange={(e) =>
                    apply({ ...p, equationId: e.target.value as Sr07EquationId, stepIndex: 0 })
                  }
                >
                  {EQUATION_IDS.map((eqId) => (
                    <option key={eqId} value={eqId}>
                      {eqId}: {SR07_EQUATIONS[eqId].printed}
                    </option>
                  ))}
                </select>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={p.stepIndex === 0}
                  onClick={() => apply({ ...p, stepIndex: p.stepIndex - 1 })}
                >
                  Previous step
                </button>
                <button
                  type="button"
                  disabled={p.stepIndex >= SR07_STEPS.length - 1}
                  onClick={() => apply({ ...p, stepIndex: p.stepIndex + 1 })}
                >
                  Next step
                </button>
              </div>
            </fieldset>
            <fieldset className="lab-choice">
              <legend>Try</legend>
              <div className="actions">
                {SR07_PRESETS.map((preset) => (
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
            </fieldset>
            <ExperimentSettings contents="printed or SI units, the validation wave, its polarization and boost">
              <fieldset>
                <legend>Unit layer</legend>
                <label>
                  <input
                    type="radio"
                    name="units"
                    checked={p.unitLayer === "printed-gaussian"}
                    onChange={() => apply({ ...p, unitLayer: "printed-gaussian" as Sr07UnitLayer })}
                  />
                  Printed Gaussian
                </label>
                <label>
                  <input
                    type="radio"
                    name="units"
                    checked={p.unitLayer === "modern-si"}
                    onChange={() => apply({ ...p, unitLayer: "modern-si" as Sr07UnitLayer })}
                  />
                  Modern SI (labeled conversion)
                </label>
              </fieldset>
              <div className="input-field">
                <label htmlFor={`${id}-wave`}>Validation wave</label>
                <select
                  id={`${id}-wave`}
                  value={p.wave}
                  onChange={(e) => apply({ ...p, wave: e.target.value as Sr07Wave })}
                >
                  {WAVES.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-pol`}>Polarization</label>
                <select
                  id={`${id}-pol`}
                  value={p.polarization}
                  onChange={(e) =>
                    apply({ ...p, polarization: e.target.value as Sr07Polarization })
                  }
                >
                  {POLS.map((pol) => (
                    <option key={pol} value={pol}>
                      {pol}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-beta`}>Validation boost v/c</label>
                <input
                  id={`${id}-beta`}
                  name="boostBeta"
                  type="number"
                  step="0.05"
                  min="-0.95"
                  max="0.95"
                  value={betaDraft}
                  onChange={(e) => setBetaDraft(e.target.value)}
                />
              </div>
              <button type="submit">Apply boost</button>
            </ExperimentSettings>
          </form>
          {error ? (
            <p className="notice error" role="alert">
              {error} {KEPT_RESULT}
            </p>
          ) : null}
          <AcceptedStatus
            worked={snapshot === undefined || snapshot === session.getServerSnapshot().accepted}
            summary={statusSummary}
          />
          <LabTapeLink link={tapeLink} />
        </div>

        <div className="lab-results">
          <p
            className="sr07-equation"
            data-equation-id={p.equationId}
            data-unit-layer={p.unitLayer}
          >
            {fieldComponents(displayed)}
          </p>
          <p className="fine">{eq.spoken}</p>
          <p className="fine" data-unit-layer={p.unitLayer} data-unit-system={p.unitLayer}>
            Unit layer: {unitLabel}
          </p>
          <p>
            Step {p.stepIndex + 1} of {SR07_STEPS.length}
          </p>
          <p className="sr07-step">{SR07_STEPS[p.stepIndex]}</p>
          {p.equationId === "ampere-x" && p.stepIndex === 2 && predict === null ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const chosen = new FormData(e.currentTarget).get("candidate");
                if (typeof chosen === "string") setPredict(chosen);
              }}
            >
              <p>Which field combination now appears where N stood?</p>
              <label>
                <input type="radio" name="candidate" value="N" /> N
              </label>
              <label>
                <input type="radio" name="candidate" value="beta-N-minus" /> β(N − (v/V) Y)
              </label>
              <label>
                <input type="radio" name="candidate" value="N-minus-vY" /> N − vY
              </label>
              <button type="submit" disabled={!ready}>
                Record this prediction
              </button>
            </form>
          ) : null}
          {predict ? (
            <p
              className="notice"
              data-prompt-id="sr-07-predict-n-combination"
              data-candidate-id={predict}
            >
              Prediction recorded as {predict}. The grouping step identifies β(N − (v/V) Y). N is
              magnetic.
            </p>
          ) : null}
          <p data-form-invariant-summary={String(invariant)}>
            {invariant
              ? "The transformed equations keep the Maxwell-Hertz form for the validation wave."
              : "The transformed equations do not keep the Maxwell-Hertz form for the validation wave."}
          </p>
        </div>
      </div>
      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate
          they pushed the instrument down the first screen at 1440; every sentence is still here. */}
      <p data-detail="0">{withScripts(SR07_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR07_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR07_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR07_CAPTION.r3)}
      </p>
      <table className="inference-summary sr07-components">
        <caption>Printed symbols in paper 3, section 6</caption>
        <thead>
          <tr>
            <th scope="col">Printed</th>
            <th scope="col">Role in this paper</th>
            <th scope="col">Modern SI (labeled conversion)</th>
          </tr>
        </thead>
        <tbody>
          {SR07_COMPONENTS.map((row) => (
            <tr key={row.printed}>
              <th scope="row">{row.printed}</th>
              <td>{row.role}</td>
              <td>{fieldComponents(row.si)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fine">
        K is the stationary system. τ is the moving-frame time, not the modern proper time.
        Einstein&apos;s β is the modern γ.
      </p>
      <table className="inference-summary">
        <caption>
          Plane-wave Maxwell residuals in the moving frame (analytic derivatives; host calculation)
        </caption>
        <tbody>
          <tr>
            <th scope="row">Form invariant?</th>
            <td data-form-invariant={String(invariant)}>{invariant ? "yes" : "no"}</td>
          </tr>
          <tr>
            <th scope="row">Max residual</th>
            <td>
              <Readout snapshot={snapshot} id="residualMax" />
            </td>
          </tr>
          <tr>
            <th scope="row">Faraday x, y, z</th>
            <td>
              <Readout snapshot={snapshot} id="residualFaradayX" />
              {"; "}
              <Readout snapshot={snapshot} id="residualFaradayY" />
              {"; "}
              <Readout snapshot={snapshot} id="residualFaradayZ" />
            </td>
          </tr>
          <tr>
            <th scope="row">Ampere-Maxwell x, y, z</th>
            <td>
              <Readout snapshot={snapshot} id="residualAmpereX" />
              {"; "}
              <Readout snapshot={snapshot} id="residualAmpereY" />
              {"; "}
              <Readout snapshot={snapshot} id="residualAmpereZ" />
            </td>
          </tr>
          <tr>
            <th scope="row">Amplitude factor γ(1 − β) for a +x wave</th>
            <td>
              <Readout snapshot={snapshot} id="amplitudeFactor" />
            </td>
          </tr>
          <tr>
            <th scope="row">Frequency factor</th>
            <td>
              <Readout snapshot={snapshot} id="frequencyFactor" />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="fine">
        Residuals are an oracle on an admitted analytic wave. They are not the section 6 argument.
        The algebra above is a static worked example.
      </p>
      <details>
        <summary>Show the validation code</summary>
        <p>
          Residuals come from <code>maxwellResidualsPlaneWave</code> and <code>transformSI</code> in
          the host evaluator <code>src/physics/reference/fields.ts</code>. The derivation steps are
          an authored static chain, not that function.
        </p>
      </details>
      <section className="action-contract">
        <h3>Same scientific action without the display equation</h3>
        <p>
          Choose an equation from the list, advance or go back a named step, and read the residual
          table. Ask whether the transformed equations still have the Maxwell-Hertz form.
        </p>
      </section>
      <p className="not-modeled">Not modeled: {SR07_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function FieldEquationsComparison({ example }: { example: PreparedSr07Example }) {
  return <FieldEquationsLab example={example} />;
}
