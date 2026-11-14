"use client";

import { useId, useState } from "react";
import {
  DEFAULT_WAVE_SETTINGS,
  readWaveInputs,
  WAVE_FIELDS,
  WAVE_PLOT_WIDTH_NM,
  type WaveInputs,
  type WaveRefusal,
  waveDisplayValue,
  waveInputs,
  waveNumber,
  waveSamples,
} from "../../foundations/waveSamples.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Scientific notation keeps a small nonzero mean square visible; field roundoff is separate. */
function WaveReading({
  value,
  roundoffScale,
}: {
  readonly value: number;
  readonly roundoffScale?: number;
}) {
  const displayed = waveDisplayValue(value, roundoffScale);
  return displayed !== 0 && Math.abs(displayed) < 0.0001 ? (
    <Sci value={displayed} digits={4} />
  ) : (
    waveNumber(displayed)
  );
}

const plotX = (positionNm: number) => 40 + (300 * positionNm) / WAVE_PLOT_WIDTH_NM;
const plotY = (fieldVpm: number) => 120 - 40 * fieldVpm;

/** One frozen field profile and one fixed-place observation, from the same accepted wave. */
export function FieldWaveSamples({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [result, setResult] = useState(() => waveSamples(DEFAULT_WAVE_SETTINGS));
  const [draft, setDraft] = useState<WaveInputs>(() => waveInputs(DEFAULT_WAVE_SETTINGS));
  const [error, setError] = useState<WaveRefusal | null>(null);

  function apply(inputs: WaveInputs) {
    const parsed = readWaveInputs(inputs);
    if (parsed.kind === "refused") {
      setError(parsed);
      return;
    }
    const next = waveSamples(parsed.settings);
    if (next.kind === "refused") {
      setError(next);
      return;
    }
    setResult(next);
    setDraft(waveInputs(next.snapshot.settings));
    setError(null);
  }

  if (result.kind === "refused") {
    return (
      <section className="foundation-construction" data-foundation-construction="fields-waves">
        <Title className="construction-title">Inspect a travelling field</Title>
        <p role="alert">{result.reason}</p>
        <button type="button" onClick={() => apply(waveInputs(DEFAULT_WAVE_SETTINGS))}>
          Restore the worked example
        </button>
      </section>
    );
  }

  const state = result.snapshot;
  const acceptedInputs = waveInputs(state.settings);
  const hasDraft = WAVE_FIELDS.some((field) => draft[field.key] !== acceptedInputs[field.key]);
  const nextTime = state.settings.timeFs + state.periodFs / 4;
  const timeLimit = WAVE_FIELDS.find((field) => field.key === "timeFs")?.max ?? 20;
  const canStep = !hasDraft && nextTime <= timeLimit;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={id + "-heading"}
      data-foundation-construction="fields-waves"
    >
      <Title id={id + "-heading"} className="construction-title">
        Try it: one wave, two ways to inspect it
      </Title>
      <p>
        Freeze a light wave at one instant and inspect the field across space. Then stay at one
        position and inspect the field over a cycle. The horizontal direction in the drawing is
        position; its height is the electric field there, not a particle's path.
      </p>
      <p className="fine">
        Ideal model, host calculation. Each picture is a frozen instant. A femtosecond is 10⁻¹⁵
        seconds; the wave still travels at the speed of light. No animation runs automatically.
      </p>

      <form
        className="construction-controls"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        {WAVE_FIELDS.map((field) => (
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
              onInput={(event) => {
                const value = event.currentTarget.value;
                setDraft((previous) => ({ ...previous, [field.key]: value }));
                setError(null);
              }}
            />
          </p>
        ))}
        <div className="button-group">
          <button type="submit">Apply wave settings</button>
          <button
            type="button"
            className="secondary"
            onClick={() => apply(waveInputs(DEFAULT_WAVE_SETTINGS))}
          >
            Reset worked example
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!canStep}
            onClick={() => apply({ ...acceptedInputs, timeFs: String(nextTime) })}
          >
            Advance a quarter period
          </button>
        </div>
        <p className="fine">
          Construction ranges: wavelength 200–2000 nm; amplitude 0–2 V/m; time 0–20 fs; position
          0–2000 nm. These ranges keep the drawing readable. The position and field axes keep the
          same scale when you change the wave.
        </p>
        {error ? (
          <p id={id + "-error"} role="alert">
            {error.reason} The drawing and tables still show the previous settings.
          </p>
        ) : hasDraft ? (
          <p className="fine">
            The drawing and tables still show the applied settings. Apply your changes before
            advancing time, or reset the worked example.
          </p>
        ) : nextTime > timeLimit ? (
          <p className="fine">
            Another quarter period would pass 20 fs. Enter an earlier time or reset the example.
          </p>
        ) : null}
      </form>

      <div className="construction-display" role="status" aria-atomic="true">
        <p>
          Applied wavelength: <strong>{waveNumber(state.settings.wavelengthNm)} nm</strong>. Field
          amplitude:{" "}
          <strong>
            <WaveReading value={state.settings.amplitudeVpm} /> V/m
          </strong>
          .
        </p>
        <p>
          At position {waveNumber(state.probe.positionNm)} nm and time{" "}
          {waveNumber(state.probe.timeFs)} fs, the field is{" "}
          <strong>
            <WaveReading value={state.probe.fieldVpm} roundoffScale={state.settings.amplitudeVpm} />{" "}
            V/m
          </strong>
          .
        </p>
        <dl className="readout-grid">
          <dt>Frequency</dt>
          <dd>{waveNumber(state.frequencyTHz)} THz</dd>
          <dt>Time for one cycle</dt>
          <dd>{waveNumber(state.periodFs)} fs</dd>
          <dt>Mean field over a cycle</dt>
          <dd>
            <WaveReading
              value={state.cycleMeanFieldVpm}
              roundoffScale={state.settings.amplitudeVpm}
            />{" "}
            V/m
          </dd>
          <dt>Mean square field over a cycle</dt>
          <dd>
            <WaveReading value={state.cycleMeanSquareVpm2} /> (V/m)²
          </dd>
        </dl>
      </div>

      <Sub>One instant, many positions</Sub>
      <svg
        className="bridge-figure"
        viewBox="0 0 360 244"
        role="img"
        aria-labelledby={id + "-plot-title " + id + "-plot-description"}
      >
        <title id={id + "-plot-title"}>
          {`Electric field across space at ${waveNumber(state.settings.timeFs)} femtoseconds`}
        </title>
        <desc id={id + "-plot-description"}>
          The curve repeats every {waveNumber(state.settings.wavelengthNm)} nanometres and reaches
          positive and negative {waveNumber(state.settings.amplitudeVpm)} volts per metre. The dot
          marks position {waveNumber(state.probe.positionNm)} nanometres, where the field is{" "}
          {waveNumber(state.probe.fieldVpm, state.settings.amplitudeVpm)} volts per metre. The table
          below reads one wavelength at this same instant.
        </desc>
        <text className="bridge-axis-name" x={40} y={18}>
          Electric field (V/m)
        </text>
        {[-2, -1, 0, 1, 2].map((value) => (
          <g key={value}>
            <line className="bridge-grid" x1={40} y1={plotY(value)} x2={340} y2={plotY(value)} />
            <text className="bridge-number" x={30} y={plotY(value) + 4} textAnchor="end">
              {waveNumber(value)}
            </text>
          </g>
        ))}
        <line className="bridge-axis" x1={40} y1={40} x2={40} y2={200} />
        <line className="bridge-axis" x1={40} y1={120} x2={340} y2={120} />
        {[0, 500, 1000, 1500, 2000].map((position) => (
          <text
            key={position}
            className="bridge-number"
            x={plotX(position)}
            y={218}
            textAnchor="middle"
          >
            {position}
          </text>
        ))}
        <polyline
          className="bridge-line"
          points={state.spatialCurve
            .map((point) => plotX(point.positionNm) + "," + plotY(point.fieldVpm))
            .join(" ")}
        />
        <line
          className="bridge-step"
          x1={plotX(state.probe.positionNm)}
          y1={120}
          x2={plotX(state.probe.positionNm)}
          y2={plotY(state.probe.fieldVpm)}
        />
        <circle
          className="bridge-dot"
          cx={plotX(state.probe.positionNm)}
          cy={plotY(state.probe.fieldVpm)}
          r={4}
        />
        <text className="bridge-axis-name" x={190} y={240} textAnchor="middle">
          Position (nm)
        </text>
      </svg>

      <table className="data-table">
        <caption>One wavelength at {waveNumber(state.settings.timeFs)} fs</caption>
        <thead>
          <tr>
            <th scope="col">Position (nm)</th>
            <th scope="col">Electric field (V/m)</th>
          </tr>
        </thead>
        <tbody>
          {state.spatialRows.map((point) => (
            <tr key={point.positionNm}>
              <th scope="row">{waveNumber(point.positionNm)}</th>
              <td>
                <WaveReading value={point.fieldVpm} roundoffScale={state.settings.amplitudeVpm} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sub>One position through a cycle</Sub>
      <p>
        Stay at {waveNumber(state.settings.probeNm)} nm. These eight readings are evenly spaced
        through one complete cycle, starting at the applied time. The sign reverses, but its square
        stays nonnegative. For this single cosine wave, their averages give the full-cycle averages
        shown above.
      </p>
      <table className="data-table">
        <caption>A cycle at position {waveNumber(state.settings.probeNm)} nm</caption>
        <thead>
          <tr>
            <th scope="col">Time (fs)</th>
            <th scope="col">Field and square</th>
          </tr>
        </thead>
        <tbody>
          {state.cycleRows.map((point) => (
            <tr key={point.timeFs}>
              <th scope="row">{waveNumber(point.timeFs)}</th>
              <td>
                <WaveReading value={point.fieldVpm} roundoffScale={state.settings.amplitudeVpm} />{" "}
                V/m
                <br />
                Square:{" "}
                <WaveReading
                  value={point.squareVpm2}
                  roundoffScale={state.settings.amplitudeVpm ** 2}
                />{" "}
                (V/m)²
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          A 500 nm wavelength takes about 1.67 fs to pass a fixed place. At the initial setting, the
          field there starts at +1 V/m, passes through zero after a quarter period, reaches −1 V/m
          after half a period, and returns to +1 V/m after a full period.
        </p>
        <p>
          Doubling the wavelength doubles the period and halves the frequency, while the wave speed
          stays fixed. Doubling the field amplitude doubles the height of every crest and makes the
          mean square four times as large. The mean field over a cycle is zero in both cases; a zero
          mean field does not imply zero energy delivered.
        </p>
        <p>
          The displayed square is in (V/m)². It is proportional to the intensity of this ideal plane
          wave, but it is not itself a power per area. This construction shows one field component
          in empty space; it does not model a detector, a pulse, or the motion of charges in a
          material.
        </p>
        <p>
          <a href="/papers/special-relativity/s7/">
            Follow the wave-phase argument in the relativity paper
          </a>
          , or <a href="/lab/lq-01/">compare two waves and their interference</a>.
        </p>
      </div>
    </section>
  );
}
