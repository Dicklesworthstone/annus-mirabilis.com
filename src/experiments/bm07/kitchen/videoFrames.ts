import { executionOutcomeRegistry, type ExecutionOutcomeId } from "../../results/outcomes.ts";
import { KITCHEN_VIDEO_LIMITS } from "./definition.ts";
import { captureBudget, captureRefusal, checkVideoFile, frameStamp, videoGeometry,
  type CapturedFrame, type CaptureFailure, type CaptureResult, type VideoGeometry } from "./videoCapture.ts";

/** Minimal browser port also used by deterministic lifecycle tests. No worker,
 * network request, video storage, autoplay or frame-pixel serialization occurs here.
 */
export interface VideoPort {
  src: string; currentTime: number;
  readonly videoWidth: number; readonly videoHeight: number; readonly duration: number;
  readonly readyState: number; readonly seeking: boolean;
  pause(): void; load(): void; removeAttribute(name: string): void;
  addEventListener(name: string, callback: () => void): void;
  removeEventListener(name: string, callback: () => void): void;
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
}
export type AcquiredVideoFrame = Readonly<{ geometry: VideoGeometry; frame: CapturedFrame; reads: number }>;
type Limits = { readonly [K in keyof typeof KITCHEN_VIDEO_LIMITS]: number };
export type VideoReaderOptions = Readonly<{
  limits?: Limits;
  createUrl?: (file: Blob) => string;
  revokeUrl?: (url: string) => void;
  setTimer?: (callback: () => void, delay: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}>;
function outcome(code: Exclude<ExecutionOutcomeId, "budget-exhausted">, message: string): CaptureFailure {
  return { kind: "outcome", message, outcome: { outcome: code, ...executionOutcomeRegistry[code], details: { explanation: message } } };
}
export function createVideoFrameReader(video: VideoPort, fps: number,
  draw: (geometry: VideoGeometry) => void, options: VideoReaderOptions = {}) {
  const limits = options.limits ?? KITCHEN_VIDEO_LIMITS;
  const createUrl = options.createUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let url: string | null = null, disposed = false, reads = 0, epoch = 0;
  let pending: ((failure: CaptureFailure) => void) | null = null;
  let accepted: AcquiredVideoFrame | null = null, imageValid = true;
  const callbacks = typeof video.requestVideoFrameCallback === "function" && typeof video.cancelVideoFrameCallback === "function";
  function cancel(code: "cancelled" | "superseded" = "cancelled") {
    epoch++;
    pending?.(outcome(code, code === "cancelled" ? "Frame reading stopped. Existing annotations are unchanged." : "A newer frame request replaced this one."));
    pending = null;
  }
  function close() {
    cancel(); disposed = true;
    video.pause(); video.removeAttribute("src"); video.load();
    if (url !== null) { revokeUrl(url); url = null; }
  }
  function acquire(target: number, action: () => void): Promise<CaptureResult<AcquiredVideoFrame>> {
    cancel("superseded");
    if (disposed) return Promise.resolve(outcome("cancelled", "This video was released. Export annotations before starting another session."));
    if (reads >= limits.frameReads) return Promise.resolve(captureBudget("Frame-read budget reached. Export the annotations before starting a new clip.", reads + 1, limits.frameReads));
    reads++;
    const ticket = epoch, frameId = reads;
    return new Promise(resolve => {
      let finished = false, callbackId: number | null = null, timer: unknown;
      const cleanup = () => {
        if (callbackId !== null) video.cancelVideoFrameCallback?.(callbackId);
        video.removeEventListener("loadedmetadata", metadata);
        video.removeEventListener("loadeddata", fallback);
        video.removeEventListener("seeked", fallback);
        video.removeEventListener("error", error);
        clearTimer(timer);
      };
      const finish = (result: CaptureResult<AcquiredVideoFrame>) => {
        if (finished) return;
        finished = true; cleanup(); pending = null; resolve(result);
      };
      const geometry = (): CaptureResult<VideoGeometry> => {
        if (accepted && (video.videoWidth !== accepted.geometry.width || video.videoHeight !== accepted.geometry.height))
          return captureRefusal("Video dimensions changed. Export this session and recalibrate a separate clip; old annotations are unchanged.", "geometry");
        return videoGeometry(video.videoWidth, video.videoHeight, video.duration);
      };
      const metadata = () => {
        const g = geometry();
        if (g.kind !== "ready") finish(g);
        else if (video.videoWidth > limits.sourceEdge || video.videoHeight > limits.sourceEdge || video.duration > limits.durationSeconds)
          finish(captureRefusal("The decoded video exceeds this session's size or duration limit.", "video"));
      };
      const error = () => finish(outcome("environment-unsupported", "The browser could not decode this local video. Try another supported encoding or import coordinates as CSV."));
      const capture = (time: number, counter: number | null) => {
        if (finished || ticket !== epoch || video.seeking || video.readyState < 2) return false;
        const g = geometry();
        if (g.kind !== "ready") { finish(g); return true; }
        const stamp = frameStamp(target, time, counter, fps, frameId, g.value.duration);
        if (stamp.kind !== "ready") { finish(stamp); return true; }
        try { draw(g.value); }
        catch { imageValid = false; finish(outcome("context-lost", "The frame could not be drawn. No observation was added; previous annotations are preserved.")); return true; }
        imageValid = true;
        accepted = Object.freeze({ geometry: g.value, frame: stamp.value, reads });
        finish({ kind: "ready", value: accepted });
        return true;
      };
      const arm = () => {
        callbackId = video.requestVideoFrameCallback!((_now, data) => {
          callbackId = null;
          if (finished || ticket !== epoch) return;
          if (!capture(data.mediaTime, data.presentedFrames)) arm();
        });
      };
      const fallback = () => { if (!callbacks) capture(video.currentTime, null); };
      pending = failure => finish(failure);
      video.addEventListener("loadedmetadata", metadata);
      video.addEventListener("loadeddata", fallback);
      video.addEventListener("seeked", fallback);
      video.addEventListener("error", error);
      timer = setTimer(() => finish(captureBudget("Reading one frame exceeded the time budget. No click was added. Retry or use a shorter/lower-resolution clip.", limits.stepMilliseconds + 1, limits.stepMilliseconds)), limits.stepMilliseconds);
      try {
        video.pause();
        if (callbacks) arm();
        action();
      } catch { error(); }
    });
  }
  return {
    get reads() { return reads; },
    get callbackTiming() { return callbacks; },
    async open(file: Blob): Promise<CaptureResult<AcquiredVideoFrame>> {
      if (url || disposed) return captureRefusal("Start a new capture session before choosing another video.", "file");
      const checked = checkVideoFile(file.size);
      if (checked.kind !== "ready") return checked;
      if (file.size > limits.fileBytes) return captureRefusal("The local file exceeds the configured byte limit.", "fileBytes", file.size, limits.fileBytes);
      try { url = createUrl(file); }
      catch { return outcome("environment-unsupported", "Local video URLs are unavailable. Use the CSV import instead."); }
      const result = await acquire(0, () => { video.src = url!; video.load(); });
      if (result.kind !== "ready") close();
      return result;
    },
    read(time: number): Promise<CaptureResult<AcquiredVideoFrame>> {
      if (!accepted || !url || disposed) return Promise.resolve(outcome("cancelled", "Open a local video before reading a frame."));
      if (!Number.isFinite(time) || time < 0 || time >= accepted.geometry.duration)
        return Promise.resolve(captureRefusal("Choose a time at or after zero and before the end of this video.", "time"));
      if (imageValid && !pending && accepted.frame.stamp.requestedTime === time && !video.seeking)
        return Promise.resolve({ kind: "ready", value: accepted });
      return acquire(time, () => { video.currentTime = time; });
    },
    cancel: () => cancel(), close,
  };
}
