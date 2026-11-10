import type { RepresentationScale } from "../../visuals/kit/types.ts";

export type RecordingPlayback = Readonly<{
  position: number;
  playbackMultiplier: number;
  playing: boolean;
}>;

export type PlaybackAction =
  | Readonly<{ operation: "play" | "pause" }>
  | Readonly<{ operation: "seek"; seconds: number }>
  | Readonly<{ operation: "rate"; multiplier: number }>;

export type PlaybackChange = Readonly<{ commandClass: "presentation-change" }> & PlaybackAction;

export class RecordingPlaybackError extends Error {
  constructor(
    readonly code: "invalid-recording-playback",
    message: string,
  ) {
    super(message);
    this.name = "RecordingPlaybackError";
  }
}

function requireFinite(value: number, minimum: number, maximum = Number.MAX_VALUE): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum)
    throw new RecordingPlaybackError(
      "invalid-recording-playback",
      "The playback value is outside this recording's range.",
    );
}

/**
 * A host-fed clock over an ALREADY accepted recording (am-inst-real-rate-mode-gtez).
 * It has no kernel, worker, random source or scientific store. Every command is a presentation
 * change; wall-clock gaps while paused are never replayed when the reader resumes.
 */
export function createRecordingClock(duration: number, multiplier = 1) {
  requireFinite(duration, 0);
  requireFinite(multiplier, Number.MIN_VALUE);
  let state: RecordingPlayback = Object.freeze({
    position: duration,
    playbackMultiplier: multiplier,
    playing: false,
  });
  let previousTime: number | null = null;
  let anchorTime = 0;
  let anchorPosition = duration;
  const publish = (next: RecordingPlayback) => {
    if (
      next.position !== state.position ||
      next.playbackMultiplier !== state.playbackMultiplier ||
      next.playing !== state.playing
    )
      state = Object.freeze(next);
    return state;
  };
  const tick = (hostMilliseconds: number): RecordingPlayback => {
    requireFinite(hostMilliseconds, 0);
    if (!state.playing || previousTime === null) return state;
    // Ignore a backwards clock sample without moving the time origin backwards as well.
    const now = Math.max(hostMilliseconds, previousTime);
    const position = Math.min(
      duration,
      anchorPosition + ((now - anchorTime) / 1000) * state.playbackMultiplier,
    );
    previousTime = now;
    return publish({ ...state, position, playing: position < duration });
  };
  return Object.freeze({
    getSnapshot: () => state,
    tick,
    change(command: PlaybackChange, hostMilliseconds: number): RecordingPlayback {
      requireFinite(hostMilliseconds, 0);
      // Refuse an invalid command before advancing or changing the old display.
      if (command.operation === "seek") requireFinite(command.seconds, 0, duration);
      if (command.operation === "rate") requireFinite(command.multiplier, Number.MIN_VALUE);
      tick(hostMilliseconds);
      const now = Math.max(hostMilliseconds, previousTime ?? hostMilliseconds);
      switch (command.operation) {
        case "play":
          previousTime = now;
          anchorTime = now;
          anchorPosition = state.position >= duration ? 0 : state.position;
          return publish({
            ...state,
            position: anchorPosition,
            playing: duration > 0,
          });
        case "pause":
          previousTime = null;
          return publish({ ...state, playing: false });
        case "seek":
          previousTime = null;
          return publish({ ...state, position: command.seconds, playing: false });
        case "rate":
          previousTime = now;
          anchorTime = now;
          anchorPosition = state.position;
          return publish({ ...state, playbackMultiplier: command.multiplier });
      }
    },
  });
}

/** The last recorded sample at or before display time. Duplicate times are legitimate. */
export function recordedSampleIndex(
  times: Readonly<{ length: number; at(index: number): number }>,
  seconds: number,
): number {
  let first = 0;
  let end = times.length;
  while (first < end) {
    const middle = Math.floor((first + end) / 2);
    if (times.at(middle) <= seconds) first = middle + 1;
    else end = middle;
  }
  return Math.max(0, first - 1);
}

/** The view kit, including its accessible rate label, reads this single numeric rate field. */
export function recordingScale(
  scale: RepresentationScale,
  state: RecordingPlayback,
): RepresentationScale {
  return {
    ...scale,
    playbackMultiplier: state.playbackMultiplier,
    simulatedElapsedTime: { ...scale.simulatedElapsedTime, value: state.position },
  };
}
