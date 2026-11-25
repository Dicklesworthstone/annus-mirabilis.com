"use client";

import { useEffect, useId, useState } from "react";
import { sci } from "../../foundations/configurations.ts";
import {
  INITIAL_OSMOTIC_PARTITION,
  OSMOTIC_DEFAULTS,
  OSMOTIC_FIELDS,
  type OsmoticDraft,
  type OsmoticRefusal,
  type OsmoticResult,
  osmoticDraft,
  osmoticPartition,
  readOsmoticPartition,
} from "../../foundations/osmoticPartition.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./transportWorkbenches.css";

const shown = (value: number) => sci(value, 4);

/** A small operable face of BM-02, with the lesson's printed table kept beside it. */
export function OsmoticPartitionWorkbench({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_OSMOTIC_PARTITION);
  const [draft, setDraft] = useState<OsmoticDraft>(() => osmoticDraft(OSMOTIC_DEFAULTS));
  const [error, setError] = useState<OsmoticRefusal | null>(null);
  useEffect(() => setReady(true), []);
  if (accepted.kind !== "accepted")
    return <p>The partition comparison is unavailable. The worked table remains readable.</p>;
  const state = accepted.snapshot;
  const pending = OSMOTIC_FIELDS.some(
    (field) => draft[field.key] !== String(state.settings[field.key]),
  );
  const summary =
    state.pressurePa === null
      ? `${shown(state.volumeFraction * 100)}% of the accessible volume is occupied. ${state.pressureReason}`
      : `${shown(state.settings.count)} particles in ${shown(state.settings.volume)} cubic micrometres at ${shown(state.settings.temperature)} kelvin give an osmotic pressure of ${shown(state.pressurePa)} pascals. The particles occupy ${shown(state.volumeFraction * 100)}% of that volume.`;

  function accept(result: OsmoticResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setDraft(osmoticDraft(result.snapshot.settings));
    setError(null);
  }

  return (
    <section className="transport-workbench" aria-labelledby={`${id}-heading`}>
      <Title id={`${id}-heading`}>Try it: move the selective partition</Title>
      <p>
        The liquid passes through the partition, while the particles stay on one side. Halve their
        accessible volume at fixed count and temperature, or change only their radius. These are
        equilibrium comparisons, not a simulation of particles hitting a wall.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readOsmoticPartition(draft));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Partition settings</legend>
          <div className="transport-fields">
            {OSMOTIC_FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
                <input
                  id={`${id}-${field.key}`}
                  name={`osmotic-${field.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft[field.key]}
                  aria-invalid={error?.field === field.key || undefined}
                  aria-describedby={`${id}-limits${error?.field === field.key ? ` ${id}-error` : ""}`}
                  onInput={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => ({ ...current, [field.key]: value }));
                    setError(null);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="button-group">
            <button type="submit">Apply partition settings</button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() =>
                accept(osmoticPartition({ ...state.settings, volume: state.settings.volume / 2 }))
              }
            >
              Halve accessible volume
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() =>
                accept(osmoticPartition({ ...state.settings, count: state.settings.count * 2 }))
              }
            >
              Double particle count
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() =>
                accept(osmoticPartition({ ...state.settings, radius: state.settings.radius * 2 }))
              }
            >
              Double particle radius
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(INITIAL_OSMOTIC_PARTITION)}
            >
              Restore the partition example
            </button>
          </div>
          <p id={`${id}-limits`} className="fine">
            Construction ranges: 0–10¹² whole particles; volume 10³–10¹² μm³; temperature 273–330 K;
            radius 0.0005–100 μm. The ideal pressure is available only up to a 1% occupied volume,
            the same dilute boundary as BM-02.
          </p>
          {error ? (
            <p id={`${id}-error`} role="alert">
              {error.message} The readouts keep the last accepted settings.
            </p>
          ) : pending ? (
            <p className="fine">
              Changes are waiting. Apply them before making a comparison; the readouts still show
              the last accepted settings.
            </p>
          ) : null}
        </fieldset>
      </form>
      <div className="construction-display" data-osmotic-current>
        <p role="status" aria-atomic="true">
          {summary}
        </p>
        <dl className="transport-readouts">
          <dt>Applied particle count</dt>
          <dd data-osmotic-value="count" data-value={state.settings.count}>
            {shown(state.settings.count)}
          </dd>
          <dt>Applied accessible volume</dt>
          <dd data-osmotic-value="volume" data-value={state.settings.volume}>
            {shown(state.settings.volume)} μm³
          </dd>
          <dt>Applied temperature</dt>
          <dd data-osmotic-value="temperature" data-value={state.settings.temperature}>
            {shown(state.settings.temperature)} K
          </dd>
          <dt>Applied particle radius</dt>
          <dd data-osmotic-value="radius" data-value={state.settings.radius}>
            {shown(state.settings.radius)} μm
          </dd>
          <dt>Number density</dt>
          <dd data-osmotic-value="number-density" data-value={state.numberDensityM3}>
            {shown(state.numberDensityM3)} particles/m³
          </dd>
          <dt>Occupied volume</dt>
          <dd data-osmotic-value="fraction" data-value={state.volumeFraction}>
            {shown(state.volumeFraction * 100)}%
          </dd>
          <dt>Osmotic pressure</dt>
          <dd data-osmotic-value="pressure" data-value={state.pressurePa ?? undefined}>
            {state.pressurePa === null
              ? "Outside the dilute model"
              : `${shown(state.pressurePa)} Pa`}
          </dd>
        </dl>
        {state.pressurePa === null ? (
          <p>
            At this radius and volume the dilute boundary permits at most{" "}
            {Math.floor(state.maximumDiluteCount).toLocaleString("en-US")} particles. Reduce the
            count or increase the volume, then apply again. The pressure has not been carried over
            from an earlier example.
          </p>
        ) : null}
      </div>
      <p>
        At fixed temperature, halving the volume or doubling the count doubles the pressure.
        Increasing only the radius leaves the pressure unchanged while the suspension stays dilute,
        but particles with twice the radius fill eight times as much space and may leave that model.
        With zero particles the ideal pressure is zero.
      </p>
      <p className="fine">
        Ideal model, host calculation, using BM-02 and the modern SI thermal constant. No historical
        measurement is inferred. The partition is perfect; particle interactions, excluded-volume
        corrections, gravity and the time to reach equilibrium are not modeled. The{" "}
        <a href="/lab/bm-02/">full osmotic partition laboratory</a> also compares the classical
        expectation and Einstein’s printed constant set.
      </p>
    </section>
  );
}
