"use client";

import { type FormEvent, useId, useState, useSyncExternalStore } from "react";
import {
  SR12_CAPTION,
  SR12_DEFAULTS,
  SR12_MODEL,
  SR12_NOT_MODELED,
  type Sr12Parameters,
} from "../../../experiments/sr12/definition.ts";
import { validateSr12Parameters } from "../../../experiments/sr12/parameters.ts";
import { createSr12Session, type PreparedSr12Example } from "../../../experiments/sr12/session.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
import { ChargeCurrentPlot } from "./ChargeCurrentPlot.tsx";

const C_SI = 299792458;

function OutputReading({ item }: { item: PublishedResult | undefined }) {
  if (!item) return <span>missing</span>;
  if (item.status === "value") {
    if (typeof item.value === "number") {
      return <span data-quantity-id={item.quantityId}>{display(item.value)}</span>;
    }
    if (item.value instanceof Float64Array) {
      const formatted = Array.from(item.value)
        .map((v) => display(v))
        .join(", ");
      return <span data-quantity-id={item.quantityId}>({formatted})</span>;
    }
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={item.quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={item.quantityId}>{item.status}</span>;
}

export function ChargeCurrentLab({
  example,
  title = "Charge and current density in moving frames",
}: {
  example: PreparedSr12Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr12Session(`sr12-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [draft, setDraft] = useState<Sr12Parameters>(() => ({ ...example.parameters }));
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<string | null>(null);

  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as unknown as Sr12Parameters;

  function apply(parameters: Sr12Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(outcome.refusal.message);
      return;
    }
    setDraft(parameters);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr12Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
      return;
    }
    apply(checked.data);
  }

  const rhoStat = result(snapshot, "chargeDensityStationary");
  const rhoMov = result(snapshot, "chargeDensityMoving");
  const jStat = result(snapshot, "currentDensityStationary");
  const jMov = result(snapshot, "currentDensityMoving");
  const invSI = result(snapshot, "fourCurrentInvariant");
  const gRes = result(snapshot, "lorentzFactor");
  const contStat = result(snapshot, "continuityResidualStationary");
  const contMov = result(snapshot, "continuityResidualMoving");
  const legPos = result(snapshot, "loopLegChargePositive");
  const legNeg = result(snapshot, "loopLegChargeNegative");
  const loopTot = result(snapshot, "loopTotalCharge");
  const sphereStat = result(snapshot, "sphereTotalChargeStationary");
  const sphereMov = result(snapshot, "sphereTotalChargeMoving");

  const presets = [
    {
      id: "sr-12-neutral-conductor-0.6",
      label: "Neutral conductor (0.6c)",
      params: {
        mode: "neutral-conductor" as const,
        chargeDensity: 0,
        currentDensityX: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-convection-0.5c",
      label: "Convection current (0.5c to 0.6c)",
      params: {
        mode: "convection" as const,
        chargeDensity: 1,
        carrierVelocityX: 0.5 * C_SI,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-moving-sphere-0.6c",
      label: "Moving sphere (0.6c)",
      params: {
        mode: "moving-sphere" as const,
        chargeDensity: 1,
        sphereRadius: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-gaussian-pulse-0.5c",
      label: "Gaussian pulse continuity (0.5c)",
      params: {
        mode: "gaussian-pulse" as const,
        pulseAmplitude: 1,
        carrierVelocityX: 0.5 * C_SI,
        pulseWidth: 1,
        boost: 0.6 * C_SI,
      },
    },
    {
      id: "sr-12-current-loop-0.6c",
      label: "Current loop (0.6c)",
      params: {
        mode: "current-loop" as const,
        loopCurrent: 1,
        loopLengthX: 1,
        loopLengthY: 0.5,
        boost: 0.6 * C_SI,
      },
    },
  ];

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-12"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-12 · Special Relativity §9</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR12_MODEL.label}</span>
      </header>

      {/* Presets */}
      <nav aria-label="Presets" className="presets-bar flex flex-wrap gap-2 mb-4">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`btn-preset px-3 py-1.5 text-xs rounded border transition ${
              p.mode === preset.params.mode
                ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                : "bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            onClick={() => apply({ ...p, ...preset.params })}
          >
            {preset.label}
          </button>
        ))}
      </nav>

      {/* Main interactive visualization */}
      <ChargeCurrentPlot
        rhoStationary={rhoStat}
        rhoMoving={rhoMov}
        jStationary={jStat}
        jMoving={jMov}
        lorentzFactor={gRes}
        boostFraction={p.boost / C_SI}
        mode={p.mode}
        loopLegChargePos={legPos}
        loopLegChargeNeg={legNeg}
        loopTotal={loopTot}
        sphereTotalStationary={sphereStat}
        sphereTotalMoving={sphereMov}
      />

      {/* Unit System Explanatory Note */}
      <aside className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            Unit System Modernization
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[11px] ${
                p.unitLayer === "si"
                  ? "bg-zinc-700 text-white font-medium"
                  : "bg-zinc-200 dark:bg-zinc-800"
              }`}
              onClick={() => apply({ ...p, unitLayer: "si" })}
            >
              SI (modern)
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded text-[11px] ${
                p.unitLayer === "gaussian"
                  ? "bg-zinc-700 text-white font-medium"
                  : "bg-zinc-200 dark:bg-zinc-800"
              }`}
              onClick={() => apply({ ...p, unitLayer: "gaussian" })}
            >
              Gaussian 1905 (§9)
            </button>
          </div>
        </div>
        <p>
          Einstein’s 1905 paper employs Gaussian (CGS) units where Coulomb’s constant is 1 and
          Maxwell’s divergence equation contains a 4π factor (∇·E = 4πρ). In modern SI, ∇·E = ρ/ε₀
          where ε₀ = 1/(μ₀c²). Charge and current ratios remain identical across unit systems.
        </p>
      </aside>

      {/* Controls Form */}
      <form onSubmit={submit} className="lab-controls space-y-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Observer Boost Speed (v/c): {(draft.boost / C_SI).toFixed(3)}
            </span>
            <input
              type="range"
              min="-0.95"
              max="0.95"
              step="0.01"
              value={draft.boost / C_SI}
              onChange={(e) => setDraft({ ...draft, boost: parseFloat(e.target.value) * C_SI })}
              className="w-full"
            />
            <input
              type="number"
              min="-284802835"
              max="284802835"
              value={draft.boost}
              onChange={(e) => setDraft({ ...draft, boost: parseFloat(e.target.value) || 0 })}
              className="px-2 py-1 border rounded text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Charge Density ρ (C/m³)
            </span>
            <input
              type="number"
              step="0.1"
              value={draft.chargeDensity}
              onChange={(e) =>
                setDraft({ ...draft, chargeDensity: parseFloat(e.target.value) || 0 })
              }
              className="px-2 py-1 border rounded text-xs"
            />
            <span className="text-[10px] text-zinc-400">Set 0 for neutral conductor</span>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Current Density Jx (A/m²)
            </span>
            <input
              type="number"
              step="0.1"
              value={draft.currentDensityX}
              onChange={(e) =>
                setDraft({ ...draft, currentDensityX: parseFloat(e.target.value) || 0 })
              }
              className="px-2 py-1 border rounded text-xs"
            />
            <span className="text-[10px] text-zinc-400">Conduction current along x</span>
          </label>
        </div>

        {error && (
          <div className="p-2 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 rounded text-xs">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
          >
            Apply parameters
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-xs rounded hover:bg-zinc-300"
            onClick={() => {
              setDraft({ ...SR12_DEFAULTS });
              apply({ ...SR12_DEFAULTS });
            }}
          >
            Reset defaults
          </button>
        </div>
      </form>

      {/* Telemetry Output Table */}
      <div className="telemetry-table overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="p-2">Quantity</th>
              <th className="p-2">Stationary Frame (K)</th>
              <th className="p-2">Moving Frame (k)</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Lorentz Transformation Law</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <tr>
              <td className="p-2 font-medium">Charge Density ρ</td>
              <td className="p-2">
                <OutputReading item={rhoStat} />
              </td>
              <td className="p-2 font-mono text-purple-600 dark:text-purple-400">
                <OutputReading item={rhoMov} />
              </td>
              <td className="p-2 text-zinc-500">C/m³</td>
              <td className="p-2 text-zinc-600 dark:text-zinc-400">ρ&apos; = γ (ρ - vJx/c²)</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Current Density Jx</td>
              <td className="p-2">
                <OutputReading item={jStat} />
              </td>
              <td className="p-2 font-mono">
                <OutputReading item={jMov} />
              </td>
              <td className="p-2 text-zinc-500">A/m²</td>
              <td className="p-2 text-zinc-600 dark:text-zinc-400">J&apos;x = γ (Jx - vρ)</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Lorentz Factor γ</td>
              <td className="p-2" colSpan={2}>
                <OutputReading item={gRes} />
              </td>
              <td className="p-2 text-zinc-500">1</td>
              <td className="p-2 text-zinc-600 dark:text-zinc-400">1 / √(1 - v²/c²)</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Four-Current Invariant (cρ)² - |J|²</td>
              <td className="p-2" colSpan={2}>
                <OutputReading item={invSI} />
              </td>
              <td className="p-2 text-zinc-500">A²/m⁴</td>
              <td className="p-2 text-zinc-600 dark:text-zinc-400">
                Exact scalar invariant across all frames
              </td>
            </tr>
            {p.mode === "current-loop" && (
              <>
                <tr>
                  <td className="p-2 font-medium">Loop Top Leg Charge (+x)</td>
                  <td className="p-2">0 C</td>
                  <td className="p-2 font-mono text-red-500">
                    <OutputReading item={legPos} />
                  </td>
                  <td className="p-2 text-zinc-500">C</td>
                  <td className="p-2 text-zinc-600 dark:text-zinc-400">q&apos;+ = -v I lx / c²</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Loop Bottom Leg Charge (-x)</td>
                  <td className="p-2">0 C</td>
                  <td className="p-2 font-mono text-blue-500">
                    <OutputReading item={legNeg} />
                  </td>
                  <td className="p-2 text-zinc-500">C</td>
                  <td className="p-2 text-zinc-600 dark:text-zinc-400">q&apos;- = +v I lx / c²</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Loop Total Charge</td>
                  <td className="p-2">0 C</td>
                  <td className="p-2 font-mono font-semibold">
                    <OutputReading item={loopTot} />
                  </td>
                  <td className="p-2 text-zinc-500">C</td>
                  <td className="p-2 text-zinc-600 dark:text-zinc-400">
                    Q&apos; = q&apos;+ + q&apos;- = 0 (charge conservation)
                  </td>
                </tr>
              </>
            )}
            {p.mode === "moving-sphere" && (
              <tr>
                <td className="p-2 font-medium">Sphere Total Charge Q</td>
                <td className="p-2">
                  <OutputReading item={sphereStat} />
                </td>
                <td className="p-2 font-mono font-semibold">
                  <OutputReading item={sphereMov} />
                </td>
                <td className="p-2 text-zinc-500">C</td>
                <td className="p-2 text-zinc-600 dark:text-zinc-400">
                  Q&apos; = Q (exact invariance of total charge)
                </td>
              </tr>
            )}
            {p.mode === "gaussian-pulse" && (
              <tr>
                <td className="p-2 font-medium">Continuity Residual ∂ρ/∂t + ∇·J</td>
                <td className="p-2">
                  <OutputReading item={contStat} />
                </td>
                <td className="p-2 font-mono">
                  <OutputReading item={contMov} />
                </td>
                <td className="p-2 text-zinc-500">A/m³</td>
                <td className="p-2 text-zinc-600 dark:text-zinc-400">0 in all inertial frames</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Predict Mode */}
      <section className="predict-mode p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
          Predict: Is a Neutral Wire Still Neutral in a Moving Frame?
        </h4>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          A neutral wire in the laboratory carries a current in the +x direction. Described from a
          frame moving in the +x direction at 0.6c, is the wire still electrically neutral?
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "still-neutral", label: "Still neutral (ρ' = 0)" },
            { id: "negatively-charged", label: "Negatively charged (ρ' < 0)" },
            { id: "positively-charged", label: "Positively charged (ρ' > 0)" },
          ].map((cand) => (
            <button
              key={cand.id}
              type="button"
              className={`px-3 py-1 text-xs rounded border transition ${
                prediction === cand.id
                  ? "bg-amber-700 text-white font-semibold border-amber-800"
                  : "bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              }`}
              onClick={() => setPrediction(cand.id)}
            >
              {cand.label}
            </button>
          ))}
        </div>

        {prediction && (
          <div className="p-3 bg-white dark:bg-zinc-900 rounded border border-amber-200 dark:border-amber-800 text-xs space-y-1">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {prediction === "negatively-charged" ? "✓ Correct!" : "Explanation:"}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Because charge density and current density transform together like a four-vector,
              ρ&apos; = γ(ρ - vJx/c²). When ρ = 0 and Jx &gt; 0 with v &gt; 0, ρ&apos; = -γ v Jx /
              c² &lt; 0. The moving observer describes the wire as carrying a net negative charge
              density. Conversely, an observer moving in the -x direction (v &lt; 0) observes a net
              positive charge density.
            </p>
          </div>
        )}
      </section>

      {/* Editorial Explanations (R0-R3) */}
      <footer className="editorial-captions space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <p>
          <strong>Overview:</strong> {SR12_CAPTION.r0}
        </p>
        <p>
          <strong>Four-Current Invariant:</strong> {SR12_CAPTION.r1}
        </p>
        <p>
          <strong>Current Loops & Total Charge:</strong> {SR12_CAPTION.r2}
        </p>
        <p>
          <strong>Continuity Invariance (§9):</strong> {SR12_CAPTION.r3}
        </p>
        <div className="pt-2 text-[11px] text-zinc-500">
          <strong>Not modeled:</strong> {SR12_NOT_MODELED.join(", ")}.
        </div>
      </footer>
    </section>
  );
}
