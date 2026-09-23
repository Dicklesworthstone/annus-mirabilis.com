"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromLq07Draft, toLq07Draft } from "../../../experiments/lq07/controls.ts";
import {
  LQ07_DEFAULTS,
  LQ07_MODEL,
  LQ07_PRESETS,
  type Lq07Channels,
  type Lq07Parameters,
  type Lq07Regime,
} from "../../../experiments/lq07/definition.ts";
import { decodeLq07Settings, encodeLq07Settings } from "../../../experiments/lq07/permalink.ts";
import {
  buildLq07Snapshot,
  createLq07Session,
  evaluateLq07,
  type PreparedLq07Example,
} from "../../../experiments/lq07/session.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { identity } from "../presentation.ts";
import { FluorescencePlot } from "./FluorescencePlot.tsx";
import "./fluorescenceLab.css";

export function FluorescenceLab({
  example,
  title = "Fluorescence energy budget and Stokes's rule",
}: {
  example?: PreparedLq07Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLq07Session(`lq07-${id}`, example?.parameters ?? LQ07_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq07Snapshot(`lq07-${id}`, "lq07-init", null, LQ07_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq07Parameters;
  const [draft, setDraft] = useState(() => toLq07Draft(p));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [predictAnswer1, setPredictAnswer1] = useState<string | null>(null);
  const [predictAnswer2, setPredictAnswer2] = useState<string | null>(null);

  const evaluation = evaluateLq07(p);

  useEffect(() => {
    const shared = decodeLq07Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq07Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(next: Lq07Parameters) {
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
    const parsed = fromLq07Draft(draft);
    if (!Number.isFinite(parsed.nu1) || parsed.nu1 <= 0) {
      setError("Exciting frequency nu1 must be positive.");
      return;
    }
    if (!Number.isFinite(parsed.nu2) || parsed.nu2 <= 0) {
      setError("Emitted frequency nu2 must be positive.");
      return;
    }
    apply(parsed);
  }

  function setPreset(presetKey: keyof typeof LQ07_PRESETS) {
    const preset = LQ07_PRESETS[presetKey];
    if (!preset) return;
    const target = preset.parameters;
    setDraft(toLq07Draft(target));
    apply(target);
  }

  function setRegime(reg: Lq07Regime) {
    const next = { ...p, regime: reg };
    setDraft(toLq07Draft(next));
    apply(next);
  }

  function setChannels(ch: Lq07Channels) {
    const next = { ...p, channels: ch };
    setDraft(toLq07Draft(next));
    apply(next);
  }

  function share() {
    const query = encodeLq07Settings(p);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/lab/lq-07?${query}`;
    setSharedUrl(url);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  return (
    <article
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-07"
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
        <div>
          <p className="eyebrow">Light quanta · §7 fluorescence &amp; Stokes's rule</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="fine" style={{ marginTop: "0.5rem", fontSize: "0.95rem" }}>
            What single-quantum energy conservation, hν₁ = hν₂ + E<sub>other</sub>, allows a
            fluorescent body to emit, and where multi-quantum and thermal cases depart from it.
          </p>
        </div>
      </header>

      {/* Main Plot & Visual Ledger */}
      <FluorescencePlot parameters={p} evaluation={evaluation} />

      <details className="lab-predict lq07-predict">
        <summary>Predict first</summary>
        {/* Predict Mode Card 1: Stokes Rule */}
        <section className="lq07-prompt" aria-label="Predict first: energy conservation">
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
            Predict mode · Energy conservation
          </p>
          <h3 style={{ margin: "0.25rem 0 0.75rem" }}>
            Can fluorescent emission occur at higher frequency than the exciting light (ν₂ &gt; ν₁)
            under single-quantum absorption?
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            <button
              type="button"
              className={`button ${predictAnswer1 === "intensity" ? "" : "secondary"}`}
              style={{ textAlign: "left", padding: "0.75rem" }}
              onClick={() => setPredictAnswer1("intensity")}
            >
              <strong>With intense light</strong>
              <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
                Power per second increases
              </span>
            </button>
            <button
              type="button"
              className={`button ${predictAnswer1 === "always" ? "" : "secondary"}`}
              style={{ textAlign: "left", padding: "0.75rem" }}
              onClick={() => setPredictAnswer1("always")}
            >
              <strong>Always possible</strong>
              <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
                Medium shifts frequencies freely
              </span>
            </button>
            <button
              type="button"
              className={`button ${predictAnswer1 === "never" ? "" : "secondary"}`}
              style={{ textAlign: "left", padding: "0.75rem" }}
              onClick={() => setPredictAnswer1("never")}
            >
              <strong>Never</strong>
              <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
                One quantum in, one quantum&apos;s energy at most out
              </span>
            </button>
          </div>
          {predictAnswer1 && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: "var(--panel)",
              }}
            >
              <p style={{ margin: 0 }}>
                The model: in each elementary process one quantum of energy hν₁ is absorbed. Energy
                is conserved (hν₁ = hν₂ + E<sub>other</sub>, with E<sub>other</sub> ≥ 0), so the
                emitted quantum hν₂ cannot exceed hν₁, and ν₂ ≤ ν₁. A brighter beam delivers more
                quanta each second, not more energy in each one.
              </p>
            </div>
          )}
        </section>

        {/* Predict Mode Card 2: Weak Light Linearity */}
        <section
          className="lq07-prompt"
          style={{ margin: "1.5rem 0" }}
          aria-label="Predict mode: very weak light"
        >
          <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
            Predict mode · Very weak light
          </p>
          <h3 style={{ margin: "0.25rem 0 0.75rem" }}>
            How does the emission rate behave as the incident light becomes extremely weak?
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            <button
              type="button"
              className={`button ${predictAnswer2 === "threshold" ? "" : "secondary"}`}
              style={{ textAlign: "left", padding: "0.75rem" }}
              onClick={() => setPredictAnswer2("threshold")}
            >
              <strong>Stops below an intensity threshold</strong>
              <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
                Energy must build up first
              </span>
            </button>
            <button
              type="button"
              className={`button ${predictAnswer2 === "linear" ? "" : "secondary"}`}
              style={{ textAlign: "left", padding: "0.75rem" }}
              onClick={() => setPredictAnswer2("linear")}
            >
              <strong>Strictly proportional, zero threshold</strong>
              <span className="fine" style={{ display: "block", marginTop: "0.25rem" }}>
                Each absorbed quantum can emit on its own
              </span>
            </button>
          </div>
          {predictAnswer2 && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                background: "var(--panel)",
              }}
            >
              <p style={{ margin: 0 }}>
                The model: each absorbed quantum acts independently, with probability Y, so the
                emitted rate is proportional to the absorbed power however weak the light, with no
                threshold. A wave picture might predict a threshold, or a delay while energy
                accumulates; the light-quantum picture predicts neither.
              </p>
            </div>
          )}
        </section>
      </details>

      <fieldset className="lab-choice lq07-try">
        <legend>Try</legend>
        <div className="actions">
          {(Object.keys(LQ07_PRESETS) as (keyof typeof LQ07_PRESETS)[]).map((key) => (
            <button key={key} type="button" className="secondary" onClick={() => setPreset(key)}>
              {LQ07_PRESETS[key]?.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Interactive Controls Section */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <form onSubmit={submit} className="input-grid">
          {/* 1. Incident Frequency nu1 */}
          <div className="input-field">
            <label htmlFor={`${id}-nu1`}>Exciting frequency ν₁ (100 – 3000 THz):</label>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}
            >
              <input
                id={`${id}-nu1`}
                type="number"
                min="100"
                max="3000"
                step="10"
                value={draft.nu1}
                onChange={(e) => {
                  setDraft({ ...draft, nu1: e.target.value });
                  setDirty(true);
                }}
                style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
              />
              <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                THz
              </span>
              <span className="fine">({evaluation.budget.e1Ev.toFixed(3)} eV)</span>
            </div>
          </div>

          {/* 2. Emitted Frequency nu2 */}
          <div className="input-field">
            <label htmlFor={`${id}-nu2`}>Emitted frequency ν₂ (100 – 3000 THz):</label>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}
            >
              <input
                id={`${id}-nu2`}
                type="number"
                min="100"
                max="3000"
                step="10"
                value={draft.nu2}
                onChange={(e) => {
                  setDraft({ ...draft, nu2: e.target.value });
                  setDirty(true);
                }}
                style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
              />
              <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                THz
              </span>
              <span className="fine">({evaluation.budget.e2Ev.toFixed(3)} eV)</span>
            </div>
          </div>

          {/* 3. Accounting Regime Selector */}
          <div className="input-field" style={{ gridColumn: "1 / -1" }}>
            <span
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.4rem",
              }}
            >
              Accounting regime:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                className={`button ${p.regime === "standard-stokes" ? "" : "secondary"}`}
                onClick={() => setRegime("standard-stokes")}
              >
                Stokes's rule (§7)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "deviation-multi-quantum" ? "" : "secondary"}`}
                onClick={() => setRegime("deviation-multi-quantum")}
              >
                Deviation case 1 (k quanta)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "deviation-non-wien" ? "" : "secondary"}`}
                onClick={() => setRegime("deviation-non-wien")}
              >
                Deviation case 2 (Wien check)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "modern-thermal" ? "" : "secondary"}`}
                onClick={() => setRegime("modern-thermal")}
              >
                Modern thermal (anti-Stokes)
              </button>
            </div>
          </div>

          {/* 4. Regime Specific Parameter */}
          <div className="input-field" style={{ gridColumn: "1 / -1" }}>
            {p.regime === "deviation-multi-quantum" && (
              <>
                <label htmlFor={`${id}-k`}>Number of absorbed quanta k (1 – 5):</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-k`}
                    type="number"
                    min="1"
                    max="5"
                    value={draft.multiQuantumK}
                    onChange={(e) => {
                      setDraft({ ...draft, multiQuantumK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "6rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine">k = {p.multiQuantumK} absorbed quanta</span>
                </div>
              </>
            )}

            {p.regime === "deviation-non-wien" && (
              <>
                <label htmlFor={`${id}-tsrc`}>
                  Exciting-source temperature T<sub>src</sub> (K):
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-tsrc`}
                    type="number"
                    min="1000"
                    max="50000"
                    step="500"
                    value={draft.sourceTemperatureK}
                    onChange={(e) => {
                      setDraft({ ...draft, sourceTemperatureK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    K
                  </span>
                  {evaluation.budget.wienDeviationExpMinusX !== undefined && (
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      (e^-x = {evaluation.budget.wienDeviationExpMinusX.toFixed(4)})
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "modern-thermal" && (
              <>
                <label htmlFor={`${id}-tbody`}>
                  Body temperature T<sub>body</sub> (K):
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-tbody`}
                    type="number"
                    min="0"
                    max="1000"
                    step="10"
                    value={draft.bodyTemperatureK}
                    onChange={(e) => {
                      setDraft({ ...draft, bodyTemperatureK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    K
                  </span>
                  {evaluation.budget.thermalExtraEv !== undefined && (
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      (+{evaluation.budget.thermalExtraEv.toFixed(3)} eV)
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "standard-stokes" && (
              <ExperimentSettings contents="which channels the absorbed energy may leave by">
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.4rem",
                    }}
                  >
                    Available channels:
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className={`button ${p.channels === "light-plus-heat" ? "" : "secondary"}`}
                      onClick={() => setChannels("light-plus-heat")}
                    >
                      Light and heat (E<sub>other</sub> ≥ 0)
                    </button>
                    <button
                      type="button"
                      className={`button ${p.channels === "light-only" ? "" : "secondary"}`}
                      onClick={() => setChannels("light-only")}
                    >
                      Light only (E<sub>other</sub> = 0)
                    </button>
                  </div>
                </div>
                <p className="fine">These apply at once.</p>
              </ExperimentSettings>
            )}
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
          <div className="notice error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
        {linkNote && (
          <div className="notice" style={{ marginTop: "0.75rem" }}>
            {linkNote}
          </div>
        )}
        {sharedUrl && (
          <div
            className="notice"
            style={{ marginTop: "0.75rem", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
          >
            Copied link: {sharedUrl}
          </div>
        )}
      </section>

      {/* Outputs Table */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <h3 style={{ marginBottom: "1rem" }}>Calculated energy ledger and transition quantities</h3>

        <section
          className="table-scroll lq07-ledger"
          aria-label="Calculated energy ledger and transition quantities table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Symbol</th>
                <th scope="col">Value</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Budget verdict</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>Verdict</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
                  {evaluation.budget.status === "outside-domain" ? (
                    <span className="badge" style={{ color: "var(--accent)" }}>
                      Outside domain
                    </span>
                  ) : evaluation.budget.allowed ? (
                    <span className="badge">Allowed</span>
                  ) : (
                    <span className="badge" style={{ color: "var(--accent)" }}>
                      Disallowed
                    </span>
                  )}
                </td>
                <td className="fine">{evaluation.budget.verdictReason}</td>
              </tr>
              <tr>
                <th scope="row">Maximum allowed frequency</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>ν₂,max</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {(evaluation.budget.nu2MaxHz / 1e12).toFixed(2)} THz
                </td>
                <td className="fine">Upper frequency bound for emitted light</td>
              </tr>
              <tr>
                <th scope="row">Absorbed quantum energy</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>hν₁</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {evaluation.budget.e1Ev.toFixed(4)} eV
                </td>
                <td className="fine">Energy of one exciting light quantum</td>
              </tr>
              <tr>
                <th scope="row">Emitted quantum energy</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>hν₂</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {evaluation.budget.e2Ev.toFixed(4)} eV
                </td>
                <td className="fine">Energy of candidate emitted light quantum</td>
              </tr>
              <tr>
                <th scope="row">Non-optical dissipation (heat)</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  E<sub>other</sub>
                </td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {evaluation.budget.allowed
                    ? `${evaluation.budget.eOtherEv.toFixed(4)} eV`
                    : "Not applicable (disallowed)"}
                </td>
                <td className="fine">Energy transferred to thermal modes of medium</td>
              </tr>
              <tr>
                <th scope="row">Energy deficit</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>ΔE</td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "bold",
                    color: "var(--accent)",
                  }}
                >
                  {evaluation.budget.energyDeficitEv.toFixed(4)} eV
                </td>
                <td className="fine">
                  {evaluation.budget.energyDeficitEv > 0
                    ? "Energy required from non-existent source"
                    : "Zero (Conserved)"}
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
            Paper assumptions (§7 as printed)
          </h4>
          <ul className="fine" style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {LQ07_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            What this model leaves out (not modeled)
          </h4>
          <ul className="fine" style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {LQ07_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <p className="notice" style={{ marginTop: "1.5rem" }}>
          <strong>Static worked example (JavaScript disabled):</strong> Exciting UV light at ν₁ =
          850 THz (hν₁ = 3.515 eV) limits emitted fluorescence to ν₂ ≤ 850 THz. A proposed emission
          at 900 THz (3.722 eV) has a 0.207 eV deficit and is disallowed.
        </p>
      </noscript>
    </article>
  );
}
