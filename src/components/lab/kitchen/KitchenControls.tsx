"use client";
import { useId, useState, type FormEvent } from "react";
import type { KitchenAccepted } from "../../../experiments/bm07/kitchen/session.ts";
import type { KitchenOptions } from "../../../experiments/bm07/kitchen/definition.ts";
import type { KitchenDocument } from "../../../experiments/bm07/kitchen/schema.ts";
import {
  kitchenInputDraft,
  reviseKitchenInputs,
  setKitchenExclusion,
  type KitchenInputKey,
} from "../../../experiments/bm07/kitchen/edit.ts";
import { display, identity } from "../presentation.ts";

type Actions = {
  accepted: KitchenAccepted;
  busy: boolean;
  revise: (d: KitchenDocument) => void;
  onError: (message: string) => void;
};
export function KitchenAnalysisControls({
  accepted,
  busy,
  reanalyze,
  onError,
}: Omit<Actions, "revise"> & { reanalyze: (options: KitchenOptions) => void }) {
  const id = useId(),
    [draft, setDraft] = useState({
      ...accepted.report.options,
      track: accepted.report.selectedTrack,
    }),
    [coverage, setCoverage] = useState(String(accepted.report.options.coverage * 100));
  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(coverage);
    if (!coverage.trim() || !Number.isFinite(n)) {
      onError("Enter a numerical coverage percentage.");
      return;
    }
    reanalyze({ ...draft, coverage: n / 100 });
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>Choose the question, keep the observations</legend>
        <div className="input-grid">
          <label htmlFor={`${id}-track`}>
            Particle track
            <select
              id={`${id}-track`}
              name="track"
              value={draft.track}
              onChange={(e) => setDraft({ ...draft, track: e.target.value })}
            >
              {accepted.report.tracks.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-axis`}>
            Coordinate
            <select
              id={`${id}-axis`}
              name="axis"
              value={draft.axis}
              onChange={(e) =>
                setDraft({ ...draft, axis: e.target.value as KitchenOptions["axis"] })
              }
            >
              <option value="x">x only</option>
              <option value="y">y only</option>
            </select>
          </label>
          <label htmlFor={`${id}-coverage`}>
            Target coverage (%)
            <input
              id={`${id}-coverage`}
              name="coverage"
              inputMode="decimal"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            />
          </label>
          <label htmlFor={`${id}-constant`}>
            Gas-constant source
            <select
              id={`${id}-constant`}
              name="constantSet"
              value={draft.constantSet}
              onChange={(e) =>
                setDraft({ ...draft, constantSet: e.target.value as KitchenOptions["constantSet"] })
              }
            >
              <option value="metadata">Use the file’s declaration</option>
              <option value="scenario-gas-constant-measured">Measured from gases</option>
              <option value="modern-si-2019">Modern SI: consistency check</option>
            </select>
          </label>
        </div>
        <button type="submit">Apply analysis choices</button>
        <p className="fine">
          These choices use accepted calibration and physical inputs. They do not apply unfinished
          drafts in the form below or change the recorded positions.
        </p>
      </fieldset>
    </form>
  );
}

const labels: Readonly<Record<KitchenInputKey, string>> = {
  pixels_per_um_x: "x scale (source pixels/μm)",
  pixels_per_um_y: "y scale (source pixels/μm)",
  pixels_per_um_x_uncertainty: "x scale standard uncertainty (pixels/μm)",
  pixels_per_um_y_uncertainty: "y scale standard uncertainty (pixels/μm)",
  calibration_axes: "Independently calibrated axes",
  pixel_aspect_ratio: "Pixel aspect ratio (height/width)",
  declared_interval_s: "Declared observation interval (s)",
  exposure_s: "Exposure (s; blank means unknown)",
  temperature_k: "Temperature (K)",
  temperature_interval_k: "Temperature range [lower,upper] (K)",
  viscosity_mpa_s: "Viscosity (mPa·s)",
  viscosity_source: "Viscosity source or declared approximation",
  radius_um: "Independent particle radius (μm)",
  radius_interval_um: "Radius range [lower,upper] (μm)",
  radius_interval_coverage: "Radius-range coverage (0–1; blank if unknown)",
  radius_provenance: "Where the radius came from",
};
export function KitchenInputs({ accepted, busy, revise, onError }: Actions) {
  const id = useId(),
    [draft, setDraft] = useState(() => kitchenInputDraft(accepted.document));
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      revise(reviseKitchenInputs(accepted.document, draft));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Check the declared inputs.");
    }
  }
  const change = (key: KitchenInputKey, value: string) => setDraft({ ...draft, [key]: value });
  const field = (key: KitchenInputKey) => (
    <label key={key} htmlFor={`${id}-${key}`}>
      {labels[key]}
      {key === "calibration_axes" ? (
        <select
          id={`${id}-${key}`}
          name={key}
          value={draft[key]}
          onChange={(e) => change(key, e.target.value)}
        >
          <option value="x">x only</option>
          <option value="y">y only</option>
          <option value="both">Both</option>
        </select>
      ) : key === "radius_provenance" ? (
        <select
          id={`${id}-${key}`}
          name={key}
          value={draft[key]}
          onChange={(e) => change(key, e.target.value)}
        >
          <option value="unknown">Not established</option>
          <option value="independent">Independent of these displacements</option>
          <option value="same-displacements">Derived from these displacements</option>
        </select>
      ) : key === "declared_interval_s" ? (
        <select
          id={`${id}-${key}`}
          name={key}
          value={draft[key]}
          onChange={(e) => change(key, e.target.value)}
        >
          {["0.5", "1", "2"].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      ) : (
        <input
          id={`${id}-${key}`}
          name={key}
          type="text"
          maxLength={512}
          value={draft[key]}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <details className="kitchen-inputs">
      <summary>Declare calibration, camera and independent physical inputs</summary>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Unapplied input declarations</legend>
          <p>
            Blank measurements stay unknown. Declaring a range records it; this preview does not
            turn that range into a combined confidence interval. Image blur, uncertain shape and
            wall proximity can invalidate the spherical-particle model.
          </p>
          <h4>Calibration and timing</h4>
          <div className="input-grid">
            {(
              [
                "calibration_axes",
                "pixels_per_um_x",
                "pixels_per_um_y",
                "pixel_aspect_ratio",
                "pixels_per_um_x_uncertainty",
                "pixels_per_um_y_uncertainty",
                "declared_interval_s",
                "exposure_s",
              ] as const
            ).map(field)}
          </div>
          <h4>Independent inputs</h4>
          <div className="input-grid">
            {(
              [
                "temperature_k",
                "temperature_interval_k",
                "viscosity_mpa_s",
                "viscosity_source",
                "radius_um",
                "radius_interval_um",
                "radius_interval_coverage",
                "radius_provenance",
              ] as const
            ).map(field)}
          </div>
          <p>
            The existing sample origin, source geometry, actual timestamps, click coordinates and
            identity decisions are preserved. Temperature does not silently set viscosity. A radius
            inferred using an assumed molecular number cannot be used to recover that number.
          </p>
          <button type="submit">Apply input declarations</button>
        </fieldset>
      </form>
    </details>
  );
}

export function KitchenObservationTable({ accepted, busy, revise, onError }: Actions) {
  const id = useId(),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [reason, setReason] = useState("");
  const points = accepted.document.points,
    first = page * 50,
    visible = points.slice(first, first + 50),
    point = selected === null ? null : points[selected]!;
  function exclude(restore = false) {
    if (selected === null) return;
    try {
      revise(setKitchenExclusion(accepted.document, selected, restore ? null : reason));
    } catch (error) {
      onError(error instanceof Error ? error.message : "The observation could not be changed.");
    }
  }
  return (
    <section {...identity(accepted.snapshot)} className="kitchen-observations">
      <h3>Every observation stays in the record</h3>
      <p>
        Showing rows {first + 1}–{Math.min(first + 50, points.length)} of {points.length}. Page
        controls change only this table. All accepted rows remain in analysis and export.
      </p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous observations
        </button>
        <button
          type="button"
          className="secondary"
          disabled={first + 50 >= points.length}
          onClick={() => setPage(page + 1)}
        >
          Next observations
        </button>
      </div>
      <div
        className="table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Observation table, scroll horizontally for all columns"
      >
        <table data-kitchen-observations>
          <caption>
            Original source-image pixels and actual timestamps; no lost row is erased
          </caption>
          <thead>
            <tr>
              {[
                "Row",
                "Kind / object",
                "Time (s)",
                "x (px)",
                "y (px)",
                "Status / reason",
                "Calibration / identity",
                "Inspect",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr key={first + i} data-kitchen-row={first + i} data-point-status={p.status}>
                <th scope="row">{first + i + 1}</th>
                <td>
                  {p.kind}: {p.objectId}
                </td>
                <td>{display(p.time)}</td>
                <td>{p.x === null ? "Not recorded" : display(p.x)}</td>
                <td>{p.y === null ? "Not recorded" : display(p.y)}</td>
                <td>
                  {p.status}
                  {p.lossReason || p.exclusionReason
                    ? `: ${p.lossReason || p.exclusionReason}`
                    : ""}
                </td>
                <td>
                  {p.calibrationId}
                  {p.identityDecision ? `: ${p.identityDecision}` : ""}
                </td>
                <td>
                  {p.kind === "particle" && ["measured", "excluded"].includes(p.status) ? (
                    <button
                      type="button"
                      className="secondary"
                      aria-pressed={selected === first + i}
                      onClick={() => {
                        setSelected(first + i);
                        setReason(p.exclusionReason);
                      }}
                    >
                      Inspect row {first + i + 1}
                    </button>
                  ) : (
                    "Retained"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {point && selected !== null && (
        <div className="notice">
          <h4>
            Observation {selected + 1}: {point.objectId}
          </h4>
          <p>
            Excluding a point preserves its coordinates and reason but withholds interval coverage
            after manual selection. Restoring an excluded row explicitly treats its recorded
            coordinates as measured again.
          </p>
          <label htmlFor={`${id}-reason`}>
            Reason for exclusion
            <textarea
              id={`${id}-reason`}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => exclude()}>
              Exclude selected observation
            </button>
            {point.status === "excluded" && (
              <button
                type="button"
                disabled={busy}
                className="secondary"
                onClick={() => exclude(true)}
              >
                Restore selected observation
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
