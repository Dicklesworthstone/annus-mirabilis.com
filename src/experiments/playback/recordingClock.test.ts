import { describe, expect, test } from "bun:test";
import { formatPlaybackRate } from "../../visuals/kit/scale.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import {
  createRecordingClock,
  RecordingPlaybackError,
  recordedSampleIndex,
  recordingScale,
} from "./recordingClock.ts";

const play = { commandClass: "presentation-change", operation: "play" } as const;
const pause = { commandClass: "presentation-change", operation: "pause" } as const;

describe("accepted-recording playback (am-inst-real-rate-mode-gtez)", () => {
  test("starts as a complete static case; one host second advances exactly one recorded second", () => {
    const clock = createRecordingClock(60);
    expect(clock.getSnapshot()).toEqual({ position: 60, playbackMultiplier: 1, playing: false });
    clock.change(play, 2000);
    expect(clock.getSnapshot().position).toBe(0);
    expect(clock.tick(3000).position).toBe(1);
    expect(clock.tick(3400).position).toBeCloseTo(1.4, 12);
  });

  test("rate changes preserve the current position and advance from that point at the new rate", () => {
    const clock = createRecordingClock(60);
    clock.change(play, 0);
    clock.change({ commandClass: "presentation-change", operation: "rate", multiplier: 25 }, 1000);
    expect(clock.getSnapshot().position).toBe(1);
    expect(clock.tick(2000).position).toBe(26);
    clock.change({ commandClass: "presentation-change", operation: "rate", multiplier: 1 }, 2000);
    expect(clock.tick(3000).position).toBe(27);
  });

  test("frame cadence cannot accumulate rounding into a different recorded sample at one second", () => {
    const clock = createRecordingClock(60);
    clock.change(play, 1000);
    for (let i = 1; i < 60; i++) clock.tick(1000 + (1000 * i) / 60);
    expect(clock.tick(2000).position).toBe(1);
    const samples = [0, 0.98, 1, 1.02];
    const times = { length: samples.length, at: (i: number) => samples[i] as number };
    expect(recordedSampleIndex(times, clock.getSnapshot().position)).toBe(2);
  });

  test("a long hidden or paused interval is never consumed on resume", () => {
    const clock = createRecordingClock(60);
    clock.change(play, 0);
    clock.change(pause, 500);
    const held = clock.getSnapshot();
    expect(clock.tick(90_000)).toBe(held);
    clock.change(play, 90_000);
    expect(clock.tick(90_500).position).toBe(1);
  });

  test("a completed playback stops at the last sample, and replay explicitly starts at zero", () => {
    const clock = createRecordingClock(1, 25);
    clock.change(play, 0);
    expect(clock.tick(1000)).toEqual({ position: 1, playbackMultiplier: 25, playing: false });
    clock.change(play, 1000);
    expect(clock.getSnapshot().position).toBe(0);
    expect(clock.tick(1020).position).toBe(0.5);
  });

  test("seeking pauses, and a backwards clock sample never creates extra elapsed time", () => {
    const clock = createRecordingClock(60);
    clock.change(play, 1000);
    clock.tick(2000);
    expect(clock.tick(1500).position).toBe(1);
    expect(clock.tick(3000).position).toBe(2);
    clock.change({ commandClass: "presentation-change", operation: "seek", seconds: 12 }, 3000);
    expect(clock.tick(4000)).toEqual({ position: 12, playbackMultiplier: 1, playing: false });
  });

  test("the zero-duration limiting state remains static", () => {
    const clock = createRecordingClock(0);
    expect(clock.change(play, 0)).toEqual({ position: 0, playbackMultiplier: 1, playing: false });
    expect(clock.tick(5000).position).toBe(0);
  });

  test("invalid-recording-playback refuses nonfinite, negative, out-of-recording and zero-rate inputs before mutating", () => {
    for (const duration of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => createRecordingClock(duration)).toThrow(RecordingPlaybackError);
    const clock = createRecordingClock(10);
    clock.change(play, 0);
    const before = clock.getSnapshot();
    for (const seconds of [-1, 11, Number.NaN]) {
      expect(() => clock.change({ ...play, operation: "seek", seconds }, 1000)).toThrow(
        RecordingPlaybackError,
      );
      expect(clock.getSnapshot()).toBe(before);
    }
    for (const multiplier of [0, -1, Number.POSITIVE_INFINITY]) {
      expect(() => clock.change({ ...play, operation: "rate", multiplier }, 1000)).toThrow(
        RecordingPlaybackError,
      );
      expect(clock.getSnapshot()).toBe(before);
    }
    expect(() => clock.tick(Number.NaN)).toThrow(RecordingPlaybackError);
    try {
      createRecordingClock(-1);
    } catch (error) {
      expect((error as RecordingPlaybackError).code).toBe("invalid-recording-playback");
    }
  });

  test("a coarser, duplicated recorded grid holds the last accepted sample without interpolation", () => {
    const values = [0, 0, 0.02, 0.02, 0.04, 0.06];
    const times = { length: values.length, at: (i: number) => values[i] as number };
    expect(recordedSampleIndex(times, 0)).toBe(1);
    expect(recordedSampleIndex(times, 0.039)).toBe(3);
    expect(recordedSampleIndex(times, 0.04)).toBe(4);
    expect(recordedSampleIndex(times, 0.06)).toBe(5);
  });

  test("the view's numeric scale field owns the label while magnification and other facts stay unchanged", () => {
    const scale: RepresentationScale = {
      spatialMagnification: { appliesTo: "scene", factor: 2 },
      simulatedElapsedTime: { quantityId: "elapsedTime", value: 1, unit: "s" },
      playbackMultiplier: 1,
      glyphSize: { drawnPx: 3, represents: "none" },
      quantityNormalization: { kind: "none" },
    };
    const clock = createRecordingClock(60, 25);
    clock.change(play, 0);
    const drawn = recordingScale(scale, clock.tick(1000));
    expect(drawn.playbackMultiplier).toBe(25);
    expect(drawn.simulatedElapsedTime.value).toBe(25);
    expect(formatPlaybackRate(drawn.playbackMultiplier)).toBe("25 times faster");
    expect(drawn.spatialMagnification).toBe(scale.spatialMagnification);
    expect(drawn.glyphSize).toBe(scale.glyphSize);
    expect(drawn.quantityNormalization).toBe(scale.quantityNormalization);
    expect(scale.playbackMultiplier).toBe(1);
  });
});
