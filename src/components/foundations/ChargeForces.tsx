"use client";

import { useId, useState } from "react";
import {
  CHARGE_DIRECTIONS,
  CHARGE_FIELDS,
  CHARGE_SIGNS,
  chargeForces,
  type ChargeInputKey,
  type ChargeInputs,
  chargeInputs,
  type ChargeRefusal,
  type ChargeSnapshot,
  DEFAULT_CHARGE_SETTINGS,
  readChargeInputs,
} from "../../foundations/chargeForces.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

type Force = ChargeSnapshot["totalForceN"];

function forceDirection(force: Force): string {
  const directions: string[] = [];
  if (force.x > 0) directions.push("right (+x)");
  if (force.x < 0) directions.push("left (−x)");
  if (force.y > 0) directions.push("up (+y)");
  if (force.y < 0) directions.push("down (−y)");
  if (force.z > 0) directions.push("out of the page (+z)");
  if (force.z < 0) directions.push("into the page (−z)");
  return directions.length === 0 ? "Zero force" : directions.join(" and ");
}

/** Coordinates alone belong to the drawing; every force and its magnitude belongs to the model. */
function ForcePicture({
  id,
  title,
  force,
  magnitude,
}: {
  id: string;
  title: string;
  force: Force;
  magnitude: number;
}) {
  const originX = 180;
  const originY = 116;
  const scale = 80 / 1e-15;
  const dx = force.x * scale;
  const dy = -force.y * scale;
  const x = originX + dx;
  const y = originY + dy;
  const length = Math.hypot(dx, dy);
  const head = Math.min(6, length / 3);
  const ux = length > 0 ? dx / length : 0;
  const uy = length > 0 ? dy / length : 0;
  const arrowHead = [
    `M ${x} ${y}`,
    `L ${x - head * ux - (head * uy) / 2} ${y - head * uy + (head * ux) / 2}`,
    `L ${x - head * ux + (head * uy) / 2} ${y - head * uy - (head * ux) / 2}`,
    "Z",
  ].join(" ");

  return (
    <svg
      className="bridge-figure"
      viewBox="0 0 360 244"
      role="img"
      aria-labelledby={id + "-title " + id + "-description"}
    >
      <title id={id + "-title"}>
        {`${title}: ${forceDirection(force)}`}
      </title>
      <desc id={id + "-description"}>
        The horizontal axis is the x component and the vertical axis is the y component. Every
        force picture uses the same scale, from −1 to +1 femtonewtons on each axis. The component
        table gives the numerical values, including forces too small to see at this scale.
      </desc>
      <text className="bridge-axis-name" x={180} y={16} textAnchor="middle">
        {title}
      </text>
      {[-1, -0.5, 0.5, 1].map((value) => (
        <g key={value}>
          <line
            className="bridge-grid"
            x1={100}
            x2={260}
            y1={originY - value * 80}
            y2={originY - value * 80}
          />
          <text className="bridge-number" x={92} y={originY - value * 80 + 4} textAnchor="end">
            {value < 0 ? "−" + Math.abs(value) : value}
          </text>
        </g>
      ))}
      <line className="bridge-axis" x1={100} y1={originY} x2={260} y2={originY} />
      <line className="bridge-axis" x1={originX} y1={36} x2={originX} y2={196} />
      {[-1, 0, 1].map((value) => (
        <text
          key={value}
          className="bridge-number"
          x={originX + value * 80}
          y={212}
          textAnchor="middle"
        >
          {value < 0 ? "−1" : value}
        </text>
      ))}
      {magnitude === 0 ? (
        <>
          <circle className="bridge-dot" cx={originX} cy={originY} r={3} />
          <text className="bridge-number" x={originX + 8} y={originY - 8}>
            Zero force
          </text>
        </>
      ) : (
        <>
          <line className="bridge-arrow" x1={originX} y1={originY} x2={x} y2={y} />
          <path className="bridge-marker" d={arrowHead} />
        </>
      )}
      <text className="bridge-axis-name" x={180} y={230} textAnchor="middle">
        x component (fN); y upward (fN)
      </text>
    </svg>
  );
}

/** A charge's electric and magnetic pushes, compared at one event in one frame. */
export function ChargeForces({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [result, setResult] = useState(() => chargeForces(DEFAULT_CHARGE_SETTINGS));
  const [draft, setDraft] = useState<ChargeInputs>(() => chargeInputs(DEFAULT_CHARGE_SETTINGS));
  const [error, setError] = useState<ChargeRefusal | null>(null);

  function apply(inputs: ChargeInputs) {
    const parsed = readChargeInputs(inputs);
    if (parsed.kind === "refused") {
      setError(parsed);
      return;
    }
    const next = chargeForces(parsed.settings);
    if (next.kind === "refused") {
      setError(next);
      return;
    }
    setResult(next);
    setDraft(chargeInputs(next.snapshot.settings));
    setError(null);
  }

  function edit(key: ChargeInputKey, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError(null);
  }

  if (result.kind === "refused") {
    return (
      <section
        className="foundation-construction"
        data-foundation-construction="electromagnetism-charges"
      >
        <Title className="construction-title">Compare electric and magnetic pushes</Title>
        <p role="alert">{result.reason}</p>
        <button type="button" onClick={() => apply(chargeInputs(DEFAULT_CHARGE_SETTINGS))}>
          Restore the worked example
        </button>
      </section>
    );
  }

  const state = result.snapshot;
  const acceptedInputs = chargeInputs(state.settings);
  const hasDraft = (Object.keys(acceptedInputs) as ChargeInputKey[]).some(
    (key) => draft[key] !== acceptedInputs[key],
  );
  const direction = CHARGE_DIRECTIONS.find((choice) => choice.id === state.settings.direction);
  const charge = CHARGE_SIGNS.find((choice) => choice.id === state.settings.charge);
  const rows = [
    {
      id: "electric",
      title: "Electric",
      force: state.electricForceN,
      magnitude: state.electricMagnitudeN,
    },
    {
      id: "magnetic",
      title: "Magnetic",
      force: state.magneticForceN,
      magnitude: state.magneticMagnitudeN,
    },
    {
      id: "total",
      title: "Total",
      force: state.totalForceN,
      magnitude: state.totalMagnitudeN,
    },
  ] as const;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={id + "-heading"}
      data-foundation-construction="electromagnetism-charges"
    >
      <Title id={id + "-heading"} className="construction-title">
        Try it: two pushes on one charge
      </Title>
      <p>
        An electric field pushes a charge even at rest. A magnetic field's push depends on the
        charge's motion. Compare the two contributions, change the charge's sign, or point its
        velocity along the magnetic-field axis.
      </p>
      <p className="fine">
        Ideal model, host calculation. This is a frozen instant in one frame, using SI units and
        the modern elementary charge. The arrows show forces, not a particle's later path.
      </p>

      <form
        className="construction-controls"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        {CHARGE_FIELDS.map((field) => (
          <p key={field.key}>
            <label htmlFor={id + "-" + field.key}>{field.label}</label>{" "}
            <input
              id={id + "-" + field.key}
              name={field.key}
              type="number"
              min={field.min}
              max={field.max}
              step="any"
              required
              value={draft[field.key]}
              aria-invalid={error?.field === field.key ? true : undefined}
              aria-describedby={error?.field === field.key ? id + "-error" : undefined}
              onInput={(event) => edit(field.key, event.currentTarget.value)}
            />
          </p>
        ))}
        <p>
          <label htmlFor={id + "-direction"}>Velocity direction</label>{" "}
          <select
            id={id + "-direction"}
            name="direction"
            value={draft.direction}
            aria-invalid={error?.field === "direction" ? true : undefined}
            aria-describedby={error?.field === "direction" ? id + "-error" : undefined}
            onChange={(event) => edit("direction", event.currentTarget.value)}
          >
            {CHARGE_DIRECTIONS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor={id + "-charge"}>Charge sign</label>{" "}
          <select
            id={id + "-charge"}
            name="charge"
            value={draft.charge}
            aria-invalid={error?.field === "charge" ? true : undefined}
            aria-describedby={error?.field === "charge" ? id + "-error" : undefined}
            onChange={(event) => edit("charge", event.currentTarget.value)}
          >
            {CHARGE_SIGNS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </p>
        <div className="button-group">
          <button type="submit">Apply forces</button>
          <button
            type="button"
            className="secondary"
            onClick={() => apply(chargeInputs(DEFAULT_CHARGE_SETTINGS))}
          >
            Reset balanced example
          </button>
          <button
            type="button"
            className="secondary"
            disabled={hasDraft}
            onClick={() => apply({ ...acceptedInputs, speedKms: "0" })}
          >
            Stop the charge
          </button>
          <button
            type="button"
            className="secondary"
            disabled={hasDraft}
            onClick={() =>
              apply({
                ...acceptedInputs,
                direction: "z",
                speedKms: String(DEFAULT_CHARGE_SETTINGS.speedKms),
              })
            }
          >
            1000 km/s along the field axis
          </button>
        </div>
        <p className="fine">
          Construction ranges: electric field −2000 to 2000 V/m; magnetic field −2 to 2 mT;
          speed 0–2000 km/s. A negative field points opposite the named positive axis. These
          ranges keep all three pictures on one scale.
        </p>
        {error ? (
          <p id={id + "-error"} role="alert">
            {error.reason} The arrows and table still show the previous settings.
          </p>
        ) : hasDraft ? (
          <p className="fine">
            The arrows and table still show the applied settings. Apply your changes before
            using a shortcut, or reset the balanced example.
          </p>
        ) : null}
      </form>

      <div className="construction-display" role="status" aria-atomic="true">
        <p>
          Applied electric field: <Sci value={state.settings.electricVpm} digits={4} /> V/m along y.
          Magnetic field: <Sci value={state.settings.magneticMt} digits={4} /> mT along z.
          Speed: <Sci value={state.settings.speedKms} digits={4} /> km/s.
          Direction: {direction?.label}. Charge: {charge?.label}.
        </p>
        <p>
          {state.totalMagnitudeN === 0 ? (
            <>
              <strong>The total force is zero.</strong>{" "}
              {state.electricMagnitudeN === 0 && state.magneticMagnitudeN === 0
                ? "Both contributions are zero."
                : "The electric and magnetic forces cancel at this instant."}
            </>
          ) : (
            <>
              <strong>The total force points {forceDirection(state.totalForceN)}.</strong>{" "}
              Its magnitude is <Sci value={state.totalMagnitudeN} digits={5} /> N.
            </>
          )}
        </p>
        {state.settings.speedKms === 0 ? (
          <p>
            The charge is at rest, so the magnetic force is zero.{" "}
            {state.electricMagnitudeN === 0
              ? "The electric force is also zero at this setting."
              : "The electric force remains."}
          </p>
        ) : state.settings.direction === "z" ? (
          <p>
            The velocity lies along the magnetic-field axis. Their cross product is zero, so
            the magnetic force is zero even though the charge is moving.
          </p>
        ) : null}
      </div>

      <Sub>Each contribution, on the same scale</Sub>
      <p>
        Right is +x, up is +y, and +z points out of the page. For these field directions the
        forces lie in the x-y plane. Every picture spans −1 to +1 femtonewtons along both axes;
        one femtonewton is 10⁻¹⁵ N. Very small forces remain readable in the table.
      </p>
      {rows.map((row) => (
        <ForcePicture
          key={row.id}
          id={id + "-" + row.id}
          title={row.title + " force"}
          force={row.force}
          magnitude={row.magnitude}
        />
      ))}

      <table className="data-table">
        <caption>Separate forces and their total at the applied settings</caption>
        <thead>
          <tr>
            <th scope="col">Contribution</th>
            <th scope="col">Force components and magnitude</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-force={row.id}>
              <th scope="row">{row.title}</th>
              <td>
                x:{" "}
                <span data-force-x>
                  <Sci value={row.force.x} digits={5} />
                </span>{" "}
                N
                <br />
                y:{" "}
                <span data-force-y>
                  <Sci value={row.force.y} digits={5} />
                </span>{" "}
                N
                <br />
                z:{" "}
                <span data-force-z>
                  <Sci value={row.force.z} digits={5} />
                </span>{" "}
                N
                <br />
                Magnitude:{" "}
                <span data-force-magnitude>
                  <Sci value={row.magnitude} digits={5} />
                </span>{" "}
                N
                <br />
                <span data-force-direction>{forceDirection(row.force)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          In the balanced example a positive charge moves right at 1000 km/s through a magnetic
          field of 1 mT pointing out of the page. The magnetic force points down. An electric field
          of 1000 V/m points up and gives an equal upward force, so the total is zero.
        </p>
        <p>
          Stop the charge: the magnetic contribution vanishes, while the upward electric push
          remains. Keep the charge moving but point its velocity along the magnetic-field axis:
          the magnetic contribution again vanishes. Change +e to −e: both contributions reverse.
          A magnetic field alone therefore does not guarantee a magnetic force.
        </p>
        <p>
          These values use the SI form of the Lorentz force and the modern magnitude of the
          elementary charge, <Sci value={Math.abs(state.chargeC)} digits={9} /> C. Einstein's
          printed field equations use Gaussian units, with their own factors and notation. This
          construction holds the fields and velocity at one event; it does not
          calculate acceleration or follow a trajectory.
        </p>
        <p>
          <a href="/lab/sr-02/">Compare the magnet and conductor descriptions</a>, or{" "}
          <a href="/lab/sr-08/">follow the fields and force into another frame</a>. The paper
          develops the field transformation in <a href="/papers/special-relativity/s6/">§6</a>.
          It applies this to the moving electron in <a href="/papers/special-relativity/s10/">§10</a>.
        </p>
      </div>
    </section>
  );
}
