"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { onReducedMotionChange } from "../../a11y/reducedMotion.ts";
import type { Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { bindLaboratoryVisibility } from "../../experiments/lifecycle/bindLaboratoryVisibility.ts";
import {
  createRecordingClock,
  recordedSampleIndex,
} from "../../experiments/playback/recordingClock.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, identity } from "./presentation.ts";
import { WalkPaths } from "./WalkPlots.tsx";
import "./walkPlayback.css";

/** Only the presentation clock moves. A new accepted observation starts paused at its end. */
export function WalkPlayback({ snapshot }: { snapshot: AcceptedSnapshot }) {
  return (
    <RecordedWalkPlayer
      key={`${snapshot.instanceId}:${snapshot.runId}:${snapshot.snapshotVersion}`}
      snapshot={snapshot}
    />
  );
}

function RecordedWalkPlayer({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  const animation = useRef<number | null>(null);
  const times = array(snapshot, "traceTimes");
  const duration = times.at(times.length - 1);
  const parameters = snapshot.parameters as Bm05Parameters;
  // The owner samples at most 101 times and repeats times for short walks. Repeated slots are
  // one recorded point, not extra jumps. Keep the last slot, as recordedSampleIndex does.
  const samples = Array.from({ length: times.length }, (_, index) => index).filter(
    (index) => index === times.length - 1 || times.at(index) !== times.at(index + 1),
  );
  const [clock] = useState(() => createRecordingClock(duration));
  const [view, setView] = useState(clock.getSnapshot);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [timeDraft, setTimeDraft] = useState(String(duration));
  const [pointDraft, setPointDraft] = useState(String(samples.length));
  const [error, setError] = useState<{ field: "time" | "point"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const selected = recordedSampleIndex(times, view.position);
  const point = samples.indexOf(selected);
  const canPlay = ready && visible && !motionPaused && duration > 0;

  const cancelFrame = useCallback(() => {
    if (animation.current !== null) window.cancelAnimationFrame(animation.current);
    animation.current = null;
  }, []);
  const pause = useCallback(() => {
    cancelFrame();
    setView(
      clock.change(
        { commandClass: "presentation-change", operation: "pause" },
        window.performance.now(),
      ),
    );
  }, [clock, cancelFrame]);

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    setReady(true);
    const unbind = bindLaboratoryVisibility(element, {
      setSchedulingPaused(paused) {
        setVisible(!paused);
        if (paused) {
          if (clock.getSnapshot().playing)
            setNotice("Playback paused while this walk is hidden. Press Play to continue.");
          pause();
        }
      },
    });
    const unbindMotion = onReducedMotionChange((held) => {
      setMotionPaused(held);
      if (held) pause();
    });
    return () => {
      unbind();
      unbindMotion();
      cancelFrame();
    };
  }, [clock, pause, cancelFrame]);

  function play() {
    if (!canPlay) return;
    setError(null);
    setView(
      clock.change(
        { commandClass: "presentation-change", operation: "play" },
        window.performance.now(),
      ),
    );
    setNotice(
      "Replaying the same accepted walks. The trial and ensemble statistics are unchanged.",
    );
    cancelFrame();
    const advance = (now: number) => {
      const next = clock.tick(now);
      setView(next);
      animation.current = next.playing ? window.requestAnimationFrame(advance) : null;
    };
    animation.current = window.requestAnimationFrame(advance);
  }

  function seek(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) {
      setError({
        field: "time",
        message: `Enter a display time from 0 to ${display(duration)} seconds. The playback and accepted trial are unchanged.`,
      });
      return;
    }
    cancelFrame();
    setView(
      clock.change(
        { commandClass: "presentation-change", operation: "seek", seconds },
        window.performance.now(),
      ),
    );
    setTimeDraft(String(seconds));
    setPointDraft(String(samples.indexOf(recordedSampleIndex(times, seconds)) + 1));
    setError(null);
    setNotice(
      `Paused at the recorded point at ${display(times.at(recordedSampleIndex(times, seconds)))} seconds. The accepted trial is unchanged.`,
    );
  }

  function seekPoint() {
    const requested = pointDraft.trim() === "" ? Number.NaN : Number(pointDraft);
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > samples.length) {
      setError({
        field: "point",
        message: `Choose a recorded point from 1 to ${samples.length}, using a whole number. The playback and accepted trial are unchanged.`,
      });
      return;
    }
    seek(times.at(samples[requested - 1] as number));
  }

  function submitTime(event: FormEvent) {
    event.preventDefault();
    seek(timeDraft.trim() === "" ? Number.NaN : Number(timeDraft));
  }

  return (
    <div ref={region} className="walk-playback" data-walk-playback="" {...identity(snapshot)}>
      <h3>Follow the recorded walks</h3>
      <p className="fine" data-walk-ensemble-time={duration}>
        The histogram and ensemble statistics stay at the accepted observation: {parameters.n}{" "}
        steps, {display(duration)} s. Playback changes only which recorded path points you see.
        These are mathematical jumps, not a movie of molecular collisions.
      </p>
      <WalkPaths snapshot={snapshot} replay={view} />
      <form
        onSubmit={submitTime}
        noValidate
        hidden={!ready}
        className="walk-playback-controls"
        aria-label="Replay accepted random walks"
      >
        <fieldset>
          <legend>Inspect the same recording</legend>
          <div className="actions">
            <button
              type="button"
              disabled={!canPlay && !view.playing}
              onClick={() => (view.playing ? pause() : play())}
            >
              {view.playing ? "Pause walk playback" : "Play recorded walks"}
            </button>
            <button type="button" className="secondary" onClick={() => seek(0)}>
              Go to start
            </button>
            <button
              type="button"
              className="secondary"
              disabled={point <= 0}
              onClick={() => seek(times.at(samples[point - 1] as number))}
            >
              Previous recorded point
            </button>
            <button
              type="button"
              className="secondary"
              disabled={point >= samples.length - 1}
              onClick={() => seek(times.at(samples[point + 1] as number))}
            >
              Next recorded point
            </button>
            <button type="button" className="secondary" onClick={() => seek(duration)}>
              Show complete walks
            </button>
          </div>
          <div className="input-grid">
            <div className="input-field">
              <label htmlFor={`${id}-rate`}>Playback speed</label>
              <select
                id={`${id}-rate`}
                value={view.playbackMultiplier}
                onChange={(event) =>
                  setView(
                    clock.change(
                      {
                        commandClass: "presentation-change",
                        operation: "rate",
                        multiplier: Number(event.target.value),
                      },
                      window.performance.now(),
                    ),
                  )
                }
              >
                {[1, 10, 25].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
              <p className="fine">
                {view.playbackMultiplier} model{" "}
                {view.playbackMultiplier === 1 ? "second" : "seconds"} per playback second.
              </p>
            </div>
            <div className="input-field">
              <label htmlFor={`${id}-time`}>Go to model time (seconds)</label>
              <input
                id={`${id}-time`}
                type="number"
                min="0"
                max={duration}
                step="any"
                value={timeDraft}
                aria-invalid={error?.field === "time" ? true : undefined}
                aria-describedby={error?.field === "time" ? `${id}-error` : undefined}
                onChange={(event) => setTimeDraft(event.target.value)}
              />
              <button type="submit" className="secondary">
                Go to time
              </button>
            </div>
            <div className="input-field">
              <label htmlFor={`${id}-point`}>Recorded point (1 to {samples.length})</label>
              <input
                id={`${id}-point`}
                type="number"
                min="1"
                max={samples.length}
                step="1"
                value={pointDraft}
                aria-invalid={error?.field === "point" ? true : undefined}
                aria-describedby={error?.field === "point" ? `${id}-error` : undefined}
                onChange={(event) => setPointDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    seekPoint();
                  }
                }}
              />
              <button type="button" className="secondary" onClick={seekPoint}>
                Go to recorded point
              </button>
            </div>
          </div>
          <label htmlFor={`${id}-scrub`}>Display time: {display(view.position)} s</label>
          <input
            id={`${id}-scrub`}
            className="walk-playback-scrub"
            type="range"
            min="0"
            max={duration}
            step="any"
            value={view.position}
            disabled={duration === 0}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <p className="fine">
            Recorded point {point + 1} of {samples.length}, at {display(times.at(selected))} s.
            Between recorded times, markers hold the preceding recorded position. The clock does not
            calculate any intervening jumps.
          </p>
          {error && (
            <p id={`${id}-error`} className="notice error" role="status" aria-live="polite">
              {error.message}
            </p>
          )}
          {motionPaused && (
            <p className="fine">
              Animation is paused by your reading or reduced-motion preference. Use the time field
              or recorded-point controls to inspect the same walks.
            </p>
          )}
          <p className="fine" role="status" aria-live="polite">
            {notice}
          </p>
        </fieldset>
      </form>
      <noscript>
        <p className="fine">
          The complete accepted walks and their final recorded positions are shown. JavaScript
          enables playback and inspection of earlier recorded points.
        </p>
      </noscript>
    </div>
  );
}
