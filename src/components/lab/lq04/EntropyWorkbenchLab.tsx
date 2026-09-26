"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import {
  LQ04_CAPTION,
  LQ04_DEFAULTS,
  LQ04_NOT_MODELED,
  LQ04_OUTPUTS,
  LQ04_QUESTION,
  type Lq04Parameters,
} from "../../../experiments/lq04/definition.ts";
import {
  buildLq04Snapshot,
  createLq04Session,
  type PreparedLq04Example,
} from "../../../experiments/lq04/session.ts";
import { LQ04_TAPE } from "../../../experiments/lq04/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
/**
 * LQ-04: the radiation entropy workbench (am-lq-04-entropy-workbench-senj).
 *
 * Reads the accepted snapshot only. It never calls `evaluateLq04` itself and never imports
 * `src/physics/reference/radiation.ts`: every number below comes from
 * `src/experiments/lq04/session.ts`'s `buildLq04Snapshot`, so this component and any other
 * consumer of the same snapshot can never disagree.
 */
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { withScripts } from "../subscripts.tsx";

type Draft = Readonly<{
  frequency: string;
  bandwidth: string;
  referenceVolume: string;
  referenceTemperature: string;
  volumeRatio: string;
  diluteThresholdX: string;
  showUnfixedConstantPanel: boolean;
  illustrativeC: string;
}>;

function toDraft(p: Lq04Parameters): Draft {
  return {
    frequency: String(p.frequency),
    bandwidth: String(p.bandwidth),
    referenceVolume: String(p.referenceVolume),
    referenceTemperature: String(p.referenceTemperature),
    volumeRatio: String(p.volumeRatio),
    diluteThresholdX: String(p.diluteThresholdX),
    showUnfixedConstantPanel: p.showUnfixedConstantPanel,
    illustrativeC: String(p.illustrativeC),
  };
}

function fromDraft(d: Draft): unknown {
  return {
    frequency: Number(d.frequency),
    bandwidth: Number(d.bandwidth),
    referenceVolume: Number(d.referenceVolume),
    referenceTemperature: Number(d.referenceTemperature),
    volumeRatio: Number(d.volumeRatio),
    diluteThresholdX: Number(d.diluteThresholdX),
    showUnfixedConstantPanel: d.showUnfixedConstantPanel,
    illustrativeC: Number(d.illustrativeC),
  };
}

function findOutput(snapshot: AcceptedSnapshot, id: string): PublishedResult | undefined {
  return snapshot.outputs.find((o) => o.quantityId === id);
}

function valueText(snapshot: AcceptedSnapshot, id: string, unit: string, digits = 6): ReactNode {
  const output = findOutput(snapshot, id);
  if (!output) return "(not available in this state)";
  if (output.status === "value" && typeof output.value === "number") {
    return (
      <>
        <Sci value={output.value} digits={digits} />
        {unit ? ` ${unit}` : ""}
      </>
    );
  }
  if (output.status === "outside-domain") return output.reason;
  if (output.status === "not-applicable") return output.reason;
  return statusMessage(output.status);
}

export type EntropyWorkbenchLabProps = Readonly<{
  example?: PreparedLq04Example | undefined;
  title?: string | undefined;
}>;

export function EntropyWorkbenchLab({
  example,
  title = "The radiation entropy workbench",
}: EntropyWorkbenchLabProps) {
  const id = useId();
  const [session] = useState(() =>
    createLq04Session(`lq04-${id}`, example?.parameters ?? LQ04_DEFAULTS),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    LQ04_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft(toDraft(restored)),
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq04Snapshot(`lq04-${id}`, "lq04-init", LQ04_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq04Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ04_OUTPUTS,
      example?.sourceDigest ?? "",
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  const [draft, setDraft] = useState(() => toDraft(p));
  const [error, setError] = useState("");

  useEffect(() => {
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: unknown) {
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
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(fromDraft(draft));
  }

  function applyRatio(ratio: number) {
    const next = { ...toDraft(p), volumeRatio: String(ratio) };
    setDraft(next);
    apply(fromDraft(next));
  }

  const entropyOutput = findOutput(snapshot, "radiationEntropy");
  const refused = entropyOutput?.status === "outside-domain";
  const energyText = valueText(snapshot, "radiationEnergy", "J");

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-04"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "radiationEntropy")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Radiation entropy workbench</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${LQ04_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <p className="lab-question">{LQ04_QUESTION}</p>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          at ν = <Sci value={LQ04_DEFAULTS.frequency} digits={2} /> Hz and T<sub>0</sub> ={" "}
          {LQ04_DEFAULTS.referenceTemperature} K with the printed formulas below. Changing settings
          requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form noValidate onSubmit={submit} aria-label="Constrained-state comparison controls">
          <fieldset>
            <legend>Volume ratio V / V₀</legend>
            <fieldset>
              <legend>Quick ratio presets</legend>
              <button type="button" onClick={() => applyRatio(0.5)}>
                Half
              </button>
              <button type="button" onClick={() => applyRatio(1)}>
                Same
              </button>
              <button type="button" onClick={() => applyRatio(2)}>
                Double
              </button>
            </fieldset>
            <label htmlFor={`${id}-ratio`}>Enter any ratio</label>
            <input
              id={`${id}-ratio`}
              type="number"
              step="any"
              value={draft.volumeRatio}
              onChange={(e) => setDraft({ ...draft, volumeRatio: e.target.value })}
            />
          </fieldset>

          <ExperimentSettings contents="frequency, band width, reference volume and temperature, the dilute threshold">
            <label htmlFor={`${id}-frequency`}>Frequency (Hz)</label>
            <input
              id={`${id}-frequency`}
              type="number"
              step="any"
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
            />
            <label htmlFor={`${id}-bandwidth`}>Band width (Hz)</label>
            <input
              id={`${id}-bandwidth`}
              type="number"
              step="any"
              value={draft.bandwidth}
              onChange={(e) => setDraft({ ...draft, bandwidth: e.target.value })}
            />
            <label htmlFor={`${id}-v0`}>Reference volume V₀ (m³)</label>
            <input
              id={`${id}-v0`}
              type="number"
              step="any"
              value={draft.referenceVolume}
              onChange={(e) => setDraft({ ...draft, referenceVolume: e.target.value })}
            />
            <label htmlFor={`${id}-t0`}>Reference temperature T₀ (K)</label>
            <input
              id={`${id}-t0`}
              type="number"
              step="any"
              value={draft.referenceTemperature}
              onChange={(e) => setDraft({ ...draft, referenceTemperature: e.target.value })}
            />
            <label htmlFor={`${id}-xmin`}>
              Dilute threshold x<sub>min</sub>
            </label>
            <input
              id={`${id}-xmin`}
              type="number"
              step="any"
              value={draft.diluteThresholdX}
              onChange={(e) => setDraft({ ...draft, diluteThresholdX: e.target.value })}
            />
          </ExperimentSettings>

          <fieldset>
            <legend>C(ν) teaching panel</legend>
            <label>
              <input
                type="checkbox"
                checked={draft.showUnfixedConstantPanel}
                onChange={(e) => setDraft({ ...draft, showUnfixedConstantPanel: e.target.checked })}
              />
              Show what an unfixed integration constant would add
            </label>
            {draft.showUnfixedConstantPanel ? (
              <>
                <label htmlFor={`${id}-illustrative-c`}>Illustrative C(ν) (J m⁻³ Hz⁻¹ K⁻¹)</label>
                <input
                  id={`${id}-illustrative-c`}
                  type="number"
                  step="any"
                  value={draft.illustrativeC}
                  onChange={(e) => setDraft({ ...draft, illustrativeC: e.target.value })}
                />
              </>
            ) : null}
          </fieldset>

          <button type="submit">Apply</button>
          {error ? (
            <p role="alert" className="error">
              {withScripts(error)} {KEPT_RESULT}
            </p>
          ) : null}
        </form>

        <div className="lab-results">
          <p className="fine">
            Fixed energy E = {energyText} at ν = <Sci value={p.frequency} digits={2} /> Hz in a{" "}
            <Sci value={p.bandwidth} digits={2} /> Hz band.
          </p>

          {refused && entropyOutput?.status === "outside-domain" ? (
            <p role="status" className="notice">
              {entropyOutput.reason}
            </p>
          ) : (
            <p role="status">
              ΔS = {valueText(snapshot, "radiationEntropy", "J/K")} (closed form);{" "}
              {valueText(snapshot, "radiationEntropyNumeric", "J/K")} (numerical S(V) − S(V₀));
              coefficient E/(βν) = {valueText(snapshot, "entropyVolumeCoefficient", "J/K")}; E/(hν)
              = {valueText(snapshot, "effectiveIndependentCount", "", 6)} (never a count of
              particles).
            </p>
          )}

          {/* On a 320px phone this three-column table was 348px wide and pushed the whole page
              sideways; it now scrolls inside its own labelled region instead. */}
          <section
            className="table-scroll"
            aria-label="Constrained-state comparison table"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
            tabIndex={0}
          >
            <table>
              <caption>Constrained-state comparison at fixed E, ν and dν</caption>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">Reference (V₀)</th>
                  <th scope="col">Compared (V)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Temperature T</th>
                  <td>{valueText(snapshot, "initialTemperature", "K")}</td>
                  <td>{valueText(snapshot, "finalTemperature", "K")}</td>
                </tr>
                <tr>
                  <th scope="row">x = βν / T</th>
                  <td>{valueText(snapshot, "initialX", "")}</td>
                  <td>{valueText(snapshot, "finalX", "")}</td>
                </tr>
                <tr>
                  <th scope="row">
                    Pointwise deviation e<sup>−x</sup>
                  </th>
                  <td>{valueText(snapshot, "initialPointwiseDeviation", "")}</td>
                  <td>{valueText(snapshot, "finalPointwiseDeviation", "")}</td>
                </tr>
                <tr>
                  <th scope="row">
                    Spectral entropy density s<sub>ν</sub>
                  </th>
                  <td>{valueText(snapshot, "initialSpectralEntropyDensity", "J/(m³ Hz K)")}</td>
                  <td>{valueText(snapshot, "finalSpectralEntropyDensity", "J/(m³ Hz K)")}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {p.showUnfixedConstantPanel ? (
            <p className="notice">
              What an unfixed constant would add: extra term ={" "}
              {valueText(snapshot, "unfixedConstantExtraTerm", "J/K")}; total ΔS with C ={" "}
              {valueText(snapshot, "unfixedConstantDeltaS", "J/K")}. This is a teaching comparison,
              not a model of radiation.
            </p>
          ) : null}

          <p className="fine">Not modeled: {LQ04_NOT_MODELED.join("; ")}.</p>

          <details>
            <summary>The same action without dragging, color, or a canvas</summary>
            <p>
              Every action here is typed text entry and a text result: choose half, same, or double,
              or type any volume ratio, and read the entropy-change sentence and the state table
              above. No control depends on color, drag gestures, or a canvas.
            </p>
          </details>
        </div>
      </div>
      {/* The permalink to these settings, after the instrument it links to (dispatch 263). In
          the status row it made that line 267px tall at 1440. */}
      <LabTapeLink link={tapeLink} />
      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ04_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ04_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ04_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ04_CAPTION.r3)}
      </p>
    </section>
  );
}

export function EntropyWorkbenchComparison({
  example,
}: {
  example?: PreparedLq04Example | undefined;
}) {
  return <EntropyWorkbenchLab example={example} />;
}
