"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import { SR05_PRESETS, type Sr05Parameters } from "../../../experiments/sr05/definition.ts";
import { createSr05Session, type PreparedSr05Example } from "../../../experiments/sr05/session.ts";
import "./sr05.css";

export type MovingClocksLabProps = Readonly<{
  example?: PreparedSr05Example | undefined;
}>;

function numberOf(
  outputs: readonly { quantityId: string; status: string; value?: unknown }[],
  id: string,
): number | null {
  const found = outputs.find((o) => o.quantityId === id);
  return found?.status === "value" ? (found.value as number) : null;
}

function fmt(value: number | null, digits = 6): string {
  if (value === null) return "—";
  return value.toPrecision(digits).replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m));
}

const PRESET_ORDER = [
  "sr-05-inertial-0.6c",
  "sr-05-out-and-back-0.6c",
  "sr-05-circle-0.6c",
  "sr-05-low-speed-1e-4",
  "sr-05-daily-second",
  "sr-05-light-clock-0.6c",
  "sr-05-equator-note",
] as const;

/** The worldline, in the reader's words. */
const WORLDLINE_WORDS: Readonly<Record<string, string>> = {
  inertial: "a straight line at constant speed",
  "out-and-back": "out and back",
  circle: "a circle at constant speed",
};

export function MovingClocksLab({ example }: MovingClocksLabProps) {
  const instanceId = useId();
  const session = useMemo(() => createSr05Session(instanceId, example), [instanceId, example]);
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const accepted = view.accepted;
  const params = (accepted?.parameters ?? example?.parameters) as Sr05Parameters | undefined;
  const outputs = accepted?.outputs ?? [];

  const properTime = numberOf(outputs, "properTime");
  const coordinateTime = numberOf(outputs, "coordinateTime");
  const dilationLossExact = numberOf(outputs, "dilationLossExact");
  const dilationLossPrinted = numberOf(outputs, "dilationLossPrintedSecondOrder");
  const reunionExactLag = numberOf(outputs, "reunionExactLag");
  const reunionPrintedLag = numberOf(outputs, "reunionPrintedApproxLag");
  const reunionStatus = outputs.find((o) => o.quantityId === "reunionExactLag")?.status;
  const reciprocalDilationFactor = numberOf(outputs, "reciprocalDilationFactor");
  const lightProperTick = numberOf(outputs, "lightClockProperTick");
  const lightCoordinateTick = numberOf(outputs, "lightClockCoordinateTick");
  const equatorRate = numberOf(outputs, "equatorFractionalRate");
  const equatorNs = numberOf(outputs, "equatorApproxNanosecondsPerDay");
  const dailyLossSpeedBeta = numberOf(outputs, "dailyLossSpeedBeta");

  return (
    <div className="lab-surface moving-clocks-lab" data-testid="moving-clocks-lab">
      <section aria-label="Named scenarios">
        <h2>Choose a scenario</h2>
        <p className="fine">Each button sets up one named case; the readings below follow it.</p>
        <fieldset className="preset-buttons">
          <legend>Worldline presets</legend>
          {PRESET_ORDER.map((id) => {
            const preset = SR05_PRESETS[id];
            if (!preset) return null;
            return (
              <button
                key={id}
                type="button"
                data-preset-id={id}
                aria-pressed={params !== undefined && paramsMatch(params, preset.parameters)}
                onClick={() => session.apply(preset.parameters)}
              >
                {preset.label}
              </button>
            );
          })}
        </fieldset>
      </section>

      <section aria-label="Run summary" data-testid="sr05-run-summary">
        <h2>What the clocks read</h2>
        {params ? (
          <dl className="reading-grid">
            <dt>Clock speed (fraction of c)</dt>
            <dd data-field="speed">{fmt(params.speed)}</dd>
            <dt>Worldline</dt>
            <dd data-field="worldlinePreset">{WORLDLINE_WORDS[params.worldlinePreset]}</dd>
            <dt>Coordinate duration</dt>
            <dd data-field="coordinateDuration">{fmt(params.coordinateDuration)} s</dd>
          </dl>
        ) : null}

        <table>
          <caption>
            The moving clock&apos;s own time against the platform&apos;s coordinate time.
          </caption>
          <tbody>
            <tr>
              <th scope="row">Proper time (τ)</th>
              <td data-field="properTime">{fmt(properTime)} s</td>
            </tr>
            <tr>
              <th scope="row">Coordinate time (t)</th>
              <td data-field="coordinateTime">{fmt(coordinateTime)} s</td>
            </tr>
            <tr>
              <th scope="row">τ / t</th>
              <td data-field="ratio">
                {properTime !== null && coordinateTime !== null
                  ? fmt(properTime / coordinateTime)
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <table>
          <caption>
            Loss per second: the exact form beside the printed second-order approximation ½β².
            Neither stands in for the other.
          </caption>
          <tbody>
            <tr>
              <th scope="row">Exact loss per second</th>
              <td data-field="dilationLossExact">{fmt(dilationLossExact, 10)}</td>
            </tr>
            <tr>
              <th scope="row">Printed second-order form (½β²)</th>
              <td data-field="dilationLossPrinted">{fmt(dilationLossPrinted, 10)}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <caption>
            When the clocks meet again: the exact lag beside the printed approximation ½tβ², which
            is labelled as one.
          </caption>
          <tbody>
            {reunionStatus === "not-applicable" ? (
              <tr>
                <td colSpan={2}>
                  This worldline never returns to the platform clock: there is no reunion event to
                  compare.
                </td>
              </tr>
            ) : (
              <>
                <tr>
                  <th scope="row">Exact lag at reunion</th>
                  <td data-field="reunionExactLag">{fmt(reunionExactLag)} s</td>
                </tr>
                <tr>
                  <th scope="row">Printed approximation (½ t β²)</th>
                  <td data-field="reunionPrintedLag">
                    {fmt(reunionPrintedLag)} s (approximation, not exact)
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <table>
          <caption>
            Each inertial frame reports the same dilation factor for the other clock&apos;s rate.
            Comparing clocks that are apart needs a stated simultaneity convention; only the reunion
            comparison above holds in every frame.
          </caption>
          <tbody>
            <tr>
              <th scope="row">Dilation factor (γ)</th>
              <td data-field="reciprocalDilationFactor">{fmt(reciprocalDilationFactor)}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <caption>
            The light clock (supplemental illustration, offered after the measurement definitions:
            it illustrates dilation, it does not define it).
          </caption>
          <tbody>
            <tr>
              <th scope="row">Proper tick (2L₀/c)</th>
              <td data-field="lightProperTick">{fmt(lightProperTick)} s</td>
            </tr>
            <tr>
              <th scope="row">Coordinate tick</th>
              <td data-field="lightCoordinateTick">{fmt(lightCoordinateTick)} s</td>
            </tr>
          </tbody>
        </table>

        {params?.equatorMode ? (
          <div className="equator-note" data-testid="equator-note">
            <p>
              <strong>The equator remark.</strong> On the rotating geoid, gravitational and
              kinematic time-dilation effects approximately cancel (Hafele 1970). The number below
              is a special-relativity-only illustration of the equatorial rotation speed (465.1
              m/s); it is not a prediction of a real clock on Earth's surface.
            </p>
            <p data-field="equatorFractionalRate">
              Illustrative fractional rate: {fmt(equatorRate, 6)}
            </p>
            <p data-field="equatorNs">About {fmt(equatorNs, 4)} ns per day</p>
          </div>
        ) : null}

        <p className="fine" data-field="dailyLossSpeedBeta">
          A clock losing exactly one second per day moves at β ≈ {fmt(dailyLossSpeedBeta, 6)}.
        </p>
      </section>

      <p className="fine">
        Model: an ideal clock whose rate depends only on its instantaneous speed. Not modeled:
        gravitational time dilation, real clock mechanisms under acceleration, rotating-frame
        synchronization, the geoid's actual shape, atomic-clock physics, and clock noise.
      </p>
    </div>
  );
}

function paramsMatch(a: Sr05Parameters, b: Sr05Parameters): boolean {
  return (
    a.speed === b.speed &&
    a.worldlinePreset === b.worldlinePreset &&
    a.coordinateDuration === b.coordinateDuration &&
    a.lightClockArm === b.lightClockArm &&
    a.equatorMode === b.equatorMode
  );
}
