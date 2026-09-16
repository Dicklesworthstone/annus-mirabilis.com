/**
 * IntervalSelector Primitive (probability-diffusion family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Range scrubber / bracket handles.
 * Equivalent: Step buttons, interval presets, and direct numeric entry with domain bounds.
 * Default Command Class: measurement-change (observation interval), physical-intervention (sampling).
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface IntervalPreset {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

export interface IntervalSelectorInputs {
  readonly min: number;
  readonly max: number;
}

export interface IntervalSelectorProps extends BaseInteractionProps<IntervalSelectorInputs> {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly domainMin?: number | undefined;
  readonly domainMax?: number | undefined;
  readonly unit?: string | undefined;
  readonly presets?: readonly IntervalPreset[] | undefined;
}

export function IntervalSelector({
  instrumentId,
  actionId,
  commandClass = "measurement-change",
  min = 0,
  max = 1,
  domainMin = 0,
  domainMax = 10,
  unit = "s",
  presets = [],
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "interval-selector",
}: IntervalSelectorProps) {
  const compId = useId();
  const [currentMin, setCurrentMin] = useState<number>(min);
  const [currentMax, setCurrentMax] = useState<number>(max);
  const [announcement, setAnnouncement] = useState<string>("");

  const updateInterval = (nextMin: number, nextMax: number) => {
    if (disabled) return;
    const clampedMin = Math.max(domainMin, Math.min(nextMin, nextMax));
    const clampedMax = Math.min(domainMax, Math.max(nextMin, nextMax));
    setCurrentMin(clampedMin);
    setCurrentMax(clampedMax);

    const action: TypedActionPayload<IntervalSelectorInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { min: clampedMin, max: clampedMax },
    };
    onAction(action);
    setAnnouncement(`Interval set to [${clampedMin}, ${clampedMax}] ${unit}`);
  };

  return (
    <div
      className={`interval-selector ${className}`}
      data-interaction-family="probability-diffusion"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      <div className="p-3 bg-stone-50 border border-stone-200 rounded">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
            Observation Interval Selector
          </h4>
          <span className="text-xs font-mono bg-stone-200 px-2 py-0.5 rounded text-stone-900">
            [{currentMin.toFixed(2)}, {currentMax.toFixed(2)}] {unit}
          </span>
        </div>

        {/* Visual Slider Handles */}
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor={`${compId}-min-slider`} className="sr-only">
            Interval min
          </label>
          <input
            id={`${compId}-min-slider`}
            type="range"
            min={domainMin}
            max={domainMax}
            step="0.1"
            value={currentMin}
            disabled={disabled}
            onChange={(e) => updateInterval(Number.parseFloat(e.target.value), currentMax)}
            className="w-full accent-amber-600"
          />
          <label htmlFor={`${compId}-max-slider`} className="sr-only">
            Interval max
          </label>
          <input
            id={`${compId}-max-slider`}
            type="range"
            min={domainMin}
            max={domainMax}
            step="0.1"
            value={currentMax}
            disabled={disabled}
            onChange={(e) => updateInterval(currentMin, Number.parseFloat(e.target.value))}
            className="w-full accent-amber-600"
          />
        </div>

        {/* Accessible Equivalent Presets & Steppers */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200 text-xs">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => updateInterval(preset.min, preset.max)}
              className="px-2.5 py-1 bg-white border border-stone-300 rounded hover:bg-stone-100 font-mono"
            >
              {preset.label}
            </button>
          ))}

          <div className="flex items-center gap-1 ml-auto">
            <label htmlFor={`${compId}-min-input`} className="text-stone-700">
              Min:
            </label>
            <input
              id={`${compId}-min-input`}
              type="number"
              value={currentMin}
              step="0.1"
              disabled={disabled}
              onChange={(e) => updateInterval(Number.parseFloat(e.target.value) || 0, currentMax)}
              className="w-14 px-1.5 py-0.5 border border-stone-300 rounded font-mono text-xs"
            />
            <label htmlFor={`${compId}-max-input`} className="text-stone-700 ml-1">
              Max:
            </label>
            <input
              id={`${compId}-max-input`}
              type="number"
              value={currentMax}
              step="0.1"
              disabled={disabled}
              onChange={(e) => updateInterval(currentMin, Number.parseFloat(e.target.value) || 0)}
              className="w-14 px-1.5 py-0.5 border border-stone-300 rounded font-mono text-xs"
            />
            <span className="text-stone-600 font-mono">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
