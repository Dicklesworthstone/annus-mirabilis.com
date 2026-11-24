"use client";

import { useEffect, useId, useState } from "react";
import {
  DIFFUSION_PROFILE_LIMITS,
  DIFFUSION_PROFILE_SHAPES,
  type DiffusionProfile,
  type DiffusionProfileRefusal,
  type DiffusionProfileResult,
  doubleDiffusionProfile,
  INITIAL_DIFFUSION_PROFILE,
  readDiffusionProfile,
} from "../../foundations/diffusionProfile.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./diffusionProfile.css";

const LEFT = 36;
const RIGHT = 296;
const TOP = 30;
const BASE = 164;
const shown = (value: number) => String(Number(value.toPrecision(5)));

/** Steps show the owner's cell averages; a smooth curve would imply unresolved spatial detail. */
function profilePath(view: DiffusionProfile, field: "initial" | "current") {
  const x = (position: number) => LEFT + (position / view.tubeLength) * (RIGHT - LEFT);
  const y = (density: number) => BASE - (density / 2) * (BASE - TOP);
  return view.cells
    .map(
      (cell, index) =>
        `${index === 0 ? "M" : "L"} ${x(cell.left)} ${y(cell[field])} H ${x(cell.right)}`,
    )
    .join(" ");
}

/** The controls, drawing and table all accept the same complete owner result. */
export function DiffusionProfileConstruction({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_DIFFUSION_PROFILE);
  const [diffusivity, setDiffusivity] = useState("1");
  const [minutes, setMinutes] = useState("4");
  const [shape, setShape] = useState("peak-dip");
  const [error, setError] = useState<DiffusionProfileRefusal | null>(null);
  useEffect(() => setReady(true), []);

  if (accepted.kind !== "accepted")
    return (
      <p>The closed-tube calculation is unavailable. The worked figures above remain readable.</p>
    );

  const view = accepted.profile;
  const shapeLabel = DIFFUSION_PROFILE_SHAPES.find((item) => item.id === view.shape)?.label;
  const pending =
    diffusivity !== String(view.diffusivity) ||
    minutes !== String(view.minutes) ||
    shape !== view.shape;
  const errorFor = (field: "diffusivity" | "minutes" | "shape") => error?.field === field;
  const summary = `${shapeLabel}. After ${view.minutes} minutes at a diffusivity of ${view.diffusivity} square millimetres per minute, the highest density is ${shown(view.maximum)} (initially ${shown(view.initialMaximum)}) and the lowest is ${shown(view.minimum)} (initially ${shown(view.initialMinimum)}), in dye units per millimetre. ${shown(view.retainedPercent)} per cent of the dye remains in the tube.`;

  function accept(result: DiffusionProfileResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setDiffusivity(String(result.profile.diffusivity));
    setMinutes(String(result.profile.minutes));
    setShape(result.profile.shape);
    setError(null);
  }

  return (
    <section className="diffusion-profile" aria-labelledby={`${id}-title`}>
      <Title id={`${id}-title`}>Try the rule in a closed tube</Title>
      <p>
        Keep all the dye in an 18 mm tube, with neither end leaking. Choose a starting shape, a
        diffusion coefficient and a time. Does a peak fall? Does a dip fill? Can a flat profile
        change at all? Each starting shape contains the same amount of dye.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readDiffusionProfile(diffusivity, minutes, shape));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Choose the starting shape and let it spread</legend>
          <div className="diffusion-profile-fields">
            <label htmlFor={`${id}-shape`}>
              Starting profile
              <select
                id={`${id}-shape`}
                name="diffusion-shape"
                value={shape}
                aria-invalid={errorFor("shape") || undefined}
                aria-describedby={`${id}-help${errorFor("shape") ? ` ${id}-error` : ""}`}
                onChange={(event) => {
                  setShape(event.currentTarget.value);
                  setError(null);
                }}
              >
                {DIFFUSION_PROFILE_SHAPES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-diffusivity`}>
              Diffusion coefficient (mm²/min)
              <input
                id={`${id}-diffusivity`}
                name="diffusion-diffusivity"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={DIFFUSION_PROFILE_LIMITS.textLength}
                value={diffusivity}
                aria-invalid={errorFor("diffusivity") || undefined}
                aria-describedby={`${id}-help${errorFor("diffusivity") ? ` ${id}-error` : ""}`}
                onInput={(event) => {
                  setDiffusivity(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
            <label htmlFor={`${id}-minutes`}>
              Elapsed time (minutes)
              <input
                id={`${id}-minutes`}
                name="diffusion-minutes"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={DIFFUSION_PROFILE_LIMITS.textLength}
                value={minutes}
                aria-invalid={errorFor("minutes") || undefined}
                aria-describedby={`${id}-help${errorFor("minutes") ? ` ${id}-error` : ""}`}
                onInput={(event) => {
                  setMinutes(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
          </div>
          <p id={`${id}-help`} className="fine">
            Diffusion coefficient: 0 to 4 mm²/min. Time: 0 to 60 minutes. Nonzero values must be at
            least 0.000001. Apply both values and the shape together. The doubling buttons use the
            currently displayed profile, keeping its other settings fixed.
          </p>
          <div className="actions">
            <button type="submit">Apply profile and time</button>
            <button
              type="button"
              className="secondary"
              disabled={
                view.diffusivity === 0 ||
                view.diffusivity > DIFFUSION_PROFILE_LIMITS.maximumDiffusivity / 2
              }
              onClick={() => accept(doubleDiffusionProfile(view, "diffusivity"))}
            >
              Double the diffusion coefficient
            </button>
            <button
              type="button"
              className="secondary"
              disabled={
                view.minutes === 0 || view.minutes > DIFFUSION_PROFILE_LIMITS.maximumMinutes / 2
              }
              onClick={() => accept(doubleDiffusionProfile(view, "minutes"))}
            >
              Double the time
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(INITIAL_DIFFUSION_PROFILE)}
            >
              Restore the peak and dip
            </button>
          </div>
        </fieldset>
      </form>
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error.message} The drawing and table still use {view.diffusivity} mm²/min and{" "}
          {view.minutes} minutes with the previous starting shape.
        </p>
      ) : pending ? (
        <p className="fine">Changes are waiting. Apply them to update the whole profile.</p>
      ) : null}

      <div className="construction-display" data-diffusion-current>
        <p className="fine">Ideal model, host calculation</p>
        <p role="status" aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        <svg
          className="bridge-figure diffusion-profile-figure"
          viewBox="0 0 320 222"
          role="img"
          aria-label={`Dye density along a closed tube, from 0 to ${view.tubeLength} millimetres. The dashed line is the starting profile; the solid line is the profile after ${view.minutes} minutes. Each horizontal step is one cell average. ${summary}`}
        >
          <text className="bridge-axis-name" x="4" y="14">
            dye units per mm
          </text>
          {[0, 1, 2].map((density) => (
            <g key={density}>
              <line
                className="bridge-grid"
                x1={LEFT}
                x2={RIGHT}
                y1={BASE - (density / 2) * (BASE - TOP)}
                y2={BASE - (density / 2) * (BASE - TOP)}
              />
              <text
                className="bridge-number"
                x={LEFT - 8}
                y={BASE - (density / 2) * (BASE - TOP) + 4}
                textAnchor="end"
              >
                {density}
              </text>
            </g>
          ))}
          <path className="bridge-step" data-diffusion-start d={profilePath(view, "initial")} />
          <path className="bridge-line" data-diffusion-evolved d={profilePath(view, "current")} />
          <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
          <text className="bridge-number" x={LEFT} y={BASE + 18} textAnchor="middle">
            0
          </text>
          <text className="bridge-number" x={(LEFT + RIGHT) / 2} y={BASE + 18} textAnchor="middle">
            9
          </text>
          <text className="bridge-number" x={RIGHT} y={BASE + 18} textAnchor="middle">
            18
          </text>
          <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y="212" textAnchor="middle">
            distance along the tube (mm)
          </text>
        </svg>
        <p className="fine">
          Dashed: at the start. Solid: after {view.minutes} minutes. The vertical scale stays fixed,
          so a smaller peak cannot be disguised by stretching the drawing.
        </p>
        <table className="diffusion-profile-table">
          <caption>Dye density and the amount retained in the closed tube</caption>
          <thead>
            <tr>
              <th scope="col">Reading</th>
              <th scope="col">At the start</th>
              <th scope="col">After {view.minutes} min</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Highest density (units/mm)</th>
              <td>{shown(view.initialMaximum)}</td>
              <td data-diffusion-output="maximum">{shown(view.maximum)}</td>
            </tr>
            <tr>
              <th scope="row">Lowest density (units/mm)</th>
              <td>{shown(view.initialMinimum)}</td>
              <td data-diffusion-output="minimum">{shown(view.minimum)}</td>
            </tr>
            <tr>
              <th scope="row">Total dye (units)</th>
              <td>{shown(view.initialTotal)}</td>
              <td data-diffusion-output="total">{shown(view.total)}</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong data-diffusion-output="retained">{shown(view.retainedPercent)}%</strong> of the
          dye remains. Spreading redistributes it; neither closed end lets any escape.
        </p>
        <details>
          <summary>Read every cell without the drawing</summary>
          <table className="diffusion-profile-table">
            <caption>Average density in each {view.cellWidth} mm cell, in dye units per mm</caption>
            <thead>
              <tr>
                <th scope="col">Cell position (mm)</th>
                <th scope="col">At the start</th>
                <th scope="col">After {view.minutes} min</th>
              </tr>
            </thead>
            <tbody>
              {view.cells.map((cell) => (
                <tr key={cell.centre} data-diffusion-cell={cell.centre}>
                  <th scope="row">
                    {cell.left}–{cell.right}
                  </th>
                  <td>{shown(cell.initial)}</td>
                  <td data-diffusion-density>{shown(cell.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
      <p>
        Try doubling the diffusion coefficient, restore the example, then double the time. The two
        resulting profiles agree: twice the rate for the original time gives the same redistribution
        as the original rate for twice as long. A uniform profile stays uniform; zero elapsed time
        or a zero coefficient leaves any starting profile unchanged.
      </p>
      <details>
        <summary>What this model represents</summary>
        <p>
          This is an illustrative concentration profile, not measured dye data or the path of a
          particle. The calculation divides the tube into {view.cells.length} cells, each{" "}
          {view.cellWidth} mm wide, and evolves the average density in each cell with no flux at the
          ends. The steps in the drawing show those averages, not physical walls between the cells.
          The grid approximates continuous space; details smaller than a cell are not resolved. The
          earlier bell-shaped example describes spreading on an unbounded line, while this closed
          tube eventually approaches a uniform density.
        </p>
      </details>
    </section>
  );
}
