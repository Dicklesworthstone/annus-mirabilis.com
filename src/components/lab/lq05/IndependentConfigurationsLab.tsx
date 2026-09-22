"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromLq05Draft, toLq05Draft } from "../../../experiments/lq05/controls.ts";
import {
  LQ05_DEFAULTS,
  LQ05_MODEL,
  LQ05_PRESETS,
  type Lq05Parameters,
  type Lq05View,
} from "../../../experiments/lq05/definition.ts";
import { decodeLq05Settings, encodeLq05Settings } from "../../../experiments/lq05/permalink.ts";
import {
  buildLq05Snapshot,
  createLq05Session,
  evaluateLq05,
  type PreparedLq05Example,
} from "../../../experiments/lq05/session.ts";
import { identity } from "../presentation.ts";
import { IndependentConfigurationsPlot } from "./IndependentConfigurationsPlot.tsx";

export function IndependentConfigurationsLab({
  example,
  title = "Independent configurations and Boltzmann entropy",
}: {
  example?: PreparedLq05Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLq05Session(`lq05-${id}`, example?.parameters ?? LQ05_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq05Snapshot(`lq05-${id}`, "lq05-init", null, LQ05_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq05Parameters;
  const [draft, setDraft] = useState(() => toLq05Draft(p));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<string | null>(null);

  const evaluation = evaluateLq05(p);

  useEffect(() => {
    const shared = decodeLq05Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq05Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(next: Lq05Parameters) {
    const outcome = session.apply(next);
    if (outcome.kind === "refused") {
      setError(outcome.refusal.message);
      return;
    }
    setError("");
    setDirty(false);
    setLinkNote("");
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = fromLq05Draft(draft);
    if (!Number.isFinite(parsed.n) || parsed.n < 1) {
      setError("Point count n must be at least 1.");
      return;
    }
    if (!Number.isFinite(parsed.f) || parsed.f <= 0 || parsed.f > 1) {
      setError("Subvolume fraction f must be strictly between 0 and 1 (0 < f <= 1).");
      return;
    }
    apply(parsed);
  }

  function setPreset(presetKey: keyof typeof LQ05_PRESETS) {
    const preset = LQ05_PRESETS[presetKey];
    if (!preset) return;
    const target = preset.parameters;
    setDraft(toLq05Draft(target));
    apply(target);
  }

  function setFraction(fVal: number) {
    const next = { ...p, f: fVal };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  function setViewMode(v: Lq05View) {
    const next = { ...p, view: v };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  function toggleLocked() {
    const next = { ...p, locked: !p.locked };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  function share() {
    const query = encodeLq05Settings(p);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/lab/lq-05?${query}`;
    setSharedUrl(url);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  return (
    <article
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-05"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ width: "100%" }}>
          <p className="eyebrow">Light Quanta · §5 Statistical Microstate Counting</p>
          <h2 id={`${id}-title`} style={{ margin: "0.25rem 0" }}>
            {title}
          </h2>
          <p className="fine" style={{ margin: "0.5rem 0 0" }}>
            How counting independent configurations produces an entropy depending on volume as n ln
            V, and why locking the positions together gives V rather than V^n.
          </p>
        </div>
      </header>

      {/* Predict Mode Card */}
      <section
        className="notice"
        style={{ marginBottom: "1.5rem" }}
        aria-label="Predict Mode: Microstate Reasoning"
      >
        <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
          Predict Mode · Microstate Reasoning
        </p>
        <h3 style={{ fontSize: "1rem", margin: "0.25rem 0 0.5rem" }}>
          With 10 independent points, what is the chance that all sit in the left half (f = 1/2)?
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", margin: "0.75rem 0" }}>
          <button
            type="button"
            className={`button ${predictAnswer === "1/2" ? "" : "secondary"}`}
            style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}
            onClick={() => setPredictAnswer("1/2")}
          >
            <strong style={{ display: "block" }}>A. About 1 in 2</strong>
            <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
              One point decides for all
            </span>
          </button>
          <button
            type="button"
            className={`button ${predictAnswer === "1/20" ? "" : "secondary"}`}
            style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}
            onClick={() => setPredictAnswer("1/20")}
          >
            <strong style={{ display: "block" }}>B. About 1 in 20</strong>
            <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
              Linear reduction with n
            </span>
          </button>
          <button
            type="button"
            className={`button ${predictAnswer === "1/1000" ? "" : "secondary"}`}
            style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}
            onClick={() => setPredictAnswer("1/1000")}
          >
            <strong style={{ display: "block" }}>C. About 1 in 1 000</strong>
            <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
              (1/2)¹⁰ = 1/1 024 (Independent product)
            </span>
          </button>
        </div>
        {predictAnswer && (
          <div
            className="notice"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              background: "var(--panel)",
              border: "1px solid var(--line)",
            }}
          >
            {predictAnswer === "1/1000" ? (
              <p className="fine" style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>
                Because the particles move independently, their individual probabilities multiply: W
                = (1/2)¹⁰ = 1/1 024 ≈ 0.0009765.
              </p>
            ) : (
              <p className="fine" style={{ margin: 0, color: "var(--accent)" }}>
                Notice: if the particles are independent, every additional particle halves the
                probability again. 10 independent particles require 10 independent successes, giving
                (1/2)¹⁰ = 1/1 024.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <nav
        aria-label="Presets"
        className="preset-list"
        style={{ alignItems: "center", marginBottom: "1.5rem" }}
      >
        <span className="fine" style={{ fontWeight: 600, marginRight: "0.25rem" }}>
          Presets:
        </span>
        {(Object.keys(LQ05_PRESETS) as (keyof typeof LQ05_PRESETS)[]).map((key) => (
          <button
            key={key}
            type="button"
            className="button secondary"
            onClick={() => setPreset(key)}
          >
            {LQ05_PRESETS[key]?.label}
          </button>
        ))}
      </nav>

      {/* Main Plot & Visualization */}
      <IndependentConfigurationsPlot parameters={p} evaluation={evaluation} />

      {/* Controls Section */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <h3 style={{ fontSize: "1rem", margin: "0 0 1rem" }}>Interactive parameter controls</h3>

        <form
          onSubmit={submit}
          className="input-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* 1. Point count n */}
          <div className="input-field">
            <label htmlFor={`${id}-n`}>Number of particles n (1 to 60):</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <input
                id={`${id}-n`}
                type="number"
                min="1"
                max="60"
                step="1"
                style={{ width: "5rem" }}
                value={draft.n}
                onChange={(e) => {
                  setDraft({ ...draft, n: e.target.value });
                  setDirty(true);
                }}
              />
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                style={{ flex: 1 }}
                value={draft.n}
                aria-label="Particle count slider"
                onChange={(e) => {
                  setDraft({ ...draft, n: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
          </div>

          {/* 2. Subvolume fraction f */}
          <div className="input-field">
            <label htmlFor={`${id}-f`}>Subvolume fraction f = V/V₀ (0.01 – 1.0):</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <input
                id={`${id}-f`}
                type="number"
                min="0.01"
                max="1.0"
                step="0.01"
                style={{ width: "5rem" }}
                value={draft.f}
                onChange={(e) => {
                  setDraft({ ...draft, f: e.target.value });
                  setDirty(true);
                }}
              />
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => setFraction(0.5)}
                >
                  Half (1/2)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => setFraction(0.25)}
                >
                  Quarter (1/4)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => setFraction(1.0)}
                >
                  Full (1)
                </button>
              </div>
            </div>
          </div>

          {/* 3. View selector & Locked toggle */}
          <div className="input-field">
            <span
              className="fine"
              style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}
            >
              Display View:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                className={`button ${p.view === "enumeration" ? "" : "secondary"}`}
                style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                onClick={() => setViewMode("enumeration")}
              >
                Enumeration
              </button>
              <button
                type="button"
                className={`button ${p.view === "sampling" ? "" : "secondary"}`}
                style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                onClick={() => setViewMode("sampling")}
              >
                Sampling
              </button>
              <button
                type="button"
                className={`button ${p.view === "logarithmic" ? "" : "secondary"}`}
                style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                onClick={() => setViewMode("logarithmic")}
              >
                Logarithmic
              </button>
            </div>
          </div>

          {/* 4. Locked positions checkbox */}
          <div className="input-field check" style={{ margin: 0 }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input type="checkbox" checked={p.locked} onChange={toggleLocked} />
              <span className="fine" style={{ fontWeight: 600 }}>
                Locked positions counterexample (W = f rather than fⁿ)
              </span>
            </label>
          </div>

          {/* Form Actions */}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingTop: "0.5rem",
            }}
          >
            <button type="submit" className="button">
              Apply parameters
            </button>
            <button type="button" onClick={share} className="button secondary">
              Copy permalink
            </button>
            {dirty && (
              <span className="fine" style={{ color: "var(--accent)" }}>
                Unapplied parameter edits.
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="notice error" style={{ marginTop: "1rem", padding: "0.75rem" }}>
            {error}
          </div>
        )}
        {linkNote && (
          <div className="notice" style={{ marginTop: "0.75rem", padding: "0.75rem" }}>
            {linkNote}
          </div>
        )}
        {sharedUrl && (
          <div
            className="notice"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              wordBreak: "break-all",
            }}
          >
            Copied link: {sharedUrl}
          </div>
        )}
      </section>

      {/* Outputs Table */}
      <section
        style={{ marginTop: "2rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}
      >
        <h3 style={{ fontSize: "1rem", margin: "0 0 1rem" }}>
          Calculated microstate and entropy outputs
        </h3>

        <section
          className="table-scroll"
          aria-label="Calculated microstate and entropy outputs table"
        >
          <table
            style={{
              width: "100%",
              textAlign: "left",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Physical Quantity</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Symbolic Form</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Calculated Value</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Physical Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Relative State Probability
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "W_locked = f" : "W = (V/V₀)ⁿ = fⁿ"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: "bold" }}>
                  {p.locked
                    ? evaluation.locked.value.toFixed(6)
                    : evaluation.independentProbability.linearRepresentable
                      ? evaluation.independentProbability.value.toExponential(6)
                      : `10^(${evaluation.independentProbability.log10W.toFixed(4)})`}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  {p.locked
                    ? "Rigid cluster moving as one unit"
                    : "Probability that all n independent points are found in V"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Natural Logarithm ln W
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "ln f" : "n ln f"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 600 }}>
                  {p.locked
                    ? Math.log(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.lnW.toFixed(6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Proportional to the entropy difference ΔS / k_B
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Dimensionless Entropy Change ΔS/k_B
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "ln f" : "n ln(V/V₀)"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 600 }}>
                  {p.locked
                    ? Math.log(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.deltaSOverKb.toFixed(6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Matches Wien-regime radiation entropy S - S₀ = (E / hν) k_B ln(V/V₀)
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Base-10 Logarithm log₁₀ W
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "log₁₀ f" : "n log₁₀ f"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked
                    ? Math.log10(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.log10W.toFixed(6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Order of magnitude (e.g. 10^-18 for n = 60)
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      {/* Assumptions & Not Modeled */}
      <footer
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            Paper Assumptions (§5 as printed)
          </h4>
          <ul
            className="fine"
            style={{
              paddingLeft: "1.25rem",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {LQ05_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            What this model leaves out (not modeled)
          </h4>
          <ul
            className="fine"
            style={{
              paddingLeft: "1.25rem",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {LQ05_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <div className="notice" style={{ marginTop: "1.5rem" }}>
          <strong>Static Worked Example (JavaScript disabled):</strong> With n = 4 independent
          points in half a volume (f = 0.5), W = (1/2)⁴ = 1/16 = 0.0625. ln W = 4 ln(0.5) ≈ -2.7726.
        </div>
      </noscript>
    </article>
  );
}
