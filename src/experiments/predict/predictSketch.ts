/**
 * Sketch capture, simplification, and quantization for predict mode (am-inst-predict-mode-ti7m).
 *
 * Requirements:
 * - Simplification bounded at 64 points (MAX_SKETCH_POINTS).
 * - Ramer-Douglas-Peucker simplification in axis units.
 * - Quantization to 10^-3 (SKETCH_QUANTUM) of each axis range.
 * - ORDER IS CRITICAL: Simplify first, then quantize (as required by
 *   the bead specification to prevent drift).
 * - Pointer and keyboard capture support.
 * - Screen-reader accessible feedback.
 */

import { MAX_SKETCH_POINTS, SKETCH_QUANTUM, type SketchPoint } from "../tapes/schema.ts";

export { MAX_SKETCH_POINTS, SKETCH_QUANTUM, type SketchPoint };

export type AxisRange = readonly [number, number];

export interface SketchOptions {
  readonly xRange?: AxisRange;
  readonly yRange?: AxisRange;
  readonly tolerance?: number;
  readonly maxPoints?: number;
}

export const DEFAULT_SKETCH_AXIS_RANGE: AxisRange = Object.freeze([0, 1]);
export const DEFAULT_SIMPLIFICATION_TOLERANCE = 0.01;

/**
 * Quantize a value to a fraction (SKETCH_QUANTUM = 1e-3) of the specified axis range.
 */
export function quantizeAxisValue(
  value: number,
  range: AxisRange = DEFAULT_SKETCH_AXIS_RANGE,
  quantum: number = SKETCH_QUANTUM,
): number {
  const [min, max] = range;
  const span = max - min || 1;
  const fraction = (value - min) / span;
  const quantizedFraction = Math.round(fraction / quantum) * quantum;
  const result = min + quantizedFraction * span;
  // Round to 8 decimal places to eliminate IEEE 754 precision artifacts
  return Math.round(result * 1e8) / 1e8;
}

/**
 * Perpendicular distance from point P to line segment AB.
 */
function perpendicularDistance(p: SketchPoint, a: SketchPoint, b: SketchPoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    const px = p[0] - a[0];
    const py = p[1] - a[1];
    return Math.sqrt(px * px + py * py);
  }

  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  const diffX = p[0] - projX;
  const diffY = p[1] - projY;
  return Math.sqrt(diffX * diffX + diffY * diffY);
}

/**
 * Standard Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
 */
export function ramerDouglasPeucker(
  points: readonly SketchPoint[],
  tolerance: number,
): SketchPoint[] {
  if (points.length <= 2) {
    return points.map(([x, y]) => [x, y]);
  }

  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;
  const p0 = points[0]!;
  const pEnd = points[end]!;

  for (let i = 1; i < end; i++) {
    const pi = points[i]!;
    const d = perpendicularDistance(pi, p0, pEnd);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), tolerance);
    const right = ramerDouglasPeucker(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [
    [p0[0], p0[1]],
    [pEnd[0], pEnd[1]],
  ];
}

/**
 * Deduplicates consecutive points with identical coordinates.
 */
export function deduplicatePoints(points: readonly SketchPoint[]): SketchPoint[] {
  if (points.length === 0) return [];
  const result: SketchPoint[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = points[i]!;
    if (prev[0] !== curr[0] || prev[1] !== curr[1]) {
      result.push(curr);
    }
  }
  return result;
}

/**
 * Process a raw series of sketch points:
 * 1. Simplifies via Ramer-Douglas-Peucker (adaptively increasing tolerance if points > maxPoints).
 * 2. Quantizes each point to SKETCH_QUANTUM on each axis range.
 * 3. Deduplicates consecutive points.
 * 4. Ensures points.length <= maxPoints.
 *
 * ORDER IS FIXED: simplify, then quantize.
 */
export function processSketchPoints(
  rawPoints: readonly SketchPoint[],
  options: SketchOptions = {},
): SketchPoint[] {
  if (rawPoints.length === 0) return [];
  const maxPoints = options.maxPoints ?? MAX_SKETCH_POINTS;
  const xRange = options.xRange ?? DEFAULT_SKETCH_AXIS_RANGE;
  const yRange = options.yRange ?? DEFAULT_SKETCH_AXIS_RANGE;
  let tolerance = options.tolerance ?? DEFAULT_SIMPLIFICATION_TOLERANCE;

  let simplified: SketchPoint[] = rawPoints.map(([x, y]) => [x, y]);

  // If already at or under max points, test if initial RDP with tolerance simplifies further
  if (simplified.length > 2) {
    simplified = ramerDouglasPeucker(simplified, tolerance);
  }

  // If points still exceed maxPoints, increase tolerance iteratively until bounded
  let attempts = 0;
  while (simplified.length > maxPoints && attempts < 50) {
    tolerance *= 1.5;
    simplified = ramerDouglasPeucker(simplified, tolerance);
    attempts++;
  }

  // Safety fallback: if still above maxPoints, uniformly subsample endpoints and intermediate points
  if (simplified.length > maxPoints) {
    const step = (simplified.length - 1) / (maxPoints - 1);
    const sampled: SketchPoint[] = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(Math.round(i * step), simplified.length - 1);
      sampled.push(simplified[idx]!);
    }
    simplified = sampled;
  }

  // Step 2: Quantize each point to axis ranges
  const quantized: SketchPoint[] = simplified.map(([x, y]) => [
    quantizeAxisValue(x, xRange),
    quantizeAxisValue(y, yRange),
  ]);

  // Step 3: Deduplicate consecutive identical points
  const deduped = deduplicatePoints(quantized);

  // If deduplication removed too much (e.g. collapsed all into 0 points), keep at least 1 point
  if (deduped.length === 0 && quantized.length > 0) {
    return [quantized[0]!];
  }

  return deduped;
}

// -----------------------------------------------------------------------------
// Keyboard & Screen Reader Sketch Support
// -----------------------------------------------------------------------------

export interface SketchKeyboardState {
  readonly cursor: SketchPoint;
  readonly points: readonly SketchPoint[];
  readonly xRange: AxisRange;
  readonly yRange: AxisRange;
  readonly stepFraction: number;
}

export function createSketchKeyboardState(
  xRange: AxisRange = DEFAULT_SKETCH_AXIS_RANGE,
  yRange: AxisRange = DEFAULT_SKETCH_AXIS_RANGE,
  stepFraction = 0.05,
): SketchKeyboardState {
  const initialX = quantizeAxisValue((xRange[0] + xRange[1]) / 2, xRange);
  const initialY = quantizeAxisValue((yRange[0] + yRange[1]) / 2, yRange);
  return {
    cursor: [initialX, initialY],
    points: [],
    xRange,
    yRange,
    stepFraction,
  };
}

export function moveSketchCursor(
  state: SketchKeyboardState,
  dxSteps: number,
  dySteps: number,
): SketchKeyboardState {
  const xSpan = state.xRange[1] - state.xRange[0];
  const ySpan = state.yRange[1] - state.yRange[0];

  const nextX = Math.max(
    state.xRange[0],
    Math.min(state.xRange[1], state.cursor[0] + dxSteps * state.stepFraction * xSpan),
  );
  const nextY = Math.max(
    state.yRange[0],
    Math.min(state.yRange[1], state.cursor[1] + dySteps * state.stepFraction * ySpan),
  );

  return {
    ...state,
    cursor: [quantizeAxisValue(nextX, state.xRange), quantizeAxisValue(nextY, state.yRange)],
  };
}

export function placeSketchPoint(state: SketchKeyboardState): SketchKeyboardState {
  if (state.points.length >= MAX_SKETCH_POINTS) {
    return state;
  }
  const point: SketchPoint = [state.cursor[0], state.cursor[1]];
  const newPoints = deduplicatePoints([...state.points, point]);
  return {
    ...state,
    points: newPoints,
  };
}

export function undoSketchPoint(state: SketchKeyboardState): SketchKeyboardState {
  if (state.points.length === 0) return state;
  return {
    ...state,
    points: state.points.slice(0, -1),
  };
}

export function clearSketchPoints(state: SketchKeyboardState): SketchKeyboardState {
  return {
    ...state,
    points: [],
  };
}

export function getSketchStatusAnnouncement(
  state: SketchKeyboardState,
  lastAction?: "move" | "add" | "undo" | "clear",
): string {
  const count = state.points.length;
  const cursorStr = `(${state.cursor[0]}, ${state.cursor[1]})`;
  if (lastAction === "add") {
    return `Point added at ${cursorStr}. ${count} of ${MAX_SKETCH_POINTS} points recorded.`;
  }
  if (lastAction === "undo") {
    return `Point removed. ${count} points remaining. Cursor at ${cursorStr}.`;
  }
  if (lastAction === "clear") {
    return `Sketch cleared. 0 points. Cursor at ${cursorStr}.`;
  }
  return `Cursor at ${cursorStr}. ${count} points placed. Press Space or Enter to add point.`;
}
