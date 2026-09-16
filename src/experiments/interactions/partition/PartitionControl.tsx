/**
 * PartitionControl Primitive (radiation-entropy family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Resize the constrained-state volume / partition slider.
 * Equivalent: Enter a ratio or choose half (0.5), same (1.0), double (2.0), with fixed energy and band stated.
 * Default Command Class: setup-change.
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface PartitionControlInputs {
  readonly volumeRatio: number;
}

export interface PartitionControlProps extends BaseInteractionProps<PartitionControlInputs> {
  readonly volumeRatio?: number | undefined;
  readonly fixedEnergy?: number | string | undefined;
  readonly fixedFrequencyBand?: string | undefined;
  readonly entropyChange?: number | string | undefined;
  readonly minRatio?: number | undefined;
  readonly maxRatio?: number | undefined;
}

export function PartitionControl({
  instrumentId,
  actionId,
  commandClass = "setup-change",
  volumeRatio = 1.0,
  fixedEnergy = "E",
  fixedFrequencyBand = "Δν",
  entropyChange,
  minRatio = 0.1,
  maxRatio = 10.0,
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "partition-control",
}: PartitionControlProps) {
  const compId = useId();
  const [ratio, setRatio] = useState<number>(volumeRatio);
  const [draftInput, setDraftInput] = useState<string>(volumeRatio.toString());
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const updateRatio = (nextRatio: number) => {
    if (disabled) return;
    if (nextRatio <= 0 || !Number.isFinite(nextRatio)) {
      setErrorNotice("Volume ratio must be a positive finite number (V/V₀ > 0).");
      return;
    }
    if (nextRatio < minRatio || nextRatio > maxRatio) {
      setErrorNotice(
        `Volume ratio must stay within domain [${minRatio}, ${maxRatio}] to preserve the Wien regime.`,
      );
      return;
    }
    setErrorNotice(null);
    setRatio(nextRatio);
    setDraftInput(nextRatio.toString());

    const action: TypedActionPayload<PartitionControlInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { volumeRatio: nextRatio },
    };
    onAction(action);
    setAnnouncement(
      `Volume ratio set to ${nextRatio} (V/V₀). Fixed energy: ${fixedEnergy}, band: ${fixedFrequencyBand}.`,
    );
  };

  return (
    <div
      className={`partition-control ${className}`}
      data-interaction-family="radiation-entropy"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Volume Partition Slider */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
            Constrained Subvolume Partition
          </h4>
          <span className="text-xs font-mono bg-stone-200 px-2 py-0.5 rounded text-stone-900">
            V/V₀ = {ratio.toFixed(2)}
          </span>
        </div>

        {/* Fixed Quantities Banner */}
        <div className="text-xs text-stone-600 mb-3 bg-amber-50 border border-amber-200/60 p-2 rounded">
          <span className="font-semibold text-amber-900">Fixed quantities:</span> Energy{" "}
          <code className="font-mono text-amber-950 font-bold">{fixedEnergy}</code>, Frequency band{" "}
          <code className="font-mono text-amber-950 font-bold">{fixedFrequencyBand}</code>
        </div>

        <div className="mb-3">
          <label htmlFor={`${compId}-slider`} className="sr-only">
            Volume ratio slider
          </label>
          <input
            id={`${compId}-slider`}
            type="range"
            min={minRatio}
            max={maxRatio}
            step="0.05"
            value={ratio}
            disabled={disabled}
            onChange={(e) => updateRatio(Number.parseFloat(e.target.value))}
            className="w-full accent-amber-600"
          />
        </div>

        {/* Accessible Equivalent Ratio Presets & Direct Typed Entry */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200">
          <span className="text-xs text-stone-700 font-medium">Presets:</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(0.5)}
            className="px-2.5 py-1 text-xs font-mono bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Half (0.5×)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(1.0)}
            className="px-2.5 py-1 text-xs font-mono bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Same (1.0×)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(2.0)}
            className="px-2.5 py-1 text-xs font-mono bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Double (2.0×)
          </button>

          <div className="flex items-center gap-1.5 ml-auto text-xs">
            <label htmlFor={`${compId}-input`} className="text-stone-700">
              Type ratio:
            </label>
            <input
              id={`${compId}-input`}
              type="text"
              value={draftInput}
              disabled={disabled}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateRatio(Number.parseFloat(draftInput));
                }
              }}
              onBlur={() => {
                const parsed = Number.parseFloat(draftInput);
                if (!Number.isNaN(parsed)) updateRatio(parsed);
              }}
              className="w-16 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs"
            />
          </div>
        </div>

        {errorNotice && (
          <div className="mt-2 text-xs text-red-700 font-medium" role="alert">
            {errorNotice}
          </div>
        )}

        {entropyChange !== undefined && (
          <div
            className="mt-2 text-xs text-stone-900 font-medium"
            data-testid="entropy-change-output"
          >
            Entropy Difference ΔS: <span className="font-mono">{entropyChange}</span>
          </div>
        )}
      </div>
    </div>
  );
}
