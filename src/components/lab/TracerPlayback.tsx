"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { onReducedMotionChange } from "../../a11y/reducedMotion.ts";
import type { RealRate } from "../../content/schemas/experiment.ts";
import type { Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { bindLaboratoryVisibility } from "../../experiments/lifecycle/bindLaboratoryVisibility.ts";
import {
  createRecordingClock,
  type PlaybackAction,
  type RecordingPlayback,
  recordingScale,
  recordingTimeAfter,
} from "../../experiments/playback/recordingClock.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { formatPlaybackRate } from "../../visuals/kit/scale.ts";
import { TimeLegend } from "../../visuals/kit/TimeLegend.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { array, display, identity } from "./presentation.ts";
import { TracerPaths } from "./TracerPlots.tsx";
import { TRACER_PLAYBACK_RATES, TracerRateComparison } from "./TracerRateComparison.tsx";
import "./tracerPlayback.css";

type NaturalRate = Extract<RealRate, { natural: true }>;

/** A new accepted snapshot mounts a fresh, paused view; no old animation can label new paths. */
export function TracerPlayback({
  snapshot,
  zoom,
  manifest,
}: {
  snapshot: AcceptedSnapshot;
  zoom: number;
  manifest: RealRate;
}) {
  if (!manifest.natural) return <TracerPaths snapshot={snapshot} zoom={zoom} />;
  return (
    <RecordingPlayer
      key={`${snapshot.instanceId}:${snapshot.runId}:${snapshot.snapshotVersion}`}
      snapshot={snapshot}
      zoom={zoom}
      manifest={manifest}
    />
  );
}

function RecordingPlayer({
  snapshot,
  zoom,
  manifest,
}: {
  snapshot: AcceptedSnapshot;
  zoom: number;
  manifest: NaturalRate;
}) {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const times = array(snapshot, "traceTimes");
  const duration = times.at(times.length - 1);
  const p = snapshot.parameters as Bm01Parameters;
  const [clocks] = useState(() =>
    TRACER_PLAYBACK_RATES.map((rate) => createRecordingClock(duration, rate)),
  );
  const [views, setViews] = useState(() => clocks.map((clock) => clock.getSnapshot()));
  const [comparison, setComparison] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [timeDraft, setTimeDraft] = useState(String(duration));
  const [timeError, setTimeError] = useState("");
  const [notice, setNotice] = useState("");
  const first = views[0] as RecordingPlayback;
  const playing = views.some((view) => view.playing);
  const canPlay = ready && visible && !motionPaused && duration > 0;

  const sync = useCallback(() => setViews(clocks.map((clock) => clock.getSnapshot())), [clocks]);
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const pause = useCallback(() => {
    cancelFrame();
    const now = window.performance.now();
    for (const clock of clocks)
      clock.change({ commandClass: "presentation-change", operation: "pause" }, now);
    sync();
  }, [clocks, cancelFrame, sync]);

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    setReady(true);
    const stopForVisibility = (paused: boolean) => {
      setVisible(!paused);
      if (paused) {
        if (clocks.some((clock) => clock.getSnapshot().playing))
          setNotice("Playback paused while this view is hidden. Press Play to continue.");
        pause();
      }
    };
    const unbind = bindLaboratoryVisibility(element, { setSchedulingPaused: stopForVisibility });
    const unbindMotion = onReducedMotionChange((held) => {
      setMotionPaused(held);
      if (held) pause();
    });
    return () => {
      unbind();
      unbindMotion();
      cancelFrame();
    };
  }, [clocks, pause, cancelFrame]);

  function change(command: PlaybackAction) {
    const now = window.performance.now();
    for (const clock of comparison ? clocks : clocks.slice(0, 1))
      clock.change({ ...command, commandClass: "presentation-change" }, now);
    sync();
  }

  function play() {
    if (!canPlay) return;
    const players = comparison ? clocks : clocks.slice(0, 1);
    const replayFromStart = players.every((clock) => clock.getSnapshot().position >= duration);
    const now = window.performance.now();
    for (const clock of players) {
      if (replayFromStart || clock.getSnapshot().position < duration)
        clock.change({ commandClass: "presentation-change", operation: "play" }, now);
    }
    sync();
    setNotice("Replaying the accepted traces. The trial and its statistics stay unchanged.");
    cancelFrame();
    const advance = (now: number) => {
      for (const clock of clocks) clock.tick(now);
      sync();
      if (clocks.some((clock) => clock.getSnapshot().playing))
        frame.current = window.requestAnimationFrame(advance);
      else frame.current = null;
    };
    frame.current = window.requestAnimationFrame(advance);
  }

  function seek(seconds: number, basis: "recording" | "elapsed" = "recording") {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) {
      setTimeError(
        `Enter a playback time from 0 to ${display(duration)} seconds. No playback change was applied. ${KEPT_RESULT}`,
      );
      setNotice("");
      return;
    }
    setTimeError("");
    cancelFrame();
    const now = window.performance.now();
    const players = comparison ? clocks : clocks.slice(0, 1);
    const paused = players.map((clock) => {
      const rate = clock.getSnapshot().playbackMultiplier;
      const position = basis === "elapsed" ? recordingTimeAfter(seconds, rate, duration) : seconds;
      return clock.change(
        { commandClass: "presentation-change", operation: "seek", seconds: position },
        now,
      );
    });
    sync();
    setTimeDraft(String(seconds));
    if (basis === "elapsed") {
      const readings = paused.map(
        (view) => `${display(view.position)} s at ${view.playbackMultiplier}×`,
      );
      setNotice(
        `After ${display(seconds)} s of playback from the start, the recording times are ${readings.join(" and ")}. Both views are paused.`,
      );
    } else {
      setNotice(`Paused at ${display(seconds)} seconds in the same accepted recording.`);
    }
  }

  function draftSeconds() {
    return timeDraft.trim() === "" ? Number.NaN : Number(timeDraft);
  }

  function seekTyped(event: FormEvent) {
    event.preventDefault();
    seek(draftSeconds());
  }

  function compare(enabled: boolean) {
    setTimeError("");
    pause();
    const now = window.performance.now();
    for (const [index, clock] of clocks.entries()) {
      clock.change(
        {
          commandClass: "presentation-change",
          operation: "rate",
          multiplier: TRACER_PLAYBACK_RATES[index === 0 ? 0 : 1],
        },
        now,
      );
      clock.change({ commandClass: "presentation-change", operation: "seek", seconds: 0 }, now);
    }
    setComparison(enabled);
    setTimeDraft("0");
    sync();
    setNotice(
      enabled
        ? "Both views use the same recording. Play them together or enter elapsed seconds to compare their timing while paused."
        : "Playback is paused at the start of the same accepted recording.",
    );
  }

  const nextSample = Array.from({ length: times.length }, (_, i) => times.at(i)).find(
    (t) => t > first.position,
  );
  const shown = comparison ? views : views.slice(0, 1);
  return (
    <div ref={region} className="tracer-playback" data-tracer-playback="" {...identity(snapshot)}>
      <div className="tracer-playback-views">
        {shown.map((view, index) => {
          const scale = recordingScale(
            {
              spatialMagnification: { appliesTo: "scene", factor: zoom },
              simulatedElapsedTime: { quantityId: "elapsedTime", value: duration, unit: "s" },
              playbackMultiplier: 1,
              glyphSize: { drawnPx: 3, represents: "none" },
              quantityNormalization: { kind: "none" },
            },
            view,
          );
          return (
            <div key={index === 0 ? "main" : "comparison"} data-playback-view={index}>
              <TimeLegend scale={scale} />
              <TracerPaths
                snapshot={snapshot}
                zoom={zoom}
                replay={view}
                scaleBar={manifest.scaleBar}
              />
            </div>
          );
        })}
      </div>
      <form
        onSubmit={seekTyped}
        noValidate
        hidden={!ready}
        className="tracer-playback-controls"
        aria-label="Replay accepted tracer paths"
      >
        <fieldset>
          <legend>Replay the same traces</legend>
          <p className="fine">
            Playback changes the display time only. The numbers below still describe the accepted
            observation at {display(p.interval)} s. Recorded positions are held between samples.
          </p>
          <div className="actions">
            <button
              type="button"
              disabled={!canPlay && !playing}
              onClick={() => (playing ? pause() : play())}
            >
              {playing ? "Pause playback" : "Play recording"}
            </button>
            <button type="button" className="secondary" onClick={() => seek(0)}>
              Go to start
            </button>
            <button
              type="button"
              className="secondary"
              disabled={nextSample === undefined}
              onClick={() => {
                if (nextSample !== undefined) seek(nextSample);
              }}
            >
              Next recorded position
            </button>
            <button type="button" className="secondary" onClick={() => seek(duration)}>
              Show complete traces
            </button>
          </div>
          <label className="tracer-playback-compare">
            <input
              type="checkbox"
              checked={comparison}
              onChange={(event) => compare(event.target.checked)}
            />
            Compare both rates side by side
          </label>
          <div className="input-grid">
            <div className="input-field">
              <label htmlFor={`${id}-rate`}>Playback speed</label>
              <select
                id={`${id}-rate`}
                value={first.playbackMultiplier}
                disabled={comparison}
                onChange={(event) =>
                  change({ operation: "rate", multiplier: Number(event.target.value) })
                }
              >
                {TRACER_PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {formatPlaybackRate(rate)}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-field">
              <label htmlFor={`${id}-time`}>
                {comparison ? "Seconds from the start" : "Go to time (seconds)"}
              </label>
              <input
                id={`${id}-time`}
                type="number"
                min="0"
                max={duration}
                step="any"
                value={timeDraft}
                aria-invalid={timeError ? true : undefined}
                aria-describedby={timeError ? `${id}-time-error` : undefined}
                onChange={(event) => setTimeDraft(event.target.value)}
              />
              {timeError && (
                <p
                  id={`${id}-time-error`}
                  className="notice error"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {timeError}
                </p>
              )}
              <button type="submit" className="secondary">
                {comparison ? "Show the same recording time" : "Go to time"}
              </button>
              {comparison && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => seek(draftSeconds(), "elapsed")}
                >
                  Compare at elapsed playback time
                </button>
              )}
            </div>
          </div>
          <label htmlFor={`${id}-scrub`}>Display time: {display(first.position)} s</label>
          <input
            className="tracer-playback-scrub"
            id={`${id}-scrub`}
            type="range"
            min="0"
            max={duration}
            step="any"
            value={first.position}
            onChange={(event) => seek(Number(event.target.value))}
          />
          {motionPaused && (
            <p className="fine">
              Animation is paused by your reading or reduced-motion preference. Use the time field
              or step controls to inspect the same positions.
            </p>
          )}
          <p className="fine" role="status" aria-live="polite">
            {notice}
          </p>
        </fieldset>
      </form>
      <noscript>
        <p className="fine">
          The complete accepted traces are shown. JavaScript enables playback and stepping through
          the recorded positions.
        </p>
        <TracerRateComparison snapshot={snapshot} />
      </noscript>
    </div>
  );
}
