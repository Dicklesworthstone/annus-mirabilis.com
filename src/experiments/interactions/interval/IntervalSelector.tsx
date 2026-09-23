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

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

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
      className={className || undefined}
      data-interaction-family="probability-diffusion"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div style={srOnlyStyle} aria-live="polite" role="status">
        {announcement}
      </div>

      <div
        style={{
          padding: "0.75rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <h4
            className="eyebrow"
            style={{
              fontSize: "var(--type-fine)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink)",
            }}
          >
            Observation interval selector
          </h4>
          <span
            style={{
              fontSize: "var(--type-fine)",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              padding: "0.125rem 0.5rem",
              borderRadius: "0.25rem",
              color: "var(--ink)",
            }}
          >
            [{currentMin.toFixed(2)}, {currentMax.toFixed(2)}] {unit}
          </span>
        </div>

        {/* Visual Slider Handles */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <label htmlFor={`${compId}-min-slider`} style={srOnlyStyle}>
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
            style={{
              width: "100%",
              accentColor: "var(--accent)",
            }}
          />
          <label htmlFor={`${compId}-max-slider`} style={srOnlyStyle}>
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
            style={{
              width: "100%",
              accentColor: "var(--accent)",
            }}
          />
        </div>

        {/* Accessible Equivalent Presets & Steppers */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--line)",
            fontSize: "var(--type-fine)",
          }}
        >
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => updateInterval(preset.min, preset.max)}
              className="button"
              style={{
                padding: "0.25rem 0.625rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                color: "var(--ink)",
                fontFamily: "var(--font-mono, monospace)",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              marginLeft: "auto",
            }}
          >
            <label htmlFor={`${compId}-min-input`} style={{ color: "var(--ink)" }}>
              Min:
            </label>
            <input
              id={`${compId}-min-input`}
              type="number"
              value={currentMin}
              step="0.1"
              disabled={disabled}
              onChange={(e) => updateInterval(Number.parseFloat(e.target.value) || 0, currentMax)}
              style={{
                width: "3.5rem",
                padding: "0.125rem 0.375rem",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "var(--type-fine)",
                background: "var(--panel)",
                color: "var(--ink)",
              }}
            />
            <label
              htmlFor={`${compId}-max-input`}
              style={{ color: "var(--ink)", marginLeft: "0.25rem" }}
            >
              Max:
            </label>
            <input
              id={`${compId}-max-input`}
              type="number"
              value={currentMax}
              step="0.1"
              disabled={disabled}
              onChange={(e) => updateInterval(currentMin, Number.parseFloat(e.target.value) || 0)}
              style={{
                width: "3.5rem",
                padding: "0.125rem 0.375rem",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "var(--type-fine)",
                background: "var(--panel)",
                color: "var(--ink)",
              }}
            />
            <span
              style={{
                color: "var(--muted)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
