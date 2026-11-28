"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { BROWNIAN_DATA_CAPTION } from "../../experiments/bm07/definition.ts";
import {
  type TrajectoryAnalysis,
  trajectoryAnalysisJson,
} from "../../experiments/bm07/trajectoryAnalysis.ts";
import {
  cameraTrajectoryAnalysisJson,
  isCameraTrajectoryAnalysis,
} from "../../experiments/bm07/trajectoryCamera.ts";
import {
  type AcceptedMeasuredAnalysis,
  isMomentAnalysis,
} from "../../experiments/bm07/trajectoryComparison.ts";
import {
  parseTrajectoryCsv,
  TRAJECTORY_LIMITS,
  trajectorySiCsv,
} from "../../experiments/bm07/trajectoryCsv.ts";
import {
  EMPTY_TRAJECTORY_DRAFT,
  readMomentRequest,
  readTrajectoryDraft,
  readTrajectoryUnits,
  type TrajectoryDraft,
} from "../../experiments/bm07/trajectoryDraft.ts";
import type { MomentAnalysis } from "../../experiments/bm07/trajectoryMoments.ts";
import { CameraMomentInference } from "./CameraMomentInference.tsx";
import { CameraTrajectoryResult } from "./CameraTrajectoryResult.tsx";
import { LabMargin } from "./LabMargin.tsx";
import { MeasuredTrajectoryComparison } from "./MeasuredTrajectoryComparison.tsx";
import { Sci } from "./Sci.tsx";
import { withScripts } from "./subscripts.tsx";
import { TrajectoryInspection } from "./TrajectoryInspection.tsx";

const estimatorNames = {
  "drift-centered": "Fit a common drift · unbiased spread",
  "maximum-likelihood-centered": "Fit a common drift · maximum likelihood",
  "independent-increment-known-zero-drift": "Independently known zero drift · unbiased",
};
const display = (value: number): ReactNode =>
  value === 0 ? "0" : <Sci value={value} digits={5} />;
type AnalysisModel = "ideal-increments" | "camera-disjoint-pairs" | "camera-lag-one";
/** Measurements never enter a synthetic-recovery snapshot or a shared URL. */
export function MeasuredTrajectoryLab() {
  const id = useId();
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState("Pasted CSV");
  const [draft, setDraft] = useState<TrajectoryDraft>(EMPTY_TRAJECTORY_DRAFT);
  const [accepted, setAccepted] = useState<AcceptedMeasuredAnalysis | null>(null);
  const [analysisModel, setAnalysisModel] = useState<AnalysisModel>("ideal-increments");
  const [cameraModelDeclared, setCameraModelDeclared] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const epoch = useRef(0),
    run = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setReady(true);
    return () => {
      epoch.current++;
    };
  }, []);
  function invalidate() {
    epoch.current++;
    setPending(false);
    setDirty(true);
    setError("");
    setNotice("");
  }
  function edit<K extends keyof TrajectoryDraft>(key: K, value: TrajectoryDraft[K]) {
    invalidate();
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function changeModel(model: AnalysisModel) {
    invalidate();
    setAnalysisModel(model);
    // A declaration for ideal increments is not a declaration for a camera.
    setCameraModelDeclared(false);
    setDraft((current) => ({
      ...current,
      estimator: "drift-centered",
      radiusIndependent: false,
    }));
  }
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    invalidate();
    const token = epoch.current;
    if (file.size > TRAJECTORY_LIMITS.bytes) {
      setError("The CSV must be at most 256 KiB. The existing accepted result has not changed.");
      return;
    }
    setPending(true);
    try {
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (token !== epoch.current) return;
      setCsv(text);
      setSource(file.name);
      setNotice(
        "File loaded into the draft only. Choose units, declare the model and apply to analyze it.",
      );
    } catch {
      if (token === epoch.current)
        setError(
          "The file could not be read. Paste CSV text instead. The accepted result is unchanged.",
        );
    } finally {
      if (token === epoch.current) setPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = ++epoch.current;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const trajectory = parseTrajectoryCsv(csv, readTrajectoryUnits(draft));
      // The numerical reference owner is not loaded until an explicit request.
      const host = await import("../../experiments/bm07/trajectoryHost.ts");
      if (token !== epoch.current) return;
      let analysis: TrajectoryAnalysis | MomentAnalysis;
      if (analysisModel === "camera-lag-one") {
        analysis = host.analyzeTrajectoryMoments(
          trajectory,
          readMomentRequest(draft, cameraModelDeclared),
        );
      } else {
        const request = readTrajectoryDraft(draft);
        analysis =
          analysisModel === "camera-disjoint-pairs"
            ? host.analyzeImportedCameraTrajectory(
                trajectory,
                request.assumptions,
                cameraModelDeclared,
              )
            : host.analyzeImportedTrajectory(trajectory, request.assumptions);
      }
      setAccepted({ analysis, source, run: ++run.current });
      setDirty(false);
      setNotice(
        analysis.kind === "analyzed"
          ? "Accepted the supplied observations and declared model. Results are conditional on those assumptions."
          : "Accepted the observations for inspection. The declared model does not supply an estimate; see the explanation below.",
      );
    } catch (caught) {
      if (token === epoch.current)
        setError(
          `${caught instanceof Error ? caught.message : "This request could not be analyzed."} The accepted result is unchanged.`,
        );
    } finally {
      if (token === epoch.current) setPending(false);
    }
  }
  function clear() {
    invalidate();
    setCsv("");
    setSource("Pasted CSV");
    setDraft(EMPTY_TRAJECTORY_DRAFT);
    setAnalysisModel("ideal-increments");
    setCameraModelDeclared(false);
    setAccepted(null);
    setDirty(false);
    if (fileInput.current) fileInput.current.value = "";
    setNotice(
      "The imported data and result have been cleared from this page. Any files you explicitly downloaded remain on your device.",
    );
  }
  function download(kind: "json" | "csv") {
    if (!accepted) return;
    let url: string | null = null;
    try {
      let text: string;
      if (kind === "csv") text = trajectorySiCsv(accepted.analysis.trajectory);
      else if (isMomentAnalysis(accepted.analysis))
        text =
          JSON.stringify(
            {
              schema: "annus-mirabilis-camera-moments/v1",
              source: accepted.source,
              ...accepted.analysis,
              units: {
                positions: "m",
                time: "s",
                drift: "m/s",
                variance: "m^2",
                covariance: "m^2",
                D: "m^2/s",
                sigma2: "m^2",
              },
            },
            null,
            2,
          ) + "\n";
      else if (isCameraTrajectoryAnalysis(accepted.analysis))
        text = cameraTrajectoryAnalysisJson(accepted.analysis);
      else text = trajectoryAnalysisJson(accepted.analysis);
      url = URL.createObjectURL(
        new Blob([text], { type: kind === "json" ? "application/json" : "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `brownian-accepted-${accepted.run}-${kind === "csv" ? "SI-observations" : "analysis"}.${kind}`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      setNotice(
        `Exported accepted result ${accepted.run}, not the current draft. The export contains your supplied observations.`,
      );
    } catch {
      setError(
        "The accepted result could not be downloaded in this browser. It remains available on this page.",
      );
    } finally {
      if (url) {
        const issued = url;
        setTimeout(() => URL.revokeObjectURL(issued), 1000);
      }
    }
  }
  const numberField = (
    key: keyof Pick<
      TrajectoryDraft,
      | "micrometresPerPixel"
      | "momentDriftUmPerS"
      | "coveragePercent"
      | "localizationNanometres"
      | "exposureMilliseconds"
      | "temperatureKelvin"
      | "viscosityMillipascalSeconds"
      | "radiusMicrometres"
      | "radiusLowerUm"
      | "radiusUpperUm"
      | "radiusCoveragePercent"
    >,
    label: string,
  ) => (
    <div className="input-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <input
        id={`${id}-${key}`}
        name={key}
        type="text"
        inputMode="decimal"
        value={draft[key]}
        onChange={(event) => edit(key, event.target.value)}
      />
    </div>
  );
  const record = accepted?.analysis;
  const a = record && !isMomentAnalysis(record) ? record : null;
  return (
    <section
      className="laboratory measured-trajectory-lab"
      aria-labelledby={`${id}-title`}
      data-semantic-kind="user-supplied-observations"
      data-pending={String(pending)}
      data-ready={String(ready)}
      data-instance-id={`bm07-observations-${id}`}
      data-snapshot-version={accepted?.run ?? 0}
    >
      <header className="lab-heading">
        <h2 id={`${id}-title`}>From your observations to a conditional estimate</h2>
        <span className="badge">Local CSV · reference host calculation</span>
      </header>
      <p>
        Your data stay in this tab. Nothing is uploaded or stored, and nothing goes into a share
        link. Loading a file does not show that it is a real measurement, or that the model fits it.
      </p>
      <noscript>
        <p className="notice">
          JavaScript is required for local CSV analysis. The format, limitations and inference
          argument remain readable. No file has been read or uploaded.
        </p>
      </noscript>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={!ready}>
          <legend>1 · Supply positions, not overlapping displacements</legend>
          {/* Controls are siblings of their labels, never children. A control nested
              inside its label contributes its own value to the label's accessible name,
              so once this textarea held CSV the field announced "Or paste CSV text"
              followed by the pasted data. htmlFor/id keeps the association. */}
          <div className="input-field">
            <label htmlFor={`${id}-file`}>Local CSV file (maximum 256 KiB)</label>
            <input
              ref={fileInput}
              id={`${id}-file`}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={load}
            />
          </div>
          <div className="input-field">
            <label htmlFor={`${id}-csv`}>Or paste CSV text</label>
            <textarea
              id={`${id}-csv`}
              rows={7}
              spellCheck={false}
              maxLength={TRAJECTORY_LIMITS.bytes}
              style={{ width: "100%" }}
              value={csv}
              aria-describedby={`${id}-format`}
              onChange={(event) => {
                invalidate();
                setCsv(event.target.value);
                setSource("Pasted CSV");
              }}
            />
          </div>
          <p id={`${id}-format`} className="fine">
            Required columns: <code>time,x</code>. Optional:
            <code> y,z,track</code>; z requires y. Use decimal numbers and elapsed timestamps.
            Tracks may be interleaved, but times must increase within each track. No observations
            are sorted, resampled, deduplicated or silently dropped. At most 64 tracks and 10000
            displacement coordinates are admitted. SI exports can be re-imported with seconds and
            metres selected; conflicting units are rejected.
          </p>
          <div className="input-grid">
            {/* The select is a sibling of its label, not a child. Nesting it made the
                control's accessible name include every option text, so a screen reader
                announced "Time unit Choose explicitly Seconds Milliseconds" as the field
                name. htmlFor/id keeps the association. */}
            <div className="input-field">
              <label htmlFor={`${id}-timeUnit`}>Time unit</label>
              <select
                id={`${id}-timeUnit`}
                value={draft.timeUnit}
                onChange={(event) =>
                  edit("timeUnit", event.target.value as TrajectoryDraft["timeUnit"])
                }
              >
                <option value="">Choose explicitly</option>
                <option value="s">Seconds</option>
                <option value="ms">Milliseconds</option>
              </select>
            </div>
            <div className="input-field">
              <label htmlFor={`${id}-positionUnit`}>Position unit</label>
              <select
                id={`${id}-positionUnit`}
                value={draft.positionUnit}
                onChange={(event) =>
                  edit("positionUnit", event.target.value as TrajectoryDraft["positionUnit"])
                }
              >
                <option value="">Choose explicitly</option>
                <option value="m">Metres</option>
                <option value="um">Micrometres</option>
                <option value="nm">Nanometres</option>
                <option value="px">Pixels</option>
              </select>
            </div>
            {draft.positionUnit === "px" &&
              numberField("micrometresPerPixel", "Independent calibration (μm per pixel)")}
          </div>
        </fieldset>
        <fieldset disabled={!ready}>
          <legend>2 · Choose and declare an observation model</legend>
          <div className="input-field">
            <label htmlFor={`${id}-model`}>Observation model</label>
            <select
              id={`${id}-model`}
              value={analysisModel}
              onChange={(event) => changeModel(event.target.value as AnalysisModel)}
            >
              <option value="ideal-increments">
                Ideal independent increments · no camera effects
              </option>
              <option value="camera-lag-one">
                Camera lag-one covariance · estimate unknown tracking noise
              </option>
              <option value="camera-disjoint-pairs">
                Camera-aware disjoint frame pairs · known noise
              </option>
            </select>
          </div>
          {analysisModel === "ideal-increments" ? (
            <label className="check" htmlFor={`${id}-independent`}>
              <input
                id={`${id}-independent`}
                type="checkbox"
                checked={draft.independentIsotropic}
                onChange={(event) => edit("independentIsotropic", event.target.checked)}
              />
              I am explicitly assuming independent, isotropic Gaussian increments.
            </label>
          ) : (
            <label className="check" htmlFor={`${id}-camera-model`}>
              <input
                id={`${id}-camera-model`}
                type="checkbox"
                checked={cameraModelDeclared}
                onChange={(event) => {
                  invalidate();
                  setCameraModelDeclared(event.target.checked);
                }}
              />
              {analysisModel === "camera-lag-one" ? (
                "I assume Brownian motion, independent position errors of constant variance, uniform exposure within each frame, and a drift along this axis known independently for every selected track."
              ) : (
                <>
                  I am assuming isotropic Brownian motion with constant drift, independent
                  particles, and independent Gaussian localization errors with one common exactly
                  known noise scale. Exposure is uniform and does not overlap the next frame.
                </>
              )}
            </label>
          )}
          {analysisModel !== "camera-lag-one" && (
            <label className="check" htmlFor={`${id}-pooled`}>
              <input
                id={`${id}-pooled`}
                type="checkbox"
                checked={draft.commonDriftAndDiffusion}
                onChange={(event) => edit("commonDriftAndDiffusion", event.target.checked)}
              />
              For multiple tracks, I am assuming the same drift and diffusion coefficient for all
              particles.
            </label>
          )}
          <p className="fine">
            These are declarations, not findings from the CSV. Different-sized particles,
            confinement, correlated motion or tracking errors can invalidate them. Leave unknown
            measurements blank. Entering zero is an explicit idealization, not a way to correct
            camera data.
          </p>
          <p className="fine">
            {analysisModel === "camera-disjoint-pairs"
              ? "The camera model includes the declared localization noise and uniform exposure. It uses disjoint frame pairs within each track and fits a common drift. Noise scale, exposure, timing and calibration are held exact; their uncertainty is not included. Unknown noise, selection/censoring, irregular sampling and three-coordinate data are not admitted."
              : analysisModel === "camera-lag-one"
                ? "The lag-one calculation compares adjacent displacements within each track. The position errors share one variance along the chosen coordinate, independent of the underlying motion. Drift, exposure, spatial scale and timing are held fixed."
                : "The ideal model does not admit nonzero noise or exposure. Select the camera model for an explicitly known Gaussian noise scale and uniform exposure; it never treats adjacent noisy displacements as independent."}
          </p>
          <div className="input-grid">
            {analysisModel === "camera-lag-one" && (
              <>
                <div className="input-field">
                  <label htmlFor={`${id}-moment-axis`}>Coordinate for the moment estimates</label>
                  <select
                    id={`${id}-moment-axis`}
                    value={draft.momentAxis}
                    onChange={(event) =>
                      edit("momentAxis", event.target.value as TrajectoryDraft["momentAxis"])
                    }
                  >
                    <option value="x">x</option>
                    <option value="y">y</option>
                    <option value="z">z</option>
                  </select>
                </div>
                {numberField(
                  "momentDriftUmPerS",
                  "Independently known drift along this coordinate (μm/s)",
                )}
                <p className="fine">
                  At least four equally spaced positions are needed per track. Enter zero drift only
                  if established independently. Neighboring displacements can separate tracking
                  error from diffusion without a known noise scale.
                </p>
              </>
            )}
            {analysisModel !== "camera-lag-one" &&
              numberField(
                "localizationNanometres",
                "Position-localization standard deviation (nm; blank = unknown)",
              )}
            {numberField("exposureMilliseconds", "Camera exposure (ms; blank = unknown)")}
            <div className="input-field">
              <label htmlFor={`${id}-censored`}>
                Were observations selected, censored or motion-filtered?
              </label>
              <select
                id={`${id}-censored`}
                value={draft.censored}
                onChange={(event) =>
                  edit("censored", event.target.value as TrajectoryDraft["censored"])
                }
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {analysisModel === "ideal-increments" && (
              <div className="input-field">
                <label htmlFor={`${id}-estimator`}>Estimator</label>
                <select
                  id={`${id}-estimator`}
                  value={draft.estimator}
                  onChange={(event) =>
                    edit("estimator", event.target.value as TrajectoryDraft["estimator"])
                  }
                >
                  {Object.entries(estimatorNames).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {analysisModel === "camera-disjoint-pairs" && (
              <p className="fine">
                Estimator: disjoint frame pairs with a fitted common drift. At least two pairs are
                required. An unmatched final frame is reported, never joined to another particle;
                every imported position remains in the observation export.
              </p>
            )}
            {analysisModel !== "camera-lag-one" &&
              numberField("coveragePercent", "Conditional interval coverage (50–99.9%)")}
          </div>
        </fieldset>
        {analysisModel !== "camera-lag-one" && (
          <fieldset disabled={!ready}>
            <legend>3 · Optional modern-SI consistency comparison</legend>
            <label className="check" htmlFor={`${id}-radius`}>
              <input
                id={`${id}-radius`}
                type="checkbox"
                checked={draft.radiusIndependent}
                onChange={(event) => edit("radiusIndependent", event.target.checked)}
              />
              I have an independently measured particle radius, not one inferred from these
              displacements.
            </label>
            {draft.radiusIndependent && (
              <div className="input-grid">
                {numberField("temperatureKelvin", "Temperature (K)")}
                {numberField("viscosityMillipascalSeconds", "Dynamic viscosity (mPa s)")}
                {numberField("radiusMicrometres", "Independent particle radius (μm)")}
                <label className="check" htmlFor={`${id}-radius-interval`}>
                  <input
                    id={`${id}-radius-interval`}
                    type="checkbox"
                    checked={draft.radiusIntervalDeclared}
                    onChange={(event) => edit("radiusIntervalDeclared", event.target.checked)}
                  />
                  Include a confidence interval from my independent radius measurement
                </label>
                {draft.radiusIntervalDeclared && (
                  <>
                    {numberField("radiusLowerUm", "Lower radius bound (μm)")}
                    {numberField("radiusUpperUm", "Upper radius bound (μm)")}
                    {numberField("radiusCoveragePercent", "Coverage of the radius measurement (%)")}
                    <div className="input-field">
                      <label htmlFor={`${id}-radiusSource`}>
                        Source of radius bounds and stated coverage
                      </label>
                      <input
                        id={`${id}-radiusSource`}
                        name="radiusSource"
                        type="text"
                        maxLength={512}
                        value={draft.radiusSource}
                        onChange={(event) => edit("radiusSource", event.target.value)}
                      />
                    </div>
                    <p className="fine">
                      Use the coverage your calibration actually supplies. For example, a 97.5%
                      radius interval leaves room for a 97.5% diffusion interval to give at least
                      95% joint coverage. Temperature, viscosity, timing and spatial scale remain
                      fixed.
                    </p>
                  </>
                )}
              </div>
            )}
            <p className="fine">
              Diffusion alone cannot determine molecular number independently of particle radius.
              With modern SI constants, the optional inverse result is a consistency check, not an
              independent count of molecules. It uses the dilute-sphere Stokes–Einstein model and
              first holds radius and other calibration inputs fixed. A supplied radius interval adds
              a separate comparison that includes radius uncertainty.
            </p>
            {analysisModel === "camera-disjoint-pairs" && (
              <p className="fine">
                The comparison uses the noise-corrected diffusion estimate and disjoint-pair
                interval. An empty confidence set or one reaching zero cannot yield a finite
                molecular-number interval. Localization noise and exposure are held exact too.
              </p>
            )}
          </fieldset>
        )}
        <div className="actions">
          <button type="submit" disabled={!ready || pending}>
            {pending ? "Reading or calculating…" : "Apply observations and assumptions"}
          </button>
          <button type="button" className="secondary" disabled={!ready} onClick={clear}>
            Clear imported data
          </button>
        </div>
      </form>
      {dirty && (
        <p className="draft-note">
          Edits are a draft. Any results and downloads below still describe the last accepted
          observations and assumptions.
        </p>
      )}
      <p role="status" aria-live="polite">
        {pending ? "A request is pending. The accepted result is unchanged." : notice}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {record && accepted && (
        <section
          aria-labelledby={`${id}-result`}
          data-accepted-run={accepted.run}
          data-result-status={record.kind}
          data-semantic-kind="user-supplied-not-independently-verified"
        >
          <h3 id={`${id}-result`}>Accepted result {accepted.run}</h3>
          <p>
            Source: {accepted.source}. {record.trajectory.points.length} positions in{" "}
            {record.trajectory.trackCount} track(s), {record.trajectory.incrementCount} adjacent
            displacements in the observation ledger, {record.trajectory.dimension} coordinate(s).
            Sampling interval across the recording:{" "}
            {record.trajectory.dt === null ? (
              "not admitted as equally spaced"
            ) : (
              <>{display(record.trajectory.dt)} s</>
            )}
            .
          </p>
          {isMomentAnalysis(record) && <CameraMomentInference analysis={record} />}
          {a && (
            <>
              <p>
                Accepted estimator:{" "}
                {isCameraTrajectoryAnalysis(a)
                  ? "Disjoint frame pairs · fitted common drift"
                  : estimatorNames[a.assumptions.estimator]}
                . Requested coverage: {(a.assumptions.coverage * 100).toFixed(1)}%. Input units:{" "}
                {a.trajectory.units.time}, {a.trajectory.units.position}
                {a.trajectory.units.position === "px"
                  ? `; ${a.trajectory.units.micrometresPerPixel} μm per pixel`
                  : ""}
                .
              </p>
              <p className="notice">{a.message}</p>
              {isCameraTrajectoryAnalysis(a) && <CameraTrajectoryResult analysis={a} />}
              {a.estimate && (
                <table className="inference-summary">
                  <caption>
                    Accepted diffusion analysis · host reference calculation · SI units
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Quantity</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Diffusion estimate</th>
                      <td>{display(a.estimate.dHat)} m²/s</td>
                    </tr>
                    <tr>
                      <th scope="row">Unbiased diffusion estimate used for the interval</th>
                      <td>{display(a.estimate.unbiasedDHat)} m²/s</td>
                    </tr>
                    <tr>
                      <th scope="row">Degrees of freedom</th>
                      <td>{a.estimate.q}</td>
                    </tr>
                    <tr>
                      <th scope="row">Sample mean velocity by coordinate</th>
                      <td>
                        {Array.from(a.estimate.drift, (velocity, axis) => (
                          <span key={["x", "y", "z"][axis]}>
                            {axis > 0 ? ", " : ""}
                            {display(velocity)}
                          </span>
                        ))}{" "}
                        m/s
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Conditional diffusion interval</th>
                      <td>
                        {a.interval ? (
                          <>
                            [{display(a.interval.lower)}, {display(a.interval.upper)}] m²/s
                          </>
                        ) : (
                          "Not available; no interval is implied."
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p>{a.molecularMessage}</p>
              {a.molecular && (
                <table className="inference-summary" data-semantic-kind="consistency-check">
                  <caption>
                    Modern-SI consistency check · inputs held exact · not an independent molecular
                    count
                  </caption>
                  <tbody>
                    <tr>
                      <th scope="row">Inverse molecular-number estimate</th>
                      <td>{display(a.molecular.estimate)} mol⁻¹</td>
                    </tr>
                    <tr>
                      <th scope="row">Conditional inverse interval</th>
                      <td>
                        [{display(a.molecular.interval.lower)},{" "}
                        {display(a.molecular.interval.upper)}] mol⁻¹
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Ratio to the defined Avogadro constant</th>
                      <td>
                        {a.molecular.consistencyRatio === null
                          ? "Not available"
                          : display(a.molecular.consistencyRatio)}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Estimated Boltzmann constant</th>
                      <td>
                        {a.molecular.estimatedBoltzmannConstant === null ? (
                          "Not available"
                        ) : (
                          <>{display(a.molecular.estimatedBoltzmannConstant)} J/K</>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              {a.radiusComparison && (
                <section
                  aria-labelledby={`${id}-combined-radius`}
                  data-radius-comparison={a.radiusComparison.kind}
                >
                  <h4 id={`${id}-combined-radius`}>Including uncertainty in the particle radius</h4>
                  {a.assumptions.independentRadius?.calibration && (
                    <p>
                      Independent radius measurement:{" "}
                      {a.assumptions.independentRadius.calibration.source}. Bounds [
                      {display(a.assumptions.independentRadius.calibration.lower * 1e6)},{" "}
                      {display(a.assumptions.independentRadius.calibration.upper * 1e6)}] μm at{" "}
                      {Number(
                        (100 * a.assumptions.independentRadius.calibration.coverage).toFixed(5),
                      )}
                      % declared coverage.
                    </p>
                  )}
                  {a.radiusComparison.kind === "combined" ? (
                    <>
                      <p>
                        Combined molecular-number interval: [{display(a.radiusComparison.lower)},{" "}
                        {display(a.radiusComparison.upper)}] mol⁻¹, with at least{" "}
                        {Number((100 * a.radiusComparison.coverageLowerBound).toFixed(5))}% joint
                        coverage.
                      </p>
                      <p>
                        The same displacements give a{" "}
                        {Number((100 * a.radiusComparison.diffusionInterval.coverage).toFixed(5))}%
                        diffusion interval from{" "}
                        {display(a.radiusComparison.diffusionInterval.lower)} to{" "}
                        {display(a.radiusComparison.diffusionInterval.upper)} m²/s. The largest
                        radius and fastest diffusion give the lower molecular number. The smallest
                        radius and slowest diffusion give the upper. Adding the two possible error
                        rates bounds the chance that either interval misses. This assumes the
                        declared observation model and radius coverage.
                      </p>
                    </>
                  ) : (
                    <p>{a.radiusComparison.reason}</p>
                  )}
                </section>
              )}
            </>
          )}
          <MeasuredTrajectoryComparison current={accepted} />
          <TrajectoryInspection key={accepted.run} trajectory={record.trajectory} />
          <div className="actions">
            <button type="button" onClick={() => download("json")}>
              Download accepted analysis and observations (JSON)
            </button>
            <button type="button" className="secondary" onClick={() => download("csv")}>
              Download accepted SI observations (CSV)
            </button>
          </div>
        </section>
      )}

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">
        <noscript>
          <b className="reading-label">In one breath</b>
        </noscript>
        {withScripts(BROWNIAN_DATA_CAPTION.r0)}
      </p>
      <p data-detail="1">
        <noscript>
          <b className="reading-label">Full explanation</b>
        </noscript>
        {withScripts(BROWNIAN_DATA_CAPTION.r1)}
      </p>
      <p data-detail="2" hidden>
        <noscript>
          <b className="reading-label">Every step</b>
        </noscript>
        {withScripts(BROWNIAN_DATA_CAPTION.r2)}
      </p>
      <LabMargin>{withScripts(BROWNIAN_DATA_CAPTION.r3)}</LabMargin>
    </section>
  );
}
