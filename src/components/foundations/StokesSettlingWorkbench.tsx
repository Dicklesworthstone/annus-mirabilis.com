"use client";

import { useEffect, useId, useState } from "react";
import { sci } from "../../foundations/configurations.ts";
import {
  INITIAL_STOKES_SETTLING,
  readStokesSettling,
  STOKES_DEFAULTS,
  STOKES_FIELDS,
  type StokesDraft,
  type StokesRefusal,
  type StokesResult,
  stokesDraft,
  stokesSettling,
} from "../../foundations/stokesSettling.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./transportWorkbenches.css";

const shown = (value: number) => sci(value, 4);

/** Every readout belongs to the same accepted balance of weight, buoyancy and Stokes drag. */
export function StokesSettlingWorkbench({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_STOKES_SETTLING);
  const [draft, setDraft] = useState<StokesDraft>(() => stokesDraft(STOKES_DEFAULTS));
  const [error, setError] = useState<StokesRefusal | null>(null);
  useEffect(() => setReady(true), []);
  if (accepted.kind !== "accepted")
    return <p>The settling comparison is unavailable. The worked table remains readable.</p>;
  const state = accepted.snapshot;
  const pending = STOKES_FIELDS.some(
    (field) => draft[field.key] !== String(state.settings[field.key]),
  );
  const summary =
    state.direction === "balanced"
      ? "The sphere and liquid have the same density. Weight and buoyancy balance, so there is no gravitational drift and no finite time to travel one millimetre."
      : `The sphere ${state.direction} at ${shown(Math.abs(state.velocityMPerSecond) * 1e6)} micrometres per second. It takes ${shown(state.oneMillimetreSeconds ?? 0)} seconds to travel one millimetre at that terminal speed.`;

  function accept(result: StokesResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setDraft(stokesDraft(result.snapshot.settings));
    setError(null);
  }

  return (
    <section className="transport-workbench" aria-labelledby={`${id}-heading`}>
      <Title id={`${id}-heading`}>Try it: change the sphere or the liquid</Title>
      <p>
        Hold the liquid density at 1000 kg/m³ and gravity at 9.81 m/s². Change the radius, viscosity
        or sphere density, then compare the downward force with the drag. These are ideal model
        calculations, not measured trajectories.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readStokesSettling(draft));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Settling settings</legend>
          <div className="transport-fields">
            {STOKES_FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
                <input
                  id={`${id}-${field.key}`}
                  name={`stokes-${field.key}`}
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
            <button type="submit">Apply settling settings</button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() =>
                accept(stokesSettling({ ...state.settings, radius: state.settings.radius * 2 }))
              }
            >
              Double radius
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() =>
                accept(
                  stokesSettling({ ...state.settings, viscosity: state.settings.viscosity * 2 }),
                )
              }
            >
              Double viscosity
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={() => accept(stokesSettling({ ...state.settings, grainDensity: 1000 }))}
            >
              Match the liquid density
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(INITIAL_STOKES_SETTLING)}
            >
              Restore the settling example
            </button>
          </div>
          <p id={`${id}-limits`} className="fine">
            Construction ranges: radius 0.1–100 μm; viscosity 0.1–20 mPa·s; sphere density 100–20
            000 kg/m³. A diameter-based Reynolds number above 0.1 is refused.
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
      <div className="construction-display" data-stokes-current>
        <p role="status" aria-atomic="true">
          {summary}
        </p>
        <dl className="transport-readouts">
          <dt>Applied radius</dt>
          <dd data-settling-value="radius" data-value={state.settings.radius}>
            {shown(state.settings.radius)} μm
          </dd>
          <dt>Applied viscosity</dt>
          <dd data-settling-value="viscosity" data-value={state.settings.viscosity}>
            {shown(state.settings.viscosity)} mPa·s
          </dd>
          <dt>Applied sphere density</dt>
          <dd data-settling-value="density" data-value={state.settings.grainDensity}>
            {shown(state.settings.grainDensity)} kg/m³
          </dd>
          <dt>Weight minus buoyancy, downward positive</dt>
          <dd data-settling-value="force" data-value={state.buoyantWeightN}>
            {shown(state.buoyantWeightN)} N
          </dd>
          <dt>Drag at 1 μm/s</dt>
          <dd data-settling-value="drag" data-value={state.dragAtOneMicronPerSecondN}>
            {shown(state.dragAtOneMicronPerSecondN)} N
          </dd>
          <dt>Terminal velocity, downward positive</dt>
          <dd data-settling-value="speed" data-value={state.velocityMPerSecond}>
            {shown(state.velocityMPerSecond * 1e6)} μm/s
          </dd>
          <dt>Reynolds number, using the diameter</dt>
          <dd data-settling-value="reynolds" data-value={state.reynolds}>
            {shown(state.reynolds)}
          </dd>
          <dt>Time to move 1 mm at terminal speed</dt>
          <dd data-settling-value="time" data-value={state.oneMillimetreSeconds ?? undefined}>
            {state.oneMillimetreSeconds === null
              ? "No gravitational drift"
              : `${shown(state.oneMillimetreSeconds)} s`}
          </dd>
        </dl>
      </div>
      <p>
        Doubling the radius makes the excess weight eight times as large and the drag at a given
        speed twice as large, so the terminal speed grows fourfold. Doubling viscosity halves the
        terminal speed. A less dense sphere rises; a density-matched sphere has no gravitational
        drift, which does not mean its Brownian motion stops.
      </p>
      <p className="fine">
        The calculation uses the same Stokes mobility owner as the Brownian laboratories, followed
        by its force-to-drift owner. It assumes an isolated rigid sphere in a Newtonian liquid, no
        slip at the sphere and no nearby walls. The Reynolds cutoff is a conservative teaching
        boundary, not a measured error bound. Startup acceleration, Brownian wandering and gas slip
        corrections are not modeled.
      </p>
      <p>
        <a href="/lab/bm-04/">Compare this directed drift with diffusion</a> in the Brownian
        laboratory.
      </p>
    </section>
  );
}
