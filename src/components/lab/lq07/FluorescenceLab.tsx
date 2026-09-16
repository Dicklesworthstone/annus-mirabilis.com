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
import { identity } from "../presentation.ts";
import { FluorescencePlot } from "./FluorescencePlot.tsx";

export function FluorescenceLab({
  example,
  title = "Fluorescence Energy Budget & Stokes's Rule",
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
      className="laboratory-sheet border border-border/80 rounded-2xl p-6 sm:p-8 bg-surface shadow-sm max-w-4xl mx-auto my-6"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-07"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
    >
      <header className="mb-6 border-b border-border/60 pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
          Light Quanta · §7 Fluorescence &amp; Stokes's Rule
        </span>
        <h2
          id={`${id}-title`}
          className="text-2xl sm:text-3xl font-serif font-bold text-foreground"
        >
          {title}
        </h2>
        <p className="text-base text-muted-foreground mt-2 leading-relaxed font-serif">
          How single-quantum energy conservation hν₁ = hν₂ + E_other explains Stokes's rule (ν₂ ≤
          ν₁) and correctly predicts multi-quantum and thermal deviation conditions.
        </p>
      </header>

      {/* Predict Mode Card 1: Stokes Rule */}
      <section className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold block mb-1">
          Predict Mode · Energy Conservation
        </span>
        <h3 className="text-base sm:text-lg font-serif font-semibold text-foreground mb-2">
          Can fluorescent emission occur at higher frequency than the exciting light (ν₂ &gt; ν₁)
          under single-quantum absorption?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <button
            type="button"
            className={`p-3 text-left text-xs rounded-lg border transition-all ${
              predictAnswer1 === "never"
                ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                : "bg-background border-border hover:bg-muted/60 text-foreground"
            }`}
            onClick={() => setPredictAnswer1("never")}
          >
            <strong>Never</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              hν₂ ≤ hν₁ (Stokes's rule)
            </span>
          </button>
          <button
            type="button"
            className={`p-3 text-left text-xs rounded-lg border transition-all ${
              predictAnswer1 === "intensity"
                ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                : "bg-background border-border hover:bg-muted/60 text-foreground"
            }`}
            onClick={() => setPredictAnswer1("intensity")}
          >
            <strong>With intense light</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              Power per second increases
            </span>
          </button>
          <button
            type="button"
            className={`p-3 text-left text-xs rounded-lg border transition-all ${
              predictAnswer1 === "always"
                ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                : "bg-background border-border hover:bg-muted/60 text-foreground"
            }`}
            onClick={() => setPredictAnswer1("always")}
          >
            <strong>Always possible</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              Medium shifts frequencies freely
            </span>
          </button>
        </div>
        {predictAnswer1 && (
          <div className="mt-3 p-3 bg-background/80 rounded-lg border border-border/60 text-xs leading-relaxed">
            {predictAnswer1 === "never" ? (
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                ✓ Correct! In each elementary process, one quantum of energy hν₁ is absorbed. Since
                energy is conserved (hν₁ = hν₂ + E_other with E_other ≥ 0), the emitted quantum hν₂
                cannot exceed hν₁, so ν₂ ≤ ν₁.
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">
                Notice: In the light-quantum hypothesis, absorption is an elementary process between
                individual quanta. Increasing beam intensity delivers more quanta per second, but
                does not increase the energy of each individual quantum.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Predict Mode Card 2: Weak Light Linearity */}
      <section className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
        <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold block mb-1">
          Predict Mode · Weak-Illumination Linearity
        </span>
        <h3 className="text-base sm:text-lg font-serif font-semibold text-foreground mb-2">
          How does the emission rate behave as the incident light becomes extremely weak?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            className={`p-3 text-left text-xs rounded-lg border transition-all ${
              predictAnswer2 === "linear"
                ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                : "bg-background border-border hover:bg-muted/60 text-foreground"
            }`}
            onClick={() => setPredictAnswer2("linear")}
          >
            <strong>Strictly proportional, zero threshold</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              Ṅ₂ = Y · Ṅ₁ at any power
            </span>
          </button>
          <button
            type="button"
            className={`p-3 text-left text-xs rounded-lg border transition-all ${
              predictAnswer2 === "threshold"
                ? "bg-primary text-primary-foreground border-primary font-medium shadow-sm"
                : "bg-background border-border hover:bg-muted/60 text-foreground"
            }`}
            onClick={() => setPredictAnswer2("threshold")}
          >
            <strong>Stops below an intensity threshold</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              Needs minimum power to trigger
            </span>
          </button>
        </div>
        {predictAnswer2 && (
          <div className="mt-3 p-3 bg-background/80 rounded-lg border border-border/60 text-xs leading-relaxed">
            {predictAnswer2 === "linear" ? (
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                ✓ Correct! Because each absorbed quantum acts independently with probability Y, the
                emitted rate is strictly proportional to absorbed power even down to single photons
                with zero intensity threshold.
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">
                Notice: Wave theories might predict a threshold or time lag for energy accumulation,
                but the light-quantum picture predicts immediate emission proportional to absorbed
                power at any intensity.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <nav aria-label="Presets" className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Presets:</span>
        {(Object.keys(LQ07_PRESETS) as (keyof typeof LQ07_PRESETS)[]).map((key) => (
          <button
            key={key}
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-foreground transition-colors"
            onClick={() => setPreset(key)}
          >
            {LQ07_PRESETS[key]?.label}
          </button>
        ))}
      </nav>

      {/* Main Plot & Visual Ledger */}
      <FluorescencePlot parameters={p} evaluation={evaluation} />

      {/* Interactive Controls Section */}
      <section className="mt-8 border-t border-border/60 pt-6">
        <h3 className="text-lg font-serif font-bold text-foreground mb-4">
          Interactive Energy &amp; Parameter Controls
        </h3>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Incident Frequency nu1 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-nu1`} className="text-xs font-semibold text-foreground">
              Exciting Frequency ν₁ (100 – 3000 THz):
            </label>
            <div className="flex items-center gap-3">
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
                className="w-28 px-3 py-1.5 text-xs font-mono rounded border border-border bg-background"
              />
              <span className="text-xs text-muted-foreground font-mono">THz</span>
              <span className="text-xs text-muted-foreground">
                ({evaluation.budget.e1Ev.toFixed(3)} eV)
              </span>
            </div>
          </div>

          {/* 2. Emitted Frequency nu2 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-nu2`} className="text-xs font-semibold text-foreground">
              Emitted Frequency ν₂ (100 – 3000 THz):
            </label>
            <div className="flex items-center gap-3">
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
                className="w-28 px-3 py-1.5 text-xs font-mono rounded border border-border bg-background"
              />
              <span className="text-xs text-muted-foreground font-mono">THz</span>
              <span className="text-xs text-muted-foreground">
                ({evaluation.budget.e2Ev.toFixed(3)} eV)
              </span>
            </div>
          </div>

          {/* 3. Accounting Regime Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">Accounting Regime:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.regime === "standard-stokes"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setRegime("standard-stokes")}
              >
                Stokes's Rule (§7)
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.regime === "deviation-multi-quantum"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setRegime("deviation-multi-quantum")}
              >
                Deviation Case 1 (k-quanta)
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.regime === "deviation-non-wien"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setRegime("deviation-non-wien")}
              >
                Deviation Case 2 (Wien check)
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.regime === "modern-thermal"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setRegime("modern-thermal")}
              >
                Modern Thermal (Anti-Stokes)
              </button>
            </div>
          </div>

          {/* 4. Regime Specific Parameter */}
          <div className="flex flex-col gap-1.5">
            {p.regime === "deviation-multi-quantum" && (
              <>
                <label htmlFor={`${id}-k`} className="text-xs font-semibold text-foreground">
                  Number of Absorbed Quanta k (1 – 5):
                </label>
                <div className="flex items-center gap-3">
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
                    className="w-24 px-3 py-1.5 text-xs font-mono rounded border border-border bg-background"
                  />
                  <span className="text-xs text-muted-foreground">
                    k = {p.multiQuantumK} absorbed quanta
                  </span>
                </div>
              </>
            )}

            {p.regime === "deviation-non-wien" && (
              <>
                <label htmlFor={`${id}-tsrc`} className="text-xs font-semibold text-foreground">
                  Exciting Source Temperature T_src (K):
                </label>
                <div className="flex items-center gap-3">
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
                    className="w-28 px-3 py-1.5 text-xs font-mono rounded border border-border bg-background"
                  />
                  <span className="text-xs text-muted-foreground font-mono">K</span>
                  {evaluation.budget.wienDeviationExpMinusX !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">
                      (e^-x = {evaluation.budget.wienDeviationExpMinusX.toFixed(4)})
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "modern-thermal" && (
              <>
                <label htmlFor={`${id}-tbody`} className="text-xs font-semibold text-foreground">
                  Body Temperature T_body (K):
                </label>
                <div className="flex items-center gap-3">
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
                    className="w-28 px-3 py-1.5 text-xs font-mono rounded border border-border bg-background"
                  />
                  <span className="text-xs text-muted-foreground font-mono">K</span>
                  {evaluation.budget.thermalExtraEv !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">
                      (+{evaluation.budget.thermalExtraEv.toFixed(3)} eV)
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "standard-stokes" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Available Channels:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`text-xs px-3 py-1 rounded border ${
                      p.channels === "light-plus-heat"
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                    onClick={() => setChannels("light-plus-heat")}
                  >
                    Light + Heat (E_other ≥ 0)
                  </button>
                  <button
                    type="button"
                    className={`text-xs px-3 py-1 rounded border ${
                      p.channels === "light-only"
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                    onClick={() => setChannels("light-only")}
                  >
                    Light Only (E_other = 0)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              Apply parameters
            </button>
            <button
              type="button"
              onClick={share}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted/50 text-foreground transition-colors"
            >
              Copy permalink
            </button>
            {dirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Unapplied parameter edits.
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {linkNote && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            {linkNote}
          </div>
        )}
        {sharedUrl && (
          <div className="mt-3 p-3 bg-muted/40 border border-border/80 rounded-lg text-xs font-mono break-all">
            Copied link: {sharedUrl}
          </div>
        )}
      </section>

      {/* Outputs Table */}
      <section className="mt-8 border-t border-border/60 pt-6">
        <h3 className="text-lg font-serif font-bold text-foreground mb-4">
          Calculated Energy Ledger &amp; Transition Quantities
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border/80 rounded-lg overflow-hidden">
            <thead className="bg-muted/50 border-b border-border text-foreground font-mono uppercase">
              <tr>
                <th className="p-3">Physical Quantity</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Calculated Value</th>
                <th className="p-3">Physical Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="p-3 font-medium">Budget Verdict</td>
                <td className="p-3 font-mono">Verdict</td>
                <td className="p-3 font-mono font-bold">
                  {evaluation.budget.status === "outside-domain" ? (
                    <span className="text-amber-600 dark:text-amber-400">Outside Domain</span>
                  ) : evaluation.budget.allowed ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Allowed</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">Disallowed</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{evaluation.budget.verdictReason}</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Maximum Allowed Frequency</td>
                <td className="p-3 font-mono">ν₂,max</td>
                <td className="p-3 font-mono font-semibold text-primary">
                  {(evaluation.budget.nu2MaxHz / 1e12).toFixed(2)} THz
                </td>
                <td className="p-3 text-muted-foreground">
                  Upper frequency bound for emitted light
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Absorbed Quantum Energy</td>
                <td className="p-3 font-mono">hν₁</td>
                <td className="p-3 font-mono font-semibold">
                  {evaluation.budget.e1Ev.toFixed(4)} eV
                </td>
                <td className="p-3 text-muted-foreground">Energy of one exciting light quantum</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Emitted Quantum Energy</td>
                <td className="p-3 font-mono">hν₂</td>
                <td className="p-3 font-mono font-semibold">
                  {evaluation.budget.e2Ev.toFixed(4)} eV
                </td>
                <td className="p-3 text-muted-foreground">
                  Energy of candidate emitted light quantum
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Non-Optical Dissipation (Heat)</td>
                <td className="p-3 font-mono">E_other</td>
                <td className="p-3 font-mono">
                  {evaluation.budget.allowed
                    ? `${evaluation.budget.eOtherEv.toFixed(4)} eV`
                    : "N/A (Disallowed)"}
                </td>
                <td className="p-3 text-muted-foreground">
                  Energy transferred to thermal modes of medium
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Energy Deficit</td>
                <td className="p-3 font-mono">ΔE</td>
                <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                  {evaluation.budget.energyDeficitEv.toFixed(4)} eV
                </td>
                <td className="p-3 text-muted-foreground">
                  {evaluation.budget.energyDeficitEv > 0
                    ? "Energy required from non-existent source"
                    : "Zero (Conserved)"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Assumptions & Not Modeled */}
      <footer className="mt-8 border-t border-border/60 pt-6 space-y-4">
        <div>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold mb-2">
            Paper Assumptions (§7 as printed)
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {LQ07_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold mb-2">
            What this model leaves out (not modeled)
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {LQ07_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <div className="mt-6 p-4 bg-muted/30 border border-border rounded-lg text-xs">
          <strong>Static Worked Example (JavaScript disabled):</strong> Exciting UV light at ν₁ =
          850 THz (hν₁ = 3.515 eV) limits emitted fluorescence to ν₂ ≤ 850 THz. A proposed emission
          at 900 THz (3.722 eV) has a 0.207 eV deficit and is disallowed.
        </div>
      </noscript>
    </article>
  );
}
