"use client";

import { useCallback, useId, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import {
  AUTHORED_BROWNIAN_DISPLACEMENTS,
  calculateSignedDisplacements,
  DOUBLED_BROWNIAN_DISPLACEMENTS,
  describeDisplacementInWords,
  formatSignedDisplacement,
} from "./signedDisplacements.ts";

const PARTICLE_KEYS = ["particle-1", "particle-2", "particle-3", "particle-4"] as const;

export interface BrownianFirstEncounterProps {
  readonly record?: EntranceRecord | undefined;
  readonly initialEntries?: readonly number[] | undefined;
  readonly onNavigateFoundation?: ((foundationId: string) => void) | undefined;
  readonly onNavigateInstrument?: ((instrumentId: string) => void) | undefined;
}

export function BrownianFirstEncounter({
  record,
  initialEntries = AUTHORED_BROWNIAN_DISPLACEMENTS,
  onNavigateFoundation,
  onNavigateInstrument,
}: BrownianFirstEncounterProps) {
  const [entries, setEntries] = useState<readonly number[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<"visual" | "table">("visual");
  const [showWhySquare, setShowWhySquare] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const liveRegionId = useId();
  const totals = calculateSignedDisplacements(entries);
  const isAuthored =
    entries.length === 4 &&
    entries[0] === -3 &&
    entries[1] === -1 &&
    entries[2] === 1 &&
    entries[3] === 3;

  const isDoubled =
    entries.length === 4 &&
    entries[0] === -6 &&
    entries[1] === -2 &&
    entries[2] === 2 &&
    entries[3] === 6;

  const updateEntry = useCallback((index: number, nextVal: number) => {
    const clamped = Math.max(-10, Math.min(10, Math.round(nextVal)));
    setEntries((prev) => {
      const next = [...prev];
      next[index] = clamped;
      const newTotals = calculateSignedDisplacements(next);
      setLiveAnnouncement(
        `Particle ${index + 1} set to ${formatSignedDisplacement(clamped)} units. Signed sum: ${newTotals.signedSum}, mean absolute: ${newTotals.meanAbsolute}, mean square: ${newTotals.meanSquare}, RMS: ${newTotals.rootMeanSquare.toFixed(3)}.`,
      );
      return Object.freeze(next);
    });
  }, []);

  const resetToAuthored = useCallback(() => {
    setEntries(AUTHORED_BROWNIAN_DISPLACEMENTS);
    const t = calculateSignedDisplacements(AUTHORED_BROWNIAN_DISPLACEMENTS);
    setLiveAnnouncement(
      `Restored authored example: -3, -1, +1, +3 units. Signed sum: ${t.signedSum}, mean absolute: ${t.meanAbsolute}, mean square: ${t.meanSquare}.`,
    );
  }, []);

  const setToDoubled = useCallback(() => {
    setEntries(DOUBLED_BROWNIAN_DISPLACEMENTS);
    const t = calculateSignedDisplacements(DOUBLED_BROWNIAN_DISPLACEMENTS);
    setLiveAnnouncement(
      `Set to doubled displacements: -6, -2, +2, +6 units. Signed sum: ${t.signedSum}, mean absolute: ${t.meanAbsolute}, mean square: ${t.meanSquare}.`,
    );
  }, []);

  const particleItems = PARTICLE_KEYS.map((key, idx) => ({
    key,
    index: idx,
    position: entries[idx] ?? 0,
  }));

  return (
    <div
      id="entry-brownian-motion"
      data-encounter-id="entrance-brownian-motion"
      data-paper="brownian-motion"
      className="entrance-container bg-surface border border-border/70 rounded-xl p-6 sm:p-8 max-w-4xl mx-auto my-8 shadow-sm"
    >
      {/* Header */}
      <header className="mb-6 border-b border-border/50 pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
          First Encounter · Zero Algebra Entrance
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif text-foreground font-semibold">
          {record?.question ?? "Do particles that wander in all directions ever get anywhere?"}
        </h2>
        <p className="text-base text-muted-foreground mt-2 leading-relaxed font-serif">
          {record?.story ??
            "Imagine placing a microscopic particle in a drop of water and marking where it is after a few moments. Pushed at random by invisible water molecules, it is just as likely to move left as right. Adding signed steps gives zero, yet every particle has moved."}
        </p>
      </header>

      {/* Screen Reader Live Region */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Authored notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5 mb-6 text-sm text-foreground/90 flex items-center justify-between flex-wrap gap-2">
        <span>
          <strong className="font-medium text-amber-700 dark:text-amber-400">
            Authored arithmetic examples:
          </strong>{" "}
          Displacements of −3, −1, +1, and +3 units (three steps left, one left, one right, three
          right). These are an authored educational case, not a measured dataset.
        </span>
        <div className="flex gap-2">
          {!isAuthored && (
            <button
              type="button"
              onClick={resetToAuthored}
              className="text-xs px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-900 dark:text-amber-200 rounded border border-amber-500/40 font-medium transition-colors"
            >
              Back to authored example
            </button>
          )}
          {!isDoubled && (
            <button
              type="button"
              onClick={setToDoubled}
              className="text-xs px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded border border-primary/30 font-medium transition-colors"
            >
              Show doubled example (−6, −2, +2, +6)
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-between items-center mb-4 border-b border-border/40 pb-2">
        <h3 className="text-lg font-serif font-medium text-foreground">
          Step 1 · Explore the particle displacements
        </h3>
        <fieldset
          className="inline-flex rounded-md shadow-sm border-0 p-0 m-0"
          aria-label="Interaction mode"
        >
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`px-3 py-1 text-xs font-medium rounded-l-lg border transition-colors ${
              activeTab === "visual"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            Visual Number Line
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1 text-xs font-medium rounded-r-lg border border-l-0 transition-colors ${
              activeTab === "table"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            Table & Numeric Inputs
          </button>
        </fieldset>
      </div>

      {/* Interactive Display */}
      {activeTab === "visual" ? (
        <div className="p-4 bg-muted/20 border border-border/60 rounded-xl mb-6">
          <p className="text-xs text-muted-foreground mb-3">
            Drag a marker or select it and use{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-[11px]">
              ←
            </kbd>{" "}
            /{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-[11px]">
              →
            </kbd>{" "}
            arrow keys to shift its position.
          </p>

          {/* Number line visualization */}
          <div className="relative py-8 px-4 select-none">
            {/* Horizontal axis */}
            <div className="h-1 bg-border/80 w-full relative top-4 rounded-full" />

            {/* Zero origin tick */}
            <div className="absolute left-1/2 top-1 -translate-x-1/2 flex flex-col items-center">
              <div className="w-0.5 h-7 bg-foreground/60" />
              <span className="text-xs font-mono font-semibold text-foreground/80 mt-1">
                0 (start)
              </span>
            </div>

            {/* Scale ticks from -8 to +8 */}
            {[-8, -6, -4, -2, 2, 4, 6, 8].map((val) => {
              const leftPercent = ((val + 8) / 16) * 100;
              return (
                <div
                  key={`tick-${val}`}
                  className="absolute top-2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                  style={{ left: `${leftPercent}%` }}
                >
                  <div className="w-px h-5 bg-border" />
                  <span className="text-[10px] font-mono text-muted-foreground mt-2">{val}</span>
                </div>
              );
            })}

            {/* Interactive Particle Markers */}
            <div className="relative h-12">
              {particleItems.map((item) => {
                const pos = item.position;
                const idx = item.index;
                const leftPercent = Math.max(0, Math.min(100, ((pos + 8) / 16) * 100));
                const colors = [
                  "bg-blue-600 border-blue-400 text-white",
                  "bg-indigo-600 border-indigo-400 text-white",
                  "bg-amber-600 border-amber-400 text-white",
                  "bg-rose-600 border-rose-400 text-white",
                ];
                const color = colors[idx % colors.length];

                return (
                  <div
                    key={item.key}
                    tabIndex={0}
                    role="slider"
                    aria-label={`Particle ${idx + 1} displacement: ${formatSignedDisplacement(pos)} units`}
                    aria-valuenow={pos}
                    aria-valuemin={-8}
                    aria-valuemax={8}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        updateEntry(idx, pos - 1);
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        updateEntry(idx, pos + 1);
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        updateEntry(idx, -8);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        updateEntry(idx, 8);
                      }
                    }}
                    className={`absolute -translate-x-1/2 top-0 cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full w-8 h-8 flex items-center justify-center font-mono text-xs font-bold shadow-md border-2 ${color} transition-transform active:scale-110`}
                    style={{ left: `${leftPercent}%` }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-border/40">
            {particleItems.map((item) => (
              <div
                key={item.key}
                className="text-center p-2 rounded bg-background/60 border border-border/40"
              >
                <span className="text-[11px] text-muted-foreground block">
                  Particle {item.index + 1}
                </span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {formatSignedDisplacement(item.position)}{" "}
                  <span className="text-xs font-normal">units</span>
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  ({describeDisplacementInWords(item.position)})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-sm border-collapse border border-border rounded-lg">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th scope="col" className="p-2.5 font-serif font-medium text-foreground">
                  Particle
                </th>
                <th scope="col" className="p-2.5 font-serif font-medium text-foreground">
                  Word Description
                </th>
                <th
                  scope="col"
                  className="p-2.5 font-serif font-medium text-foreground text-center"
                >
                  Displacement (x)
                </th>
                <th
                  scope="col"
                  className="p-2.5 font-serif font-medium text-foreground text-center"
                >
                  Absolute (|x|)
                </th>
                <th
                  scope="col"
                  className="p-2.5 font-serif font-medium text-foreground text-center"
                >
                  Squared (x²)
                </th>
              </tr>
            </thead>
            <tbody>
              {particleItems.map((item) => {
                const val = item.position;
                const i = item.index;
                return (
                  <tr key={item.key} className="border-b border-border/60 hover:bg-muted/10">
                    <td className="p-2.5 font-mono text-xs text-muted-foreground">
                      Particle {i + 1}
                    </td>
                    <td className="p-2.5 text-xs text-foreground">
                      {describeDisplacementInWords(val)}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Decrease Particle ${i + 1} displacement`}
                          onClick={() => updateEntry(i, val - 1)}
                          className="w-6 h-6 rounded bg-muted hover:bg-muted/80 text-foreground font-mono text-xs flex items-center justify-center border border-border"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          aria-label={`Particle ${i + 1} displacement value`}
                          value={val}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!Number.isNaN(n)) updateEntry(i, n);
                          }}
                          className="w-14 text-center font-mono text-sm py-0.5 px-1 bg-background border border-border rounded text-foreground"
                        />
                        <button
                          type="button"
                          aria-label={`Increase Particle ${i + 1} displacement`}
                          onClick={() => updateEntry(i, val + 1)}
                          className="w-6 h-6 rounded bg-muted hover:bg-muted/80 text-foreground font-mono text-xs flex items-center justify-center border border-border"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-mono text-xs text-foreground font-medium">
                      {Math.abs(val)} units
                    </td>
                    <td className="p-2.5 text-center font-mono text-xs text-foreground font-medium">
                      {val * val} sq units
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals & Arithmetic Engine Output */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-4 rounded-xl border border-border mb-6">
        <div className="p-3 bg-background rounded-lg border border-border/60">
          <span className="text-[11px] text-muted-foreground block font-mono">
            Signed Total (Sum)
          </span>
          <span
            data-testid="totals-signed-sum"
            className="text-lg font-mono font-bold text-foreground block mt-0.5"
          >
            {formatSignedDisplacement(totals.signedSum)}{" "}
            <span className="text-xs font-normal text-muted-foreground">units</span>
          </span>
          <span className="text-[11px] text-muted-foreground block mt-1">
            Mean: {totals.meanSigned.toFixed(1)} units
          </span>
        </div>

        <div className="p-3 bg-background rounded-lg border border-border/60">
          <span className="text-[11px] text-muted-foreground block font-mono">
            Mean Absolute (|x|)
          </span>
          <span
            data-testid="totals-mean-absolute"
            className="text-lg font-mono font-bold text-primary block mt-0.5"
          >
            {totals.meanAbsolute.toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">units</span>
          </span>
          <span className="text-[11px] text-muted-foreground block mt-1">
            Proposal A (ignore sign)
          </span>
        </div>

        <div className="p-3 bg-background rounded-lg border border-border/60">
          <span className="text-[11px] text-muted-foreground block font-mono">
            Mean Square (x²)
          </span>
          <span
            data-testid="totals-mean-square"
            className="text-lg font-mono font-bold text-primary block mt-0.5"
          >
            {totals.meanSquare.toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">sq units</span>
          </span>
          <span className="text-[11px] text-muted-foreground block mt-1">
            Proposal B (square first)
          </span>
        </div>

        <div className="p-3 bg-background rounded-lg border border-border/60">
          <span className="text-[11px] text-muted-foreground block font-mono">
            Root Mean Square (RMS)
          </span>
          <span
            data-testid="totals-rms"
            className="text-lg font-mono font-bold text-foreground block mt-0.5"
          >
            {totals.rootMeanSquare.toFixed(3)}{" "}
            <span className="text-xs font-normal text-muted-foreground">units</span>
          </span>
          <span className="text-[11px] text-muted-foreground block mt-1">√(Mean Square)</span>
        </div>
      </div>

      {/* Ten-step narrative guidance */}
      <div className="space-y-6 text-sm text-foreground/90 font-serif leading-relaxed border-t border-border/50 pt-6">
        <section className="space-y-2">
          <h4 className="text-base font-semibold text-foreground font-sans">
            Step 2 & 3 · Why the signed sum gives zero
          </h4>
          <p>When we add the displacements algebraically, opposite directions cancel out:</p>
          <div className="bg-background/80 p-3 rounded-lg border border-border font-mono text-xs text-center">
            {entries.map((x) => `(${formatSignedDisplacement(x)})`).join(" + ")} ={" "}
            <strong>{formatSignedDisplacement(totals.signedSum)} units</strong>
          </div>
          <p>
            A signed total of zero only tells us that the <em>centre of mass</em> of the ensemble
            has not drifted. It does not mean the particles remained at rest! Every single particle
            moved away from the starting point.
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="text-base font-semibold text-foreground font-sans">
            Step 4 & 5 · Two sensible proposals to keep information about distance
          </h4>
          <p>
            How do we keep track of how far particles wandered without opposite directions
            cancelling out? Both of the following proposals are completely sensible:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Proposal A (Ignore the direction):</strong> Take the absolute value of each
              displacement. For our authored example (−3, −1, +1, +3), the absolute values are 3, 1,
              1, 3 units, giving a mean absolute displacement of <strong>2 units</strong>.
            </li>
            <li>
              <strong>Proposal B (Square each displacement):</strong> Multiplying any negative
              number by itself produces a positive number. The squared displacements are 9, 1, 1, 9
              squared units, giving a mean square displacement of <strong>5 squared units</strong>{" "}
              (and an RMS distance of √5 ≈ <strong>2.236 units</strong>).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h4 className="text-base font-semibold text-foreground font-sans">
            Step 6 & 7 · Scaling: What happens when displacements double?
          </h4>
          <p>
            Suppose after a longer interval every particle has wandered twice as far (−6, −2, +2, +6
            units):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-border text-xs font-mono">
            <div>
              <span className="text-muted-foreground block">Mean Absolute Displacement:</span>
              <strong>(|-6| + |-2| + |+2| + |+6|) / 4 = 4 units</strong> (doubles from 2)
            </div>
            <div>
              <span className="text-muted-foreground block">Mean Square Displacement:</span>
              <strong>(36 + 4 + 4 + 36) / 4 = 20 sq units</strong> (quadruples from 5)
            </div>
          </div>
          <p>
            Notice that when displacement distances double, the mean square quadruples (2² = 4 times
            larger), and its square root (RMS = √20 ≈ 4.472 units) doubles exactly in proportion to
            distance.
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="text-base font-semibold text-foreground font-sans">
            Step 8 · Why Einstein’s derivation favored the mean square
          </h4>
          <p>
            If both proposals measure spread, why did Einstein base his entire 1905 Brownian motion
            paper on the <em>mean square</em>?
          </p>
          <p>
            Under the physical principle that successive molecular kicks are{" "}
            <strong>independent</strong> and have <strong>zero average bias</strong>, the square of
            a sum of many steps expands with cross terms:
          </p>
          <div className="bg-background/80 p-3 rounded-lg border border-border font-mono text-xs text-center">
            (x₁ + x₂)² = x₁² + x₂² + 2·x₁·x₂
          </div>
          <p>
            When we average over many particles, the cross terms (2·x₁·x₂) vanish because positive
            and negative kicks are uncorrelated (average to zero). This leaves only the sum of
            squares: the total mean square displacement is simply the sum of the individual mean
            squares, growing in direct proportion to time: <strong>⟨x²⟩ = 2 D t</strong>.
          </p>
          <p>
            Absolute values do not possess this mathematical linearity when steps are added
            together, which makes the square algebraic route uniquely tractable.
          </p>
        </section>

        <section className="space-y-2">
          <h4 className="text-base font-semibold text-foreground font-sans">
            Step 9 · Mean absolute displacement is not a wrong answer
          </h4>
          <p>
            Mean absolute displacement is <strong>not</strong> an incorrect calculation. It answers
            a slightly different question about the average linear distance travelled and, in the
            ideal Gaussian distribution, it scales directly with the square root of time
            (proportional to √(2Dt/π)).
          </p>
        </section>
      </div>

      {/* Collapsible details: Why the square is useful */}
      <div className="my-6 border border-border rounded-xl p-4 bg-muted/10">
        <button
          type="button"
          onClick={() => setShowWhySquare((v) => !v)}
          className="w-full text-left flex justify-between items-center text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>Why the square is useful: a 2-particle algebraic demonstration</span>
          <span className="font-mono text-xs text-muted-foreground">
            {showWhySquare ? "Hide ▲" : "Show ▼"}
          </span>
        </button>
        {showWhySquare && (
          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-foreground/80 space-y-2 font-serif">
            <p>
              Consider two successive independent steps Δx₁ and Δx₂, each equally likely to be +1 or
              −1:
            </p>
            <ul className="list-disc pl-5 font-mono space-y-1">
              <li>Possibility 1: (+1, +1) → Total = +2, Squared = 4</li>
              <li>Possibility 2: (+1, −1) → Total = 0, Squared = 0</li>
              <li>Possibility 3: (−1, +1) → Total = 0, Squared = 0</li>
              <li>Possibility 4: (−1, −1) → Total = −2, Squared = 4</li>
            </ul>
            <p>
              The average total displacement is (2 + 0 + 0 − 2)/4 = <strong>0</strong>. The average
              squared displacement is (4 + 0 + 0 + 4)/4 = <strong>2</strong> (exactly 1² + 1²). The
              cross term (+2, −2, −2, +2) summed to zero!
            </p>
          </div>
        )}
      </div>

      {/* Step 10 · The Bridge */}
      <footer className="border-t-2 border-border pt-6 mt-8">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-2">
          Step 10 · The Bridge to the Argument
        </span>

        {/* 3 required bridge parts */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
          <div>
            <h5 className="text-xs font-mono font-semibold text-primary uppercase tracking-wide">
              New Skill
            </h5>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {record?.bridge?.newSkill ??
                "keeping track of how far things went by squaring, so opposite directions stop cancelling."}
            </p>
          </div>

          <div>
            <h5 className="text-xs font-mono font-semibold text-primary uppercase tracking-wide">
              Why Useful in the Paper
            </h5>
            <p className="text-sm text-foreground/90 mt-0.5">
              {record?.bridge?.whyUsefulHere ??
                "Section 5 says how far a particle typically wanders after a given time, and that statement is about the squared spread, not about a speed."}
            </p>
          </div>

          <div>
            <h5 className="text-xs font-mono font-semibold text-primary uppercase tracking-wide mb-2">
              Continue With Your Choice of Guidance
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* More Guidance Route */}
              <div className="p-3 bg-background rounded-lg border border-border flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-400 block mb-1">
                    More Guidance · Foundations
                  </span>
                  <p className="text-xs text-foreground/80 mb-3">
                    Review mean, variance, and root-mean-square displacement with worked algebraic
                    examples in the Foundations library.
                  </p>
                </div>
                <a
                  href="/foundations/mean-variance-rms"
                  onClick={(e) => {
                    if (onNavigateFoundation) {
                      e.preventDefault();
                      onNavigateFoundation("mean-variance-rms");
                    }
                  }}
                  className="inline-flex items-center justify-center text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded border border-border transition-colors text-center"
                >
                  Open Mean, Variance & RMS Drawer →
                </a>
              </div>

              {/* Less Guidance Route */}
              <div className="p-3 bg-background rounded-lg border border-border flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-400 block mb-1">
                    Less Guidance · Laboratory & Paper
                  </span>
                  <p className="text-xs text-foreground/80 mb-3">
                    Test thousands of particles in the BM-01 tracer ensemble or jump straight to
                    Einstein’s §5 displacement passage.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href="/lab/bm-01"
                    data-instrument-id="bm-01"
                    onClick={(e) => {
                      if (onNavigateInstrument) {
                        e.preventDefault();
                        onNavigateInstrument("bm-01");
                      }
                    }}
                    className="inline-flex items-center justify-center text-xs px-3 py-1.5 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors text-center flex-1"
                  >
                    Open BM-01 Lab →
                  </a>
                  <a
                    href="/papers/brownian-motion/s5/#s5-p1"
                    className="inline-flex items-center justify-center text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded border border-border transition-colors text-center flex-1"
                  >
                    Go to §5 Passage →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Complete No-JavaScript Fallback */}
      <noscript>
        <div className="mt-8 p-4 bg-muted/40 border border-border rounded-xl">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            Static Reference (JavaScript Disabled)
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            With JavaScript disabled, the complete worked arithmetic is presented statically below:
          </p>
          <div className="space-y-3 text-xs font-mono">
            <div className="p-2.5 bg-background rounded border border-border">
              <strong>Authored Example (−3, −1, +1, +3 units):</strong>
              <br />
              Signed sum = (−3) + (−1) + (+1) + (+3) = 0 units.
              <br />
              Mean absolute displacement = (3 + 1 + 1 + 3) / 4 = 2 units.
              <br />
              Mean square displacement = (9 + 1 + 1 + 9) / 4 = 5 sq units.
              <br />
              Root-mean-square displacement (RMS) = √5 ≈ 2.236 units.
            </div>
            <div className="p-2.5 bg-background rounded border border-border">
              <strong>Doubled Example (−6, −2, +2, +6 units):</strong>
              <br />
              Signed sum = (−6) + (−2) + (+2) + (+6) = 0 units.
              <br />
              Mean absolute displacement = (6 + 2 + 2 + 6) / 4 = 4 units.
              <br />
              Mean square displacement = (36 + 4 + 4 + 36) / 4 = 20 sq units.
              <br />
              Root-mean-square displacement (RMS) = √20 ≈ 4.472 units.
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex gap-4 text-xs font-medium">
            <a href="/foundations/mean-variance-rms" className="text-primary hover:underline">
              Open Foundations: Mean, Variance & RMS →
            </a>
            <a href="/lab/bm-01" className="text-primary hover:underline">
              Open BM-01 Tracer Laboratory →
            </a>
            <a href="/papers/brownian-motion/s5/#s5-p1" className="text-primary hover:underline">
              Go to §5 Displacement Passage →
            </a>
          </div>
        </div>
      </noscript>
    </div>
  );
}
