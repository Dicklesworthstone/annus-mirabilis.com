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
      className="laboratory-sheet border border-border/80 rounded-2xl p-6 sm:p-8 bg-surface shadow-sm max-w-4xl mx-auto my-6"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-05"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
    >
      <header className="mb-6 border-b border-border/60 pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
          Light Quanta · §5 Statistical Microstate Counting
        </span>
        <h2
          id={`${id}-title`}
          className="text-2xl sm:text-3xl font-serif font-bold text-foreground"
        >
          {title}
        </h2>
        <p className="text-base text-muted-foreground mt-2 leading-relaxed font-serif">
          How counting independent configurations produces an entropy depending on volume as n ln V,
          and why locking the positions together gives V rather than V^n.
        </p>
      </header>

      {/* Predict Mode Card */}
      <section className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
        <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold block mb-1">
          Predict Mode · Microstate Reasoning
        </span>
        <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
          With 10 independent points, what is the chance that all sit in the left half (f = 1/2)?
        </h3>
        <div className="flex flex-col sm:flex-row gap-3 my-3">
          <button
            type="button"
            className={`px-4 py-2 text-sm rounded-lg border text-left transition-colors ${
              predictAnswer === "1/2"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-background border-border hover:bg-muted/60"
            }`}
            onClick={() => setPredictAnswer("1/2")}
          >
            <strong>A. About 1 in 2</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              One point decides for all
            </span>
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm rounded-lg border text-left transition-colors ${
              predictAnswer === "1/20"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-background border-border hover:bg-muted/60"
            }`}
            onClick={() => setPredictAnswer("1/20")}
          >
            <strong>B. About 1 in 20</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              Linear reduction with n
            </span>
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm rounded-lg border text-left transition-colors ${
              predictAnswer === "1/1000"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-background border-border hover:bg-muted/60"
            }`}
            onClick={() => setPredictAnswer("1/1000")}
          >
            <strong>C. About 1 in 1 000</strong>
            <span className="block text-xs text-muted-foreground mt-1">
              (1/2)¹⁰ = 1/1 024 (Independent product)
            </span>
          </button>
        </div>
        {predictAnswer && (
          <div className="mt-3 p-3 bg-background/80 rounded-lg border border-border/60 text-xs leading-relaxed">
            {predictAnswer === "1/1000" ? (
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                Because the particles move independently, their individual probabilities multiply: W
                = (1/2)¹⁰ = 1/1 024 ≈ 0.0009765.
              </p>
            ) : (
              <p className="text-amber-700 dark:text-amber-400">
                Notice: if the particles are independent, every additional particle halves the
                probability again. 10 independent particles require 10 independent successes, giving
                (1/2)¹⁰ = 1/1 024.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <nav aria-label="Presets" className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Presets:</span>
        {(Object.keys(LQ05_PRESETS) as (keyof typeof LQ05_PRESETS)[]).map((key) => (
          <button
            key={key}
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-foreground transition-colors"
            onClick={() => setPreset(key)}
          >
            {LQ05_PRESETS[key]?.label}
          </button>
        ))}
      </nav>

      {/* Main Plot & Visualization */}
      <IndependentConfigurationsPlot parameters={p} evaluation={evaluation} />

      {/* Controls Section */}
      <section className="mt-8 border-t border-border/60 pt-6">
        <h3 className="text-lg font-serif font-bold text-foreground mb-4">
          Interactive Parameter Controls
        </h3>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Point count n */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-n`} className="text-xs font-semibold text-foreground">
              Number of particles n (1 to 60):
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-n`}
                type="number"
                min="1"
                max="60"
                step="1"
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
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
                className="flex-1"
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-f`} className="text-xs font-semibold text-foreground">
              Subvolume fraction f = V/V₀ (0.01 – 1.0):
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-f`}
                type="number"
                min="0.01"
                max="1.0"
                step="0.01"
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
                value={draft.f}
                onChange={(e) => {
                  setDraft({ ...draft, f: e.target.value });
                  setDirty(true);
                }}
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded border border-border bg-muted/40 hover:bg-muted"
                  onClick={() => setFraction(0.5)}
                >
                  Half (1/2)
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded border border-border bg-muted/40 hover:bg-muted"
                  onClick={() => setFraction(0.25)}
                >
                  Quarter (1/4)
                </button>
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded border border-border bg-muted/40 hover:bg-muted"
                  onClick={() => setFraction(1.0)}
                >
                  Full (1)
                </button>
              </div>
            </div>
          </div>

          {/* 3. View selector & Locked toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">Display View:</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.view === "enumeration"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setViewMode("enumeration")}
              >
                Enumeration
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.view === "sampling"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setViewMode("sampling")}
              >
                Sampling
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  p.view === "logarithmic"
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
                onClick={() => setViewMode("logarithmic")}
              >
                Logarithmic
              </button>
            </div>
          </div>

          {/* 4. Locked positions checkbox */}
          <div className="flex items-center gap-3 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={p.locked}
                onChange={toggleLocked}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-xs font-semibold text-foreground">
                Locked positions counterexample (W = f rather than fⁿ)
              </span>
            </label>
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
          Calculated Microstate & Entropy Outputs
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border/80 rounded-lg overflow-hidden">
            <thead className="bg-muted/50 border-b border-border text-foreground font-mono uppercase">
              <tr>
                <th className="p-3">Physical Quantity</th>
                <th className="p-3">Symbolic Form</th>
                <th className="p-3">Calculated Value</th>
                <th className="p-3">Physical Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="p-3 font-medium">Relative State Probability</td>
                <td className="p-3 font-mono">{p.locked ? "W_locked = f" : "W = (V/V₀)ⁿ = fⁿ"}</td>
                <td className="p-3 font-mono font-bold text-primary">
                  {p.locked
                    ? evaluation.locked.value.toFixed(6)
                    : evaluation.independentProbability.linearRepresentable
                      ? evaluation.independentProbability.value.toExponential(6)
                      : `10^(${evaluation.independentProbability.log10W.toFixed(4)})`}
                </td>
                <td className="p-3 text-muted-foreground">
                  {p.locked
                    ? "Rigid cluster moving as one unit"
                    : "Probability that all n independent points are found in V"}
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Natural Logarithm ln W</td>
                <td className="p-3 font-mono">{p.locked ? "ln f" : "n ln f"}</td>
                <td className="p-3 font-mono font-semibold">
                  {p.locked
                    ? Math.log(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.lnW.toFixed(6)}
                </td>
                <td className="p-3 text-muted-foreground">
                  Proportional to the entropy difference ΔS / k_B
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Dimensionless Entropy Change ΔS/k_B</td>
                <td className="p-3 font-mono">{p.locked ? "ln f" : "n ln(V/V₀)"}</td>
                <td className="p-3 font-mono font-semibold">
                  {p.locked
                    ? Math.log(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.deltaSOverKb.toFixed(6)}
                </td>
                <td className="p-3 text-muted-foreground">
                  Matches Wien-regime radiation entropy S - S₀ = (E / hν) k_B ln(V/V₀)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Base-10 Logarithm log₁₀ W</td>
                <td className="p-3 font-mono">{p.locked ? "log₁₀ f" : "n log₁₀ f"}</td>
                <td className="p-3 font-mono">
                  {p.locked
                    ? Math.log10(evaluation.locked.value).toFixed(6)
                    : evaluation.independentProbability.log10W.toFixed(6)}
                </td>
                <td className="p-3 text-muted-foreground">
                  Order of magnitude (e.g. 10^-18 for n = 60)
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
            Paper Assumptions (§5 as printed)
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {LQ05_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold mb-2">
            What this model leaves out (not modeled)
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {LQ05_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <div className="mt-6 p-4 bg-muted/30 border border-border rounded-lg text-xs">
          <strong>Static Worked Example (JavaScript disabled):</strong> With n = 4 independent
          points in half a volume (f = 0.5), W = (1/2)⁴ = 1/16 = 0.0625. ln W = 4 ln(0.5) ≈ -2.7726.
        </div>
      </noscript>
    </article>
  );
}
