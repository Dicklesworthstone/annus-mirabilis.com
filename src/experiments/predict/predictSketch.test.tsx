import { describe, expect, test } from "bun:test";
import { type PredictionPromptSpec, validatePredictionPayload } from "../tapes/schema.ts";
import {
  clearSketchPoints,
  createSketchKeyboardState,
  getSketchStatusAnnouncement,
  MAX_SKETCH_POINTS,
  moveSketchCursor,
  placeSketchPoint,
  processSketchPoints,
  quantizeAxisValue,
  ramerDouglasPeucker,
  SKETCH_QUANTUM,
  type SketchPoint,
  undoSketchPoint,
} from "./predictSketch.ts";

describe("predictSketch - quantization & simplification", () => {
  test("quantizeAxisValue quantizes to 10^-3 fraction of range", () => {
    const range = [0, 10] as const;
    // 10^-3 of 10 is 0.01
    const q1 = quantizeAxisValue(5.0049, range);
    expect(q1).toBe(5);
    const q2 = quantizeAxisValue(5.006, range);
    expect(q2).toBe(5.01);
  });

  test("ramerDouglasPeucker preserves collinear endpoints within tolerance", () => {
    const straightLine: SketchPoint[] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ];
    const simplified = ramerDouglasPeucker(straightLine, 0.01);
    expect(simplified).toEqual([
      [0, 0],
      [4, 4],
    ]);
  });

  test("processSketchPoints bounds a 10,000-point input to <= 64 points and replays identically", () => {
    // Generate a 10,000 point noisy curve (e.g. sin wave with oscillation)
    const points10k: SketchPoint[] = [];
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const y = 0.5 + 0.4 * Math.sin(x * Math.PI * 4) + 0.02 * Math.cos(x * 50);
      points10k.push([x, y]);
    }

    expect(points10k.length).toBe(10000);

    const xRange = [0, 1] as const;
    const yRange = [0, 1] as const;

    const reduced = processSketchPoints(points10k, { xRange, yRange });

    // Must be bounded at MAX_SKETCH_POINTS (64)
    expect(reduced.length).toBeGreaterThan(0);
    expect(reduced.length).toBeLessThanOrEqual(MAX_SKETCH_POINTS);

    // Each point must be quantized
    for (const [x, y] of reduced) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }

    // Replay idempotence: processing the reduced points again yields identical output
    const replayed = processSketchPoints(reduced, { xRange, yRange });
    expect(replayed).toEqual(reduced);

    // Tape schema conformance: valid under validatePredictionPayload
    const promptSpec: PredictionPromptSpec = {
      promptId: "test-predict-sketch",
      candidateIds: ["c1", "c2", "c3"],
      verbalChoices: { directionIds: ["up"], shapeIds: ["linear"] },
      valueTargetIds: ["v1"],
      sketchAxisRanges: { x: [0, 1], y: [0, 1] },
    };

    const validated = validatePredictionPayload(
      { form: "sketch", points: reduced },
      promptSpec,
      "event.payload",
    );
    expect(validated.form).toBe("sketch");
    if (validated.form === "sketch") {
      expect(validated.points.length).toBe(reduced.length);
    }
  });

  test("processSketchPoints handles empty or 1-2 point inputs gracefully", () => {
    expect(processSketchPoints([])).toEqual([]);
    expect(processSketchPoints([[0.5, 0.5]])).toEqual([[0.5, 0.5]]);
    const two = processSketchPoints([
      [0.1, 0.2],
      [0.8, 0.9],
    ]);
    expect(two.length).toBe(2);
  });
});

describe("predictSketch - keyboard and accessibility state", () => {
  test("createSketchKeyboardState starts at range midpoint", () => {
    const state = createSketchKeyboardState([0, 100], [0, 50]);
    expect(state.cursor).toEqual([50, 25]);
    expect(state.points).toEqual([]);
  });

  test("moveSketchCursor shifts cursor within bounds", () => {
    let state = createSketchKeyboardState([0, 1], [0, 1], 0.1);
    // starts at [0.5, 0.5]
    state = moveSketchCursor(state, 1, -1);
    expect(state.cursor).toEqual([0.6, 0.4]);

    // Test clamping at bounds
    state = moveSketchCursor(state, 10, 10);
    expect(state.cursor).toEqual([1, 1]);
  });

  test("placeSketchPoint adds point, undo removes point, clear wipes all", () => {
    let state = createSketchKeyboardState([0, 1], [0, 1], 0.1);
    state = placeSketchPoint(state); // adds [0.5, 0.5]
    expect(state.points.length).toBe(1);
    expect(state.points[0]).toEqual([0.5, 0.5]);

    state = moveSketchCursor(state, 1, 1);
    state = placeSketchPoint(state); // adds [0.6, 0.6]
    expect(state.points.length).toBe(2);

    state = undoSketchPoint(state);
    expect(state.points.length).toBe(1);
    expect(state.points[0]).toEqual([0.5, 0.5]);

    state = moveSketchCursor(state, -1, -1); // cursor back to [0.5, 0.5]
    state = placeSketchPoint(state); // re-add duplicate point is deduplicated
    expect(state.points.length).toBe(1);

    state = clearSketchPoints(state);
    expect(state.points.length).toBe(0);
  });

  test("getSketchStatusAnnouncement formats non-color accessibility messages", () => {
    let state = createSketchKeyboardState([0, 1], [0, 1]);
    const initMsg = getSketchStatusAnnouncement(state);
    expect(initMsg).toContain("Cursor at (0.5, 0.5)");
    expect(initMsg).toContain("0 points placed");

    state = placeSketchPoint(state);
    const addMsg = getSketchStatusAnnouncement(state, "add");
    expect(addMsg).toContain("Point added at (0.5, 0.5)");
    expect(addMsg).toContain("1 of 64 points recorded");

    const undoMsg = getSketchStatusAnnouncement(state, "undo");
    expect(undoMsg).toContain("Point removed");

    const clearMsg = getSketchStatusAnnouncement(state, "clear");
    expect(clearMsg).toContain("Sketch cleared. 0 points.");
  });
});
