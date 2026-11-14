"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { readTypedNumber } from "../../experiments/controls/typedNumber.ts";
import type { ExperimentGroupState, GroupAction } from "../../experiments/groups/groupStore.ts";
import {
  createLinkedObserverSession,
  type LinkedObserverExamples,
  type LinkedObserverInstrument,
} from "../../experiments/groups/linkedObserver.ts";
import type { ExperimentGroupDefinition } from "../../experiments/groups/schema.ts";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { convertValue } from "../../units/adapters.ts";
import { display, result } from "./presentation.ts";
import "./linkedObserver.css";

function number(snapshot: AcceptedSnapshot, quantityId: string): number | null {
  const output = result(snapshot, quantityId);
  return output.status === "value" && typeof output.value === "number" ? output.value : null;
}

function Reading({
  snapshot,
  quantityId,
  fromUnit,
  toUnit,
}: {
  snapshot: AcceptedSnapshot;
  quantityId: string;
  fromUnit?: string;
  toUnit?: string;
}) {
  const value = number(snapshot, quantityId);
  const output = result(snapshot, quantityId);
  return (
    <span data-output={quantityId} data-result-status={output.status}>
      {value !== null
        ? display(fromUnit && toUnit ? convertValue(value, fromUnit, toUnit) : value)
        : "reason" in output
          ? output.reason
          : "No numeric result is available."}
    </span>
  );
}

function displayedSnapshots(state: ExperimentGroupState) {
  if (state.enabled && state.coherent)
    return state.coherent.members.map((member) => member.snapshot);
  if (state.enabled) return state.independentSnapshots;
  return state.members.flatMap((member) => (member.accepted ? [member.accepted] : []));
}

export function LinkedObserverLab({
  definition,
  examples,
}: {
  definition: ExperimentGroupDefinition;
  examples: LinkedObserverExamples;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLinkedObserverSession(`linked-observer-${id}`, definition, examples),
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [sharedDraft, setSharedDraft] = useState(String(examples.doppler.parameters.beta));
  const [independentDrafts, setIndependentDrafts] = useState({
    "sr-09": String(examples.doppler.parameters.beta),
    "sr-10": String(examples.lightComplex.parameters.beta),
  });
  const [problem, setProblem] = useState("");
  useEffect(() => {
    session.connect();
    setReady(true);
    return () => session.disconnect();
  }, [session]);

  function report(action: GroupAction) {
    setProblem(action.kind === "refused" ? refusalSentence(action.refusal) : "");
  }
  function typedSpeed(text: string): number | null {
    const checked = readTypedNumber(text, "observer speed as a fraction of c");
    if (checked.kind === "refused") {
      setProblem(checked.requirement);
      return null;
    }
    return convertValue(checked.value, "c", definition.canonicalUnit);
  }
  function shared(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const speed = typedSpeed(sharedDraft);
    if (speed === null) return;
    report(state.enabled ? session.changeLinkedSpeed(speed) : session.link(speed));
  }
  function independently(event: FormEvent<HTMLFormElement>, instrument: LinkedObserverInstrument) {
    event.preventDefault();
    const speed = typedSpeed(independentDrafts[instrument]);
    if (speed !== null) report(session.changeIndependentSpeed(instrument, speed));
  }
  function unlink() {
    session.unlink();
    setIndependentDrafts({
      "sr-09": String(session.owners.doppler.acceptedParameters().beta),
      "sr-10": String(session.owners.lightComplex.acceptedParameters().beta),
    });
    setProblem("");
  }
  const snapshots = displayedSnapshots(state);
  const doppler = snapshots.find((snapshot) => snapshot.experimentId === "sr-09");
  const lightComplex = snapshots.find((snapshot) => snapshot.experimentId === "sr-10");
  const kept = state.enabled && (state.phase !== "accepted" || problem !== "");
  const sameObserver = state.enabled && state.phase === "accepted" && problem === "";
  const limit = convertValue(definition.domain.max, definition.canonicalUnit, "c");
  const lower = convertValue(definition.domain.min, definition.canonicalUnit, "c");
  return (
    <section
      className="linked-observer"
      aria-label="Compare light from one observer"
      data-linked-observer=""
      data-group-enabled={state.enabled}
      data-group-phase={state.phase}
    >
      <div className="linked-observer-fixed">
        <h2>Keep the same light</h2>
        <p>
          In K, the wave has frequency {display(examples.doppler.parameters.frequencyTHz)} THz and
          travels at {display(examples.doppler.parameters.propagationAngleDeg)}° to +x. The packet
          contains {display(examples.lightComplex.parameters.initialEnergyJ)} J in{" "}
          {display(examples.lightComplex.parameters.initialVolumeM3)} m³. These inputs stay fixed
          here. A positive observer speed moves along +x; a negative speed moves along −x.
        </p>
        <p className="fine">
          These are consequences of two ideal models, not measurements. Each reading below
          identifies whether it is a static example or a calculation for your settings.
        </p>
      </div>
      <form className="linked-observer-link" onSubmit={shared} noValidate hidden={!ready}>
        <fieldset>
          <legend>
            {state.enabled
              ? "One observer for both instruments"
              : "Choose one observer for both instruments"}
          </legend>
          <div className="input-field">
            <label htmlFor={`${id}-shared`}>Shared observer speed v/c</label>
            <input
              id={`${id}-shared`}
              type="number"
              step="0.05"
              min={lower}
              max={limit}
              value={sharedDraft}
              onInput={(event) => setSharedDraft(event.currentTarget.value)}
              aria-describedby={`${id}-range`}
            />
            <p id={`${id}-range`} className="fine">
              Enter a value from {display(lower)} to {display(limit)}. Both instruments admit this
              range.
            </p>
          </div>
          <div className="actions">
            <button type="submit">
              {state.enabled ? "Apply shared observer" : "Link these observers"}
            </button>
            {state.enabled ? (
              <button className="secondary" type="button" onClick={unlink}>
                Unlink observers
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
      {state.enabled ? (
        <p className="linked-observer-chip">
          <strong>{definition.label}</strong>: Doppler and aberration; finite light complex.
          <span>
            {" "}
            {state.members.filter((member) => member.status === "accepted").length} of{" "}
            {state.members.length} instruments settled.
          </span>
        </p>
      ) : null}
      <p role="status" aria-live="polite" aria-atomic="true" data-group-message="">
        {state.message}
      </p>
      {problem ? (
        <p className="notice error" role="alert">
          {problem} The accepted results remain available.
        </p>
      ) : null}
      {!state.enabled && ready ? (
        <div className="linked-observer-independent">
          {(["sr-09", "sr-10"] as const).map((instrument) => (
            <form
              key={instrument}
              onSubmit={(event) => independently(event, instrument)}
              noValidate
            >
              <fieldset>
                <legend>
                  {instrument === "sr-09" ? "Doppler observer" : "Light-complex observer"}
                </legend>
                <div className="input-field">
                  <label htmlFor={`${id}-${instrument}`}>
                    {instrument === "sr-09"
                      ? "Doppler observer speed v/c"
                      : "Light-complex observer speed v/c"}
                  </label>
                  <input
                    id={`${id}-${instrument}`}
                    type="number"
                    step="0.05"
                    min={lower}
                    max={limit}
                    value={independentDrafts[instrument]}
                    onInput={(event) =>
                      setIndependentDrafts({
                        ...independentDrafts,
                        [instrument]: event.currentTarget.value,
                      })
                    }
                  />
                </div>
                <button className="secondary" type="submit">
                  {instrument === "sr-09"
                    ? "Apply Doppler observer"
                    : "Apply light-complex observer"}
                </button>
              </fieldset>
            </form>
          ))}
        </div>
      ) : null}
      {doppler && lightComplex ? (
        <div
          className="linked-observer-results"
          data-group-generation={state.enabled ? state.coherent?.generationId : undefined}
          data-currency-state={kept ? "stale" : "current"}
        >
          <h2>
            {state.enabled && !state.coherent
              ? "Separate accepted descriptions"
              : kept
                ? "Last complete comparison"
                : state.enabled
                  ? "Both descriptions from one observer"
                  : "Two independently controlled descriptions"}
          </h2>
          {state.enabled && !state.coherent ? (
            <p className="notice">
              The shared observer has not completed. These are the separate accepted descriptions
              from before linking. They are not yet a shared comparison.
            </p>
          ) : null}
          {!state.enabled ? (
            <p className="fine">
              Matching numbers here do not link the controls. Choose Link these observers to keep
              their speeds together.
            </p>
          ) : null}
          <div className="linked-observer-readings">
            <section
              data-member="sr-09"
              data-run-id={doppler.runId}
              data-snapshot-version={doppler.snapshotVersion}
            >
              <h3>Frequency, from §7</h3>
              <p className="fine" data-execution-label="">
                {doppler === session.owners.doppler.getServerSnapshot().accepted
                  ? "Static worked example"
                  : "Ideal model, host calculation"}
              </p>
              <dl>
                <dt>Accepted observer speed v/c</dt>
                <dd data-observer-beta="">{display(doppler.parameters.beta as number)}</dd>
                <dt>Frequency in K (THz)</dt>
                <dd>
                  <Reading
                    snapshot={doppler}
                    quantityId="waveFrequencyStationary"
                    fromUnit="Hz"
                    toUnit="THz"
                  />
                </dd>
                <dt>Frequency in k (THz)</dt>
                <dd>
                  <Reading
                    snapshot={doppler}
                    quantityId="waveFrequencyMoving"
                    fromUnit="Hz"
                    toUnit="THz"
                  />
                </dd>
                <dt>Frequency factor ν′/ν</dt>
                <dd>
                  <Reading snapshot={doppler} quantityId="dopplerFactor" />
                </dd>
                <dt>Direction in k (degrees)</dt>
                <dd>
                  <Reading snapshot={doppler} quantityId="propagationAngleMoving" />
                </dd>
              </dl>
              <a href="/lab/sr-09/">Inspect the Doppler model and its code</a>
            </section>
            <section
              data-member="sr-10"
              data-run-id={lightComplex.runId}
              data-snapshot-version={lightComplex.snapshotVersion}
            >
              <h3>Energy and volume, from §8</h3>
              <p className="fine" data-execution-label="">
                {lightComplex === session.owners.lightComplex.getServerSnapshot().accepted
                  ? "Static worked example"
                  : "Ideal model, host calculation"}
              </p>
              <dl>
                <dt>Accepted observer speed v/c</dt>
                <dd data-observer-beta="">{display(lightComplex.parameters.beta as number)}</dd>
                <dt>Energy in k (J)</dt>
                <dd>
                  <Reading snapshot={lightComplex} quantityId="lightComplexEnergyMoving" />
                </dd>
                <dt>Energy factor E′/E</dt>
                <dd>
                  <Reading snapshot={lightComplex} quantityId="dopplerFactor" />
                </dd>
                <dt>Volume in k (m³)</dt>
                <dd>
                  <Reading snapshot={lightComplex} quantityId="lightComplexVolumeMoving" />
                </dd>
                <dt>Volume factor V′/V</dt>
                <dd>
                  <Reading snapshot={lightComplex} quantityId="volumeFactor" />
                </dd>
                <dt>Energy-density factor</dt>
                <dd>
                  <Reading snapshot={lightComplex} quantityId="energyDensityFactor" />
                </dd>
              </dl>
              <a href="/lab/sr-10/">Inspect the light-complex model and its code</a>
            </section>
          </div>
          {sameObserver ? (
            <p className="linked-observer-conclusion">
              The same observer gives the same factor for frequency and total energy. The packet's
              volume changes by the reciprocal factor; the energy density changes by its square.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="notice">
          A shared comparison appears when both instruments have accepted this observer. Neither
          partial result is presented as a complete comparison.
        </p>
      )}
      <noscript>
        <p className="notice">
          The worked cases are readable without JavaScript. JavaScript enables linked and
          independent observer changes.
        </p>
      </noscript>
    </section>
  );
}
