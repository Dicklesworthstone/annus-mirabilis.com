import { makeRefusal, type RequestRefusal } from "../../results/refusals.ts";
import { executionOutcomeRegistry, type ExecutionOutcome } from "../../results/outcomes.ts";
import { exportKitchenCsv, parseKitchenCsv } from "./csv.ts";
import { KITCHEN_VIDEO_LIMITS, type KitchenVideoLimits } from "./definition.ts";
import { KITCHEN_METADATA_KEYS, type KitchenDocument, type KitchenFrameStamp, type KitchenPoint } from "./schema.ts";

export type CaptureFailure = Readonly<{ kind: "refused"; refusal: RequestRefusal; message: string }> |
  Readonly<{ kind: "outcome"; outcome: ExecutionOutcome; message: string }>;
export type CaptureResult<T> = Readonly<{ kind: "ready"; value: T }> | CaptureFailure;
export type VideoGeometry = Readonly<{
  width: number; height: number; canvasWidth: number; canvasHeight: number; duration: number;
}>;
export type CapturedFrame = Readonly<{ time: number; stamp: KitchenFrameStamp }>;
export type VideoCapture = Readonly<{
  geometry: VideoGeometry; fps: number; interval: "0.5" | "1" | "2";
  points: readonly KitchenPoint[];
  calibration: Readonly<Partial<Record<"x" | "y", Readonly<{ pixelsPerUm: number; standardUncertainty: number; distanceUm: number }>>>>;
}>;
export type Mark = "particle" | "stationary" | "x-a" | "x-b" | "y-a" | "y-b";
const ready = <T>(value: T): CaptureResult<T> => ({ kind: "ready", value });
export function captureRefusal(message: string, field: string, measured?: number, limit?: number): CaptureFailure {
  return { kind: "refused", message, refusal: makeRefusal("invalid-parameter", { parameterIds: [field] }, {
    details: { explanation: message, ...(Number.isFinite(measured) ? { measured: measured! } : {}),
      ...(Number.isFinite(limit) ? { limit: limit! } : {}) }, rankedRepairs: [{ label: message }],
  }) };
}
export function captureBudget(message: string, requested: number, allowed: number): CaptureFailure {
  return { kind: "outcome", message, outcome: { outcome: "budget-exhausted",
    ...executionOutcomeRegistry["budget-exhausted"],
    requested: { workUnits: requested, allocationBytes: 0 }, allowed: { workUnits: allowed, allocationBytes: 0 },
    details: { explanation: message } } };
}
export function checkVideoFile(size: number, limits = KITCHEN_VIDEO_LIMITS): CaptureResult<true> {
  return !Number.isSafeInteger(size) || size <= 0 || size > limits.fileBytes
    ? captureRefusal(`Choose a nonempty video no larger than ${limits.fileBytes} bytes. Trim a large recording; existing observations stay unchanged.`, "fileBytes", size, limits.fileBytes)
    : ready(true);
}
export function videoGeometry(width: number, height: number, duration: number,
  limits: KitchenVideoLimits = KITCHEN_VIDEO_LIMITS): CaptureResult<VideoGeometry> {
  for (const [field, value] of [["width", width], ["height", height]] as const)
    if (!Number.isInteger(value) || value < 1 || value > limits.sourceEdge)
      return captureRefusal(`The browser-oriented ${field} must be from 1 to ${limits.sourceEdge} pixels. Use a lower-resolution recording.`, field, value, limits.sourceEdge);
  if (!Number.isFinite(duration) || duration <= 0 || duration > limits.durationSeconds)
    return captureRefusal(`Use a finite video at most ${limits.durationSeconds} seconds long. Trim it first; existing clicks are preserved.`, "duration", duration, limits.durationSeconds);
  const scale = Math.min(1, limits.canvasEdge / Math.max(width, height));
  return ready(Object.freeze({ width, height, duration, canvasWidth: Math.max(1, Math.round(width * scale)),
    canvasHeight: Math.max(1, Math.round(height * scale)) }));
}
/** CSS-to-intrinsic mapping uses both actual canvas dimensions: rounding a short
 * edge must not distort the corresponding axis. No crop or hidden rotation occurs.
 */
export function sourcePoint(g: VideoGeometry, x: number, y: number, displayWidth: number, displayHeight: number): CaptureResult<Readonly<{ x: number; y: number }>> {
  if (![x, y, displayWidth, displayHeight].every(Number.isFinite) || displayWidth <= 0 || displayHeight <= 0 ||
      x < 0 || y < 0 || x > displayWidth || y > displayHeight)
    return captureRefusal("Choose a point inside the displayed source image.", "coordinates");
  return ready(Object.freeze({ x: x * g.width / displayWidth, y: y * g.height / displayHeight }));
}
export function frameStamp(requestedTime: number, actualTime: number, presentedFrames: number | null,
  fps: number, frameId: number, duration: number): CaptureResult<CapturedFrame> {
  if (![requestedTime, actualTime, fps, duration].every(Number.isFinite) || fps < 0.1 || fps > 10000 ||
      requestedTime < 0 || requestedTime > duration || actualTime < 0 || actualTime > duration ||
      !Number.isSafeInteger(frameId) || frameId < 1 || frameId > KITCHEN_VIDEO_LIMITS.frameReads ||
      (presentedFrames !== null && (!Number.isSafeInteger(presentedFrames) || presentedFrames < 1)))
    return captureRefusal("The browser did not supply an admissible frame time and identity. No observation was added.", "frame");
  return ready(Object.freeze({ time: actualTime, stamp: Object.freeze({ requestedTime,
    timingSource: presentedFrames === null ? "declared-rate" :
      Math.abs(actualTime - requestedTime) > 0.5 / fps ? "frame-callback-adjusted" : "frame-callback",
    presentedFrames, frameId }) }));
}
export function startCapture(geometry: VideoGeometry, fps: number, interval: string): CaptureResult<VideoCapture> {
  if (!Number.isFinite(fps) || fps < 0.1 || fps > 10000 || !["0.5", "1", "2"].includes(interval))
    return captureRefusal("Confirm a nominal frame rate from 0.1 to 10000 Hz and a 0.5, 1 or 2 second sampling interval.", "timing");
  return ready(Object.freeze({ geometry, fps, interval: interval as VideoCapture["interval"], points: Object.freeze([]), calibration: Object.freeze({}) }));
}
/** Last point matching a predicate, scanning backwards. Array.prototype.findLast is ES2023 and
 * this project's tsconfig lib is ES2022; `.at(-1)` used elsewhere in the reader is the same
 * generation. Kept local rather than widening lib, which would admit every ES2023 array method
 * repo-wide against no declared browser floor. */
function lastMatching(points: readonly KitchenPoint[], match: (p: KitchenPoint) => boolean): KitchenPoint | undefined {
  for (let i = points.length - 1; i >= 0; i -= 1) { const p = points[i]; if (p && match(p)) return p; }
  return undefined;
}
export function appendVideoPoint(state: VideoCapture, frame: CapturedFrame, mark: Mark,
  x: number, y: number, objectId = "particle-1", loss: KitchenPoint["lossReason"] = "",
  identityDecision: KitchenPoint["identityDecision"] = ""): CaptureResult<VideoCapture> {
  if (state.points.length >= 20000) return captureBudget("The observation limit is reached. Export this session before starting another.", state.points.length + 1, 20000);
  if (!frame || frameStamp(frame.stamp.requestedTime, frame.time, frame.stamp.presentedFrames, state.fps,
    frame.stamp.frameId, state.geometry.duration).kind !== "ready") return captureRefusal("Select an accepted frame first.", "frame");
  if (!["particle", "stationary", "x-a", "x-b", "y-a", "y-b"].includes(mark) ||
      !["", "edge", "focus", "occluded"].includes(loss) || !["", "new-object", "reacquired-same"].includes(identityDecision))
    return captureRefusal("Choose a declared observation kind and loss or identity decision.", "kind");
  if (mark !== "particle" && (loss || identityDecision)) return captureRefusal("Loss and reacquisition decisions belong to particle observations only.", "kind");
  const kind = mark === "particle" || mark === "stationary" ? mark : "calibration";
  if (kind === "particle" && !state.calibration.x && !state.calibration.y)
    return captureRefusal("Calibrate at least one axis before starting a particle track.", "calibration");
  if (kind === "calibration" && state.points.some(p => p.kind === "particle"))
    return captureRefusal("Calibration is locked after tracking begins. Export this session and start a separate calibrated session rather than rescaling earlier evidence.", "calibration");
  if (!loss && (![x, y].every(Number.isFinite) || x < 0 || y < 0 || x > state.geometry.width || y > state.geometry.height))
    return captureRefusal("Coordinates must lie inside the browser-oriented source image.", "coordinates");
  if (typeof objectId !== "string" || !objectId.trim() || objectId.length > 80 || /[\u0000-\u001f\u007f]/.test(objectId))
    return captureRefusal("Use a nonempty particle label of at most 80 characters with no control codes.", "objectId");
  const id = kind === "particle" ? objectId : kind === "stationary" ? "stationary-feature" : `mark-${mark}`;
  const previous = lastMatching(state.points, p => p.kind === kind && p.objectId === id);
  if (previous && (frame.time < previous.time || (kind === "particle" && frame.time === previous.time)))
    return captureRefusal("Use a later frame for this particle. Repeated stationary-feature and calibration clicks may share one actual frame time.", "time");
  if ((previous?.status === "lost" && !loss) !== (identityDecision !== ""))
    return captureRefusal("After a loss, explicitly choose the same particle or a new object before recording its next position.", "identityDecision");
  const p: KitchenPoint = Object.freeze({ kind, objectId: id, time: frame.time,
    x: loss ? null : x, y: loss ? null : y, status: loss ? "lost" : "measured", lossReason: loss,
    exclusionReason: "", calibrationId: "video-calibration-1", identityDecision, capture: frame.stamp });
  // Changing mark observations invalidates only an as-yet-unused axis calibration.
  const calibration = { ...state.calibration };
  if (kind === "calibration") delete calibration[mark[0] as "x" | "y"];
  return ready(Object.freeze({ ...state, calibration: Object.freeze(calibration), points: Object.freeze([...state.points, p]) }));
}
/** Geometric measurement only, not a second diffusion or confidence-interval owner.
 * The uncertainty is the standard error from repeated endpoint clicks, conditional
 * on the reader's known mark separation. It is not a combined coverage interval.
 */
export function calibrateVideoAxis(state: VideoCapture, axis: "x" | "y", distanceUm: number): CaptureResult<VideoCapture> {
  if (state.points.some(p => p.kind === "particle")) return captureRefusal("Calibration is locked once tracking starts. Keep this session and start a new one to recalibrate.", "calibration");
  if (!["x", "y"].includes(axis) || !Number.isFinite(distanceUm) || distanceUm <= 0 || distanceUm > 1e6)
    return captureRefusal("Enter the independently known positive separation of the marks, in micrometres.", "distanceUm");
  const groups = ["a", "b"].map(end => state.points.filter(p => p.kind === "calibration" && p.objectId === `mark-${axis}-${end}`).map(p => p[axis]!));
  if (groups.some(g => g.length < 3)) return captureRefusal("Click each of the two stationary micrometer marks at least three times on this axis before calibrating.", "calibration");
  const stats = groups.map(g => { const mean = g.reduce((a, b) => a + b, 0) / g.length;
    return { mean, varianceOfMean: g.reduce((s, x) => s + (x - mean) ** 2, 0) / (g.length * (g.length - 1)) }; });
  const pixelsPerUm = Math.abs(stats[1]!.mean - stats[0]!.mean) / distanceUm;
  const standardUncertainty = Math.sqrt(stats[0]!.varianceOfMean + stats[1]!.varianceOfMean) / distanceUm;
  if (!Number.isFinite(pixelsPerUm) || pixelsPerUm < 1e-6 || pixelsPerUm > 1e6 || !Number.isFinite(standardUncertainty))
    return captureRefusal("The marks do not establish a usable axis scale. Choose separated marks with a known distance.", "calibration");
  return ready(Object.freeze({ ...state, calibration: Object.freeze({ ...state.calibration,
    [axis]: Object.freeze({ pixelsPerUm, standardUncertainty, distanceUm }) }) }));
}
/** Route every acquired observation through the existing classroom CSV admission.
 * No thermal, viscosity, radius, exposure or pixel-aspect measurement is invented.
 */
export function videoDocument(state: VideoCapture, exposure = "", aspectRatio = ""): CaptureResult<KitchenDocument> {
  if (!state.calibration.x && !state.calibration.y) return captureRefusal("Calibrate at least one axis before exporting an analysis CSV. The raw session can still be downloaded.", "calibration");
  const metadata = Object.fromEntries(KITCHEN_METADATA_KEYS.map(k => [k, ""]));
  Object.assign(metadata, { source_width_px: String(state.geometry.width), source_height_px: String(state.geometry.height),
    working_scale: String(state.geometry.canvasWidth / state.geometry.width), rotation_degrees: "0",
    pixel_aspect_ratio: aspectRatio, calibration_axes: state.calibration.x && state.calibration.y ? "both" : state.calibration.x ? "x" : "y",
    calibration_method: "micrometer", declared_interval_s: state.interval, frame_rate_hz: String(state.fps),
    timing_source: state.points.some(p => p.capture?.timingSource === "declared-rate") ? "declared-rate" : "frame-callback",
    constant_set_id: "modern-si-2019", drift_source: "unknown", data_origin: "reader-supplied", radius_provenance: "unknown",
    exposure_s: exposure, sample: "Local video; browser-oriented intrinsic pixels. Encoded orientation and pixel aspect not independently verified. No extra crop or rotation applied." });
  for (const axis of ["x", "y"] as const) if (state.calibration[axis]) {
    metadata[`pixels_per_um_${axis}`] = String(state.calibration[axis]!.pixelsPerUm);
    metadata[`pixels_per_um_${axis}_uncertainty`] = String(state.calibration[axis]!.standardUncertainty);
  }
  try {
    return ready(parseKitchenCsv(exportKitchenCsv({ schemaVersion: 2, metadata: metadata as KitchenDocument["metadata"], points: state.points, notes: [] })));
  } catch (e) { return captureRefusal(e instanceof Error ? e.message : "The observation record was not admitted.", "observations"); }
}
/** A recovery export, not a purported replay or trusted import format. Never include
 * video bytes, frame pixels, file names, blob URLs, or browser paths.
 */
export function videoCaptureJson(state: VideoCapture): string {
  return JSON.stringify({ format: "annus-local-video-annotations-v1", coordinateSpace: "browser-oriented-intrinsic-pixels",
    acquisition: "Reader-supplied, not independently verified. No video or frames included.",
    geometry: state.geometry, fps: state.fps, interval: state.interval, calibration: state.calibration, points: state.points }, null, 2) + "\n";
}
