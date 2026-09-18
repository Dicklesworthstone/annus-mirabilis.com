/**
 * PartitionControl Primitive (radiation-entropy family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Resize the constrained-state volume / partition slider.
 * Equivalent: Enter a ratio or choose half (0.5), same (1.0), double (2.0), with fixed energy and band stated.
 * Default Command Class: setup-change.
 */

import { type CSSProperties, useId, useState } from "react";
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

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

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
      className={className ? className.trim() : undefined}
      data-interaction-family="radiation-entropy"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div style={srOnlyStyle} aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Volume Partition Slider */}
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
            flexWrap: "wrap",
            gap: "0.25rem",
          }}
        >
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Constrained Subvolume Partition
          </h4>
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              padding: "0.125rem 0.5rem",
              borderRadius: "0.25rem",
              color: "var(--ink)",
            }}
          >
            V/V₀ = {ratio.toFixed(2)}
          </span>
        </div>

        {/* Fixed Quantities Banner */}
        <div
          style={{
            fontSize: "0.75rem",
            marginBottom: "0.75rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            padding: "0.5rem",
            borderRadius: "0.25rem",
            color: "var(--ink)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>Fixed quantities:</span> Energy{" "}
          <code
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: "bold",
              color: "var(--ink)",
            }}
          >
            {fixedEnergy}
          </code>
          , Frequency band{" "}
          <code
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: "bold",
              color: "var(--ink)",
            }}
          >
            {fixedFrequencyBand}
          </code>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor={`${compId}-slider`} style={srOnlyStyle}>
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
            style={{
              width: "100%",
              accentColor: "var(--accent)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          />
        </div>

        {/* Accessible Equivalent Ratio Presets & Direct Typed Entry */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--line)",
            fontSize: "0.75rem",
          }}
        >
          <span className="fine" style={{ fontWeight: 500 }}>
            Presets:
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(0.5)}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Half (0.5×)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(1.0)}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Same (1.0×)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateRatio(2.0)}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Double (2.0×)
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              marginLeft: "auto",
              fontSize: "0.75rem",
            }}
          >
            <label htmlFor={`${compId}-input`} className="fine">
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
              style={{
                width: "4rem",
                padding: "0.25rem 0.5rem",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                textAlign: "right",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.75rem",
                background: "var(--panel)",
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {errorNotice && (
          <div
            role="alert"
            style={{
              marginTop: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--accent)",
              fontWeight: 500,
            }}
          >
            {errorNotice}
          </div>
        )}

        {entropyChange !== undefined && (
          <div
            data-testid="entropy-change-output"
            style={{
              marginTop: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--ink)",
              fontWeight: 500,
            }}
          >
            Entropy Difference ΔS:{" "}
            <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{entropyChange}</span>
          </div>
        )}
      </div>
    </div>
  );
}
