"use client";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { exportKitchenCsv } from "../../../experiments/bm07/kitchen/csv.ts";
import { KITCHEN_VIDEO_LIMITS } from "../../../experiments/bm07/kitchen/definition.ts";
import { type KitchenPoint, kitchenNumber } from "../../../experiments/bm07/kitchen/schema.ts";
import {
  appendVideoPoint,
  type CaptureFailure,
  calibrateVideoAxis,
  captureRefusal,
  type Mark,
  sourcePoint,
  startCapture,
  type VideoCapture,
  videoCaptureJson,
  videoDocument,
} from "../../../experiments/bm07/kitchen/videoCapture.ts";
import {
  type AcquiredVideoFrame,
  createVideoFrameReader,
} from "../../../experiments/bm07/kitchen/videoFrames.ts";
import "./videoTracker.css";

/** Acquisition only. The existing worker owns all diffusion/noise inference. */
export function VideoTracker({
  disabled = false,
  onAnalyze,
}: {
  disabled?: boolean;
  onAnalyze: (csv: string) => void | Promise<void>;
}) {
  const id = useId(),
    video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const reader = useRef<ReturnType<typeof createVideoFrameReader> | null>(null),
    generation = useRef(0);
  const downloads = useRef(new Set<string>()),
    fileInput = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false),
    [file, setFile] = useState<File | null>(null);
  const [capture, setCapture] = useState<VideoCapture | null>(null),
    [frame, setFrame] = useState<AcquiredVideoFrame | null>(null);
  const [busy, setBusy] = useState(false),
    [released, setReleased] = useState(false),
    [discard, setDiscard] = useState(false);
  const [failure, setFailure] = useState<CaptureFailure | null>(null),
    [notice, setNotice] = useState("");
  const [fps, setFps] = useState(""),
    [interval, setInterval] = useState("1"),
    [target, setTarget] = useState("0");
  const [mark, setMark] = useState<Mark>("x-a"),
    [x, setX] = useState("0"),
    [y, setY] = useState("0");
  const [distance, setDistance] = useState(""),
    [exposure, setExposure] = useState(""),
    [aspect, setAspect] = useState("");
  const [particle, setParticle] = useState("particle-1"),
    [identity, setIdentity] = useState<KitchenPoint["identityDecision"]>("");
  const [loss, setLoss] = useState<"edge" | "focus" | "occluded">("edge");
  useEffect(() => {
    setReady(true);
    return () => {
      generation.current++;
      reader.current?.close();
      reader.current = null;
      for (const url of downloads.current) URL.revokeObjectURL(url);
      downloads.current.clear();
    };
  }, []);
  const locked = !ready || disabled || busy;
  const calibrated = !!(capture?.calibration.x || capture?.calibration.y);
  const tracking = capture?.points.some((p) => p.kind === "particle") ?? false;
  const pointReady =
    !locked &&
    !released &&
    !!frame &&
    !!capture &&
    !(failure?.kind === "outcome" && failure.outcome.outcome === "context-lost");
  const counts = capture?.points.length ?? 0;
  function report(error: unknown) {
    setFailure(
      captureRefusal(
        error instanceof Error
          ? error.message
          : "The local operation could not finish. Existing observations are unchanged.",
        "capture",
      ),
    );
  }
  function release() {
    generation.current++;
    reader.current?.close();
    reader.current = null;
    setBusy(false);
    setReleased(true);
    setNotice(
      "The video resource was released. The captured annotations remain available for export and analysis.",
    );
  }
  async function open() {
    if (locked || capture || !file || !video.current || !canvas.current) return;
    setFailure(null);
    setNotice("");
    let rate: number;
    try {
      rate = kitchenNumber(fps, "confirmed frame rate");
    } catch (error) {
      report(error);
      return;
    }
    if (rate < 0.1 || rate > 10000) {
      setFailure(captureRefusal("Confirm a nominal rate from 0.1 to 10000 Hz.", "fps"));
      return;
    }
    const ticket = ++generation.current;
    const element = video.current,
      surface = canvas.current;
    const scratch = document.createElement("canvas");
    // Both 2D contexts are acquired once, here, instead of inside the draw callback. A
    // browser that refuses a context refuses it for the session, so asking per frame only
    // moved the discovery into a callback whose one way to report was `throw`. Asking once
    // lets the existing typed refusal answer before a file is read and leaves the callback
    // with no failure path of its own. Resizing a canvas clears it but does not invalidate
    // its context, so both stay valid across frames.
    const scratchCtx = scratch.getContext("2d"),
      surfaceCtx = surface.getContext("2d");
    if (!scratchCtx || !surfaceCtx) {
      setFailure(
        captureRefusal(
          "This browser refused a 2D drawing context, so a frame cannot be captured here. Measure the recording elsewhere and import the result as CSV; the guide, schema and practice data remain available.",
          "canvas",
        ),
      );
      return;
    }
    const local = createVideoFrameReader(element, rate, (geometry) => {
      // Draw into a temporary bounded surface first; a failed draw leaves the
      // accepted canvas untouched, rather than erasing the picture under clicks.
      scratch.width = geometry.canvasWidth;
      scratch.height = geometry.canvasHeight;
      scratchCtx.drawImage(element, 0, 0, scratch.width, scratch.height);
      surface.width = scratch.width;
      surface.height = scratch.height;
      surfaceCtx.drawImage(scratch, 0, 0);
    });
    reader.current = local;
    setBusy(true);
    setReleased(false);
    try {
      const result = await local.open(file);
      if (generation.current !== ticket) return;
      if (result.kind !== "ready") {
        setFailure(result);
        reader.current = null;
        return;
      }
      const model = startCapture(result.value.geometry, rate, interval);
      if (model.kind !== "ready") {
        setFailure(model);
        local.close();
        reader.current = null;
        return;
      }
      setCapture(model.value);
      setFrame(result.value);
      setX("0");
      setY("0");
      setNotice(
        "Video opened locally. Calibrate a measured axis before tracking; repeat clicks on one stationary feature to characterize click scatter.",
      );
    } catch (error) {
      if (generation.current === ticket) {
        local.close();
        reader.current = null;
        report(error);
      }
    } finally {
      if (generation.current === ticket) setBusy(false);
    }
  }
  async function read(time: number) {
    if (locked || released || !reader.current) return;
    const ticket = ++generation.current;
    setBusy(true);
    setFailure(null);
    try {
      const result = await reader.current.read(time);
      if (generation.current !== ticket) return;
      if (result.kind === "ready") {
        setFrame(result.value);
        setTarget(String(time));
        setNotice(
          "Frame accepted. Coordinates will use its actual captured time, not the requested time.",
        );
      } else setFailure(result);
    } catch (error) {
      if (generation.current === ticket) report(error);
    } finally {
      if (generation.current === ticket) setBusy(false);
    }
  }
  function record(lost = false) {
    if (!pointReady || !capture || !frame) return;
    if (mark === "particle" && !calibrated) {
      setFailure(
        captureRefusal(
          "Calibrate at least one axis before recording particle positions.",
          "calibration",
        ),
      );
      return;
    }
    try {
      const result = appendVideoPoint(
        capture,
        frame.frame,
        mark,
        lost ? 0 : kitchenNumber(x, "x coordinate"),
        lost ? 0 : kitchenNumber(y, "y coordinate"),
        particle,
        lost ? loss : "",
        mark === "particle" && !lost ? identity : "",
      );
      if (result.kind !== "ready") {
        setFailure(result);
        return;
      }
      setCapture(result.value);
      setIdentity("");
      setFailure(null);
      setNotice(
        `Recorded observation ${result.value.points.length} at ${frame.frame.time} seconds. No position was interpolated.`,
      );
    } catch (error) {
      report(error);
    }
  }
  function calibrate(axis: "x" | "y") {
    if (!capture || locked) return;
    try {
      const result = calibrateVideoAxis(capture, axis, kitchenNumber(distance, "mark separation"));
      if (result.kind !== "ready") setFailure(result);
      else {
        setCapture(result.value);
        setFailure(null);
        setNotice(
          `Axis ${axis} calibrated from repeated mark clicks. This calibration is fixed once tracking begins.`,
        );
      }
    } catch (error) {
      report(error);
    }
  }
  function key(event: KeyboardEvent<HTMLCanvasElement>) {
    if (
      !pointReady ||
      !capture ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const nx =
      Number(x) + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0);
    const ny = Number(y) + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0);
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      setX(String(Math.max(0, Math.min(capture.geometry.width, nx))));
      setY(String(Math.max(0, Math.min(capture.geometry.height, ny))));
    }
  }
  function csv() {
    if (!capture) return null;
    const result = videoDocument(capture, exposure, aspect);
    if (result.kind !== "ready") {
      setFailure(result);
      return null;
    }
    return exportKitchenCsv(result.value);
  }
  function download(kind: "csv" | "json") {
    if (!capture) return;
    try {
      const text = kind === "json" ? videoCaptureJson(capture) : csv();
      if (!text) return;
      const url = URL.createObjectURL(
        new Blob([text], { type: kind === "json" ? "application/json" : "text/csv" }),
      );
      downloads.current.add(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = `video-annotations.${kind}`;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        downloads.current.delete(url);
      }, 1000);
    } catch (error) {
      report(error);
    }
  }
  async function analyze() {
    try {
      const text = csv();
      if (text) {
        await onAnalyze(text);
        setNotice(
          "Observations sent to the local analyzer below. Check its accepted-result or refusal message. Later capture edits do not change that submitted snapshot.",
        );
      }
    } catch (error) {
      report(error);
    }
  }
  function newSession() {
    if (!discard || locked) return;
    release();
    setCapture(null);
    setFrame(null);
    setFile(null);
    setDiscard(false);
    setReleased(false);
    setExposure("");
    setAspect("");
    setDistance("");
    setTarget("0");
    setMark("x-a");
    setFailure(null);
    setNotice("");
    if (fileInput.current) fileInput.current.value = "";
    if (canvas.current) {
      canvas.current.width = 1;
      canvas.current.height = 1;
    }
  }
  return (
    <section
      className="video-tracker"
      id={`${id}-local-video`}
      aria-labelledby={`${id}-title`}
      data-local-video
    >
      <h3 id={`${id}-title`}>Track a particle in a local video</h3>
      <p>
        No video or frame pixels are uploaded or included in exports. Nothing is saved
        automatically. Keep the original recording and download annotations before leaving this
        page.
      </p>
      <p className="fine">
        Limits: 256 MiB, 10 minutes, 4096 pixels per source edge, a 1920-pixel working canvas, 2000
        requested frame reads, and 2 seconds per read. Internal decoder work is not observable or
        counted. Unsupported videos can still be measured elsewhere and imported as CSV.
      </p>
      <noscript>
        <p>
          Video capture requires JavaScript. The guide, schema and practice data remain available
          below.
        </p>
      </noscript>
      <fieldset disabled={locked || !!capture}>
        <legend>Choose the recording and confirm its timing</legend>
        <div className="field">
          <label htmlFor={`${id}-video-file`}>Local video</label>
          <input
            id={`${id}-video-file`}
            ref={fileInput}
            type="file"
            accept="video/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFailure(null);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-fps`}>Confirmed nominal frame rate (Hz)</label>
          <input
            id={`${id}-fps`}
            type="text"
            inputMode="decimal"
            value={fps}
            placeholder="Read from your recording"
            onChange={(e) => setFps(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-interval`}>Requested sampling interval</label>
          <select
            id={`${id}-interval`}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          >
            <option value="0.5">0.5 seconds</option>
            <option value="1">1 second</option>
            <option value="2">2 seconds</option>
          </select>
        </div>
        <button type="button" disabled={!file} onClick={() => void open()}>
          Open selected local video
        </button>
      </fieldset>
      <p className="fine">
        The small video is the decoder view; the large canvas is the frozen frame used for
        annotation. Coordinates are browser-oriented intrinsic pixels. Encoded rotation and pixel
        aspect are not independently verified. No crop or extra rotation is applied.
      </p>
      <video
        ref={video}
        muted
        playsInline
        preload="none"
        className="video-decoder"
        aria-label="Local video decoder view"
      />
      <div className="video-frame-wrap">
        <canvas
          ref={canvas}
          width={1}
          height={1}
          tabIndex={pointReady ? 0 : -1}
          role="img"
          aria-label="Captured video frame. Choose coordinates by pointer or arrow keys, then use Record point. Typed coordinates are also available."
          onKeyDown={key}
          onClick={(event) => {
            if (!pointReady || !capture) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const point = sourcePoint(
              capture.geometry,
              event.clientX - rect.left,
              event.clientY - rect.top,
              rect.width,
              rect.height,
            );
            if (point.kind === "ready") {
              setX(String(point.value.x));
              setY(String(point.value.y));
            } else setFailure(point);
          }}
        />
        {capture && frame && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && (
          <svg
            viewBox={`0 0 ${capture.geometry.width} ${capture.geometry.height}`}
            aria-hidden="true"
          >
            <path
              d={`M ${Number(x) - 8} ${y} h 16 M ${x} ${Number(y) - 8} v 16`}
              stroke="white"
              strokeWidth="4"
            />
            <path
              d={`M ${Number(x) - 8} ${y} h 16 M ${x} ${Number(y) - 8} v 16`}
              stroke="black"
              strokeWidth="2"
            />
          </svg>
        )}
      </div>
      {frame && (
        <p data-captured-frame>
          Frame {frame.frame.stamp.frameId}: actual time {frame.frame.time} s; requested{" "}
          {frame.frame.stamp.requestedTime} s. Timing: {frame.frame.stamp.timingSource}.
          Presentation counter:{" "}
          {frame.frame.stamp.presentedFrames ?? "unavailable — inferred timing"}. {frame.reads}{" "}
          frame reads.
        </p>
      )}
      {frame &&
        frame.reads >= KITCHEN_VIDEO_LIMITS.frameReads * KITCHEN_VIDEO_LIMITS.warningFraction && (
          <p className="notice">
            Approaching the frame-read limit. Export annotations now; they are not saved
            automatically.
          </p>
        )}
      <fieldset disabled={locked || released || !capture}>
        <legend>Select a paused frame</legend>
        <div className="field">
          <label htmlFor={`${id}-target-time`}>Requested video time (seconds)</label>
          <input
            id={`${id}-target-time`}
            type="text"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              void read(kitchenNumber(target, "requested time"));
            } catch (error) {
              report(error);
            }
          }}
        >
          Read requested frame
        </button>
        <button
          type="button"
          onClick={() => {
            if (frame && capture)
              void read(frame.frame.stamp.requestedTime + Number(capture.interval));
          }}
        >
          Next sample
        </button>
      </fieldset>
      <button type="button" disabled={!ready || (!capture && !busy) || released} onClick={release}>
        Stop and release video; keep annotations
      </button>
      <fieldset disabled={!pointReady}>
        <legend>Record a source-pixel position</legend>
        <div className="field">
          <label htmlFor={`${id}-mark`}>Observation</label>
          <select
            id={`${id}-mark`}
            value={mark}
            onChange={(e) => {
              setMark(e.target.value as Mark);
              setIdentity("");
            }}
          >
            <option value="x-a">X calibration mark A</option>
            <option value="x-b">X calibration mark B</option>
            <option value="y-a">Y calibration mark A</option>
            <option value="y-b">Y calibration mark B</option>
            <option value="stationary">One stationary feature</option>
            <option value="particle">Moving particle</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-x`}>X (source pixels)</label>
          <input
            id={`${id}-x`}
            type="text"
            inputMode="decimal"
            value={x}
            onChange={(e) => setX(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-y`}>Y (source pixels)</label>
          <input
            id={`${id}-y`}
            type="text"
            inputMode="decimal"
            value={y}
            onChange={(e) => setY(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={mark === "particle" && !calibrated}
          onClick={() => record()}
        >
          Record point
        </button>
        <p>
          Arrow keys move the crosshair by one source pixel; Shift moves ten. Pointer selection does
          not record a point until you choose Record point.
        </p>
        {mark === "particle" && (
          <>
            <div className="field">
              <label htmlFor={`${id}-particle`}>Particle label</label>
              <input
                id={`${id}-particle`}
                value={particle}
                maxLength={80}
                onChange={(e) => setParticle(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-identity`}>First position after a loss</label>
              <select
                id={`${id}-identity`}
                value={identity}
                onChange={(e) => setIdentity(e.target.value as KitchenPoint["identityDecision"])}
              >
                <option value="">No reacquisition decision</option>
                <option value="reacquired-same">I identify the same particle</option>
                <option value="new-object">This is a new object</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-loss`}>Loss reason</label>
              <select
                id={`${id}-loss`}
                value={loss}
                onChange={(e) => setLoss(e.target.value as typeof loss)}
              >
                <option value="edge">Left the image edge</option>
                <option value="focus">Lost focus</option>
                <option value="occluded">Occluded</option>
              </select>
            </div>
            <button type="button" disabled={!calibrated} onClick={() => record(true)}>
              Record loss at this frame
            </button>
          </>
        )}
      </fieldset>
      <fieldset disabled={locked || !capture || tracking}>
        <legend>Calibrate measured axes before tracking</legend>
        <p>
          Click each of two fixed micrometer marks at least three times. For X, use their known
          horizontal separation; for Y, use their known vertical separation. Do not change
          magnification, stabilization or camera geometry during this session. One calibrated axis
          is sufficient for one-coordinate analysis.
        </p>
        <div className="field">
          <label htmlFor={`${id}-distance`}>Known mark separation (micrometres)</label>
          <input
            id={`${id}-distance`}
            type="text"
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </div>
        <button type="button" onClick={() => calibrate("x")}>
          Calibrate X
        </button>
        <button type="button" onClick={() => calibrate("y")}>
          Calibrate Y
        </button>
      </fieldset>
      {capture && (
        <div data-video-calibration>
          {(["x", "y"] as const).map((axis) => (
            <p key={axis}>
              {axis.toUpperCase()}:{" "}
              {capture.calibration[axis]
                ? `${capture.calibration[axis]!.pixelsPerUm} px/µm; repeated-click standard uncertainty ${capture.calibration[axis]!.standardUncertainty} px/µm`
                : "not calibrated"}
              .
            </p>
          ))}
        </div>
      )}
      <p>
        Record at least ten independent clicks on the same stationary feature. Repeated clicks in
        one paused frame describe click scatter, not a direct measurement of moving-particle
        localization error. The analyzer states that extra assumption and does not silently pool
        axes.
      </p>
      <fieldset disabled={locked || !capture}>
        <legend>Declare camera inputs, then send a fixed snapshot to analysis</legend>
        <div className="field">
          <label htmlFor={`${id}-exposure`}>Exposure duration (seconds; blank means unknown)</label>
          <input
            id={`${id}-exposure`}
            type="text"
            inputMode="decimal"
            value={exposure}
            onChange={(e) => setExposure(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-aspect`}>Verified pixel aspect ratio (blank means unknown)</label>
          <input
            id={`${id}-aspect`}
            type="text"
            inputMode="decimal"
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
          />
        </div>
        <p>
          Unknown exposure withholds a camera interval. Radius, temperature and viscosity are not
          inferred from this video; declare independently known physical inputs in the analysis
          controls below.
        </p>
        <div className="actions">
          <button type="button" disabled={!counts} onClick={() => download("json")}>
            Download raw annotations JSON
          </button>
          <button type="button" disabled={!calibrated || !counts} onClick={() => download("csv")}>
            Download analysis CSV
          </button>
          <button type="button" disabled={!tracking || !calibrated} onClick={() => void analyze()}>
            Analyze captured observations
          </button>
        </div>
        <p className="fine">
          The raw JSON is an annotation recovery record, not a video file or a supported
          session-replay import. The CSV is the supported analysis interchange.
        </p>
      </fieldset>
      <p role="status" aria-live="polite" data-video-status>
        {busy
          ? "Reading a local frame. The previous image and annotations are retained; new clicks are disabled."
          : notice}
      </p>
      {failure && (
        <p
          role="alert"
          data-video-failure={
            failure.kind === "refused" ? failure.refusal.code : failure.outcome.outcome
          }
        >
          {failure.message}
        </p>
      )}
      {capture && (
        <details>
          <summary>{counts} observations (last 30 shown; downloads contain all)</summary>
          <div className="video-observation-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kind / label</th>
                  <th>Actual time</th>
                  <th>Requested time</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Status / identity</th>
                </tr>
              </thead>
              <tbody>
                {capture.points.slice(-30).map((p) => (
                  <tr key={`${p.kind}-${p.objectId}-${p.time}`}>
                    <td>
                      {p.kind} / {p.objectId}
                    </td>
                    <td>{p.time}</td>
                    <td>{p.capture?.requestedTime}</td>
                    <td>{p.x ?? "—"}</td>
                    <td>{p.y ?? "—"}</td>
                    <td>
                      {p.status} {p.lossReason} {p.identityDecision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {capture && (
        <fieldset disabled={locked}>
          <legend>Start a separate recording</legend>
          <label>
            <input
              type="checkbox"
              checked={discard}
              onChange={(e) => setDiscard(e.target.checked)}
            />
            I have exported these annotations or choose to discard this capture session.
          </label>
          <button type="button" disabled={!discard} onClick={newSession}>
            Start new capture session
          </button>
          <p>
            Previously accepted analyzer results below are independent and are not cleared by
            starting a new capture.
          </p>
        </fieldset>
      )}
    </section>
  );
}
