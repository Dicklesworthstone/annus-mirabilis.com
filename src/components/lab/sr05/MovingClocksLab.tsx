"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import {
  SR05_CAPTION,
  SR05_OUTPUTS,
  SR05_PRESETS,
  type Sr05Parameters,
} from "../../../experiments/sr05/definition.ts";
import { createSr05Session, type PreparedSr05Example } from "../../../experiments/sr05/session.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { readablePowers } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import "./sr05.css";

export type MovingClocksLabProps = Readonly<{
  example?: PreparedSr05Example | undefined;
  /**
   * A session owned by the component that embeds the lab, so that something beside it reads the
   * same accepted snapshot (the relativity journey's check against the world). Omitted, the lab
   * owns its own, as on /lab/sr-05/.
   */
  session?: ReturnType<typeof createSr05Session> | undefined;
}>;

function numberOf(
  outputs: readonly { quantityId: string; status: string; value?: unknown }[],
  id: string,
): number | null {
  const found = outputs.find((o) => o.quantityId === id);
  return found?.status === "value" ? (found.value as number) : null;
}

/**
 * A reading at `digits` significant figures, with trailing zeros after the decimal point dropped and
 * a power of ten written as one. The old trim kept "0.800000" and "0.2000000000" whole, since it
 * only fired when the match began at the point, and a small value came out as "5.000000125e-9".
 */
function fmt(value: number | null, digits = 6): string {
  if (value === null) return "not available";
  const text = value.toPrecision(digits);
  const [mantissa = text, exponent] = text.split("e");
  const trimmed = mantissa.includes(".")
    ? mantissa.replace(/0+$/, "").replace(/\.$/, "")
    : mantissa;
  return readablePowers(exponent === undefined ? trimmed : `${trimmed}e${exponent}`);
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

export function MovingClocksLab({ example, session: sharedSession }: MovingClocksLabProps) {
  const instanceId = useId();
  const session = useMemo(
    () => sharedSession ?? createSr05Session(instanceId, example),
    [sharedSession, instanceId, example],
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const accepted = view.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR05_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
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
  // One sentence for the status line: what the platform clocks and the moving clock read.
  const route =
    params === undefined
      ? ""
      : ({
          inertial: " in a straight line",
          "out-and-back": " out and back",
          circle: " round a circle",
        }[params.worldlinePreset] ?? "");
  const statusSummary =
    params === undefined || properTime === null || coordinateTime === null
      ? "no clock reading is available for these settings."
      : `a clock moving at ${fmt(params.speed)}c${route}: the platform clocks read ${fmt(coordinateTime)} s while it reads ${fmt(properTime)} s.`;

  return (
    <section
      className="laboratory"
      aria-labelledby={`${instanceId}-title`}
      data-testid="moving-clocks-lab"
      data-instrument-id="sr-05"
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "properTime")}
    >
      <header className="lab-heading">
        <h2 id={`${instanceId}-title`}>Moving clocks</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome state={executionKind} view={view} />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>
      <div className="lab-columns">
        <div>
          <fieldset className="lab-choice">
            <legend>Choose a worldline</legend>
            <div className="actions">
              {PRESET_ORDER.map((id) => {
                const preset = SR05_PRESETS[id];
                if (!preset) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="secondary"
                    data-preset-id={id}
                    aria-pressed={params !== undefined && paramsMatch(params, preset.parameters)}
                    onClick={() => session.apply(preset.parameters)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
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
          <AcceptedStatus
            worked={accepted === undefined || accepted === session.getServerSnapshot().accepted}
            summary={statusSummary}
          />
        </div>

        <section
          className="lab-results"
          aria-label="What the clocks read"
          data-testid="sr05-run-summary"
        >
          <ClockBars
            properTime={properTime}
            coordinateTime={coordinateTime}
            titleId={`${instanceId}-bars`}
          />
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
              Comparing clocks that are apart needs a stated simultaneity convention; only the
              reunion comparison above holds in every frame.
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
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(SR05_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR05_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR05_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR05_CAPTION.r3)}
      </p>

      <p className="fine">
        Model: an ideal clock whose rate depends only on its instantaneous speed. Not modeled:
        gravitational time dilation, real clock mechanisms under acceleration, rotating-frame
        synchronization, the geoid's actual shape, atomic-clock physics, and clock noise.
      </p>
    </section>
  );
}

/**
 * What the two clocks read, drawn: the platform's coordinate time and the moving clock's own
 * time on one scale. Both lengths are the accepted outputs themselves; nothing is computed here.
 * At everyday speeds the bars are the same length to the eye, and the tables beside them carry
 * the difference, which is the honest picture of how small it is.
 */
function ClockBars({
  properTime,
  coordinateTime,
  titleId,
}: {
  properTime: number | null;
  coordinateTime: number | null;
  titleId: string;
}) {
  if (properTime === null || coordinateTime === null || coordinateTime <= 0) return null;
  const W = 360;
  const left = 8;
  const full = W - left - 8;
  const tau = Math.max(0, Math.min(1, properTime / coordinateTime)) * full;
  return (
    <figure className="sr05-bars">
      <svg viewBox={`0 0 ${W} 112`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {`The platform clocks read ${fmt(coordinateTime)} s; the moving clock reads ${fmt(properTime)} s.`}
        </title>
        <text x={left} y={16}>
          Platform clocks, t = {fmt(coordinateTime)} s
        </text>
        <rect className="sr05-bar-platform" x={left} y={24} width={full} height={18} />
        <text x={left} y={70}>
          Moving clock, τ = {fmt(properTime)} s
        </text>
        <rect className="sr05-bar-moving" x={left} y={78} width={tau} height={18} />
        <line className="sr05-bar-end" x1={left + full} y1={20} x2={left + full} y2={100} />
      </svg>
    </figure>
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
