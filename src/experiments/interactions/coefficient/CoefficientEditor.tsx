/**
 * CoefficientEditor Primitive (fields-boosts family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Rotate arrow / drag coefficient handles.
 * Equivalent: Select an axis or component and a signed magnitude, then inspect transformed components at the same event.
 * Default Command Class: observer-change (boost speed), setup-change (field components / candidate map).
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface ComponentOption {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly defaultValue: number;
}

export interface CoefficientEditorInputs {
  readonly selectedComponentId: string;
  readonly magnitude: number;
}

export interface CoefficientEditorProps extends BaseInteractionProps<CoefficientEditorInputs> {
  readonly components: readonly ComponentOption[];
  readonly selectedComponentId?: string | undefined;
  readonly magnitude?: number | undefined;
  readonly transformedValues?: Readonly<Record<string, number | string>> | undefined;
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

export function CoefficientEditor({
  instrumentId,
  actionId,
  commandClass = "observer-change",
  components,
  selectedComponentId,
  magnitude = 0,
  transformedValues,
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "coefficient-editor",
}: CoefficientEditorProps) {
  const compId = useId();
  const defaultComp = components[0]?.id || "v";
  const [activeCompId, setActiveCompId] = useState<string>(selectedComponentId || defaultComp);
  const [val, setVal] = useState<number>(magnitude);
  const [draftText, setDraftText] = useState<string>(magnitude.toString());
  const [announcement, setAnnouncement] = useState<string>("");

  const activeComp = components.find((c) => c.id === activeCompId) || components[0];

  const handleUpdate = (nextCompId: string, nextVal: number) => {
    if (disabled || !Number.isFinite(nextVal)) return;
    setActiveCompId(nextCompId);
    setVal(nextVal);
    setDraftText(nextVal.toString());

    const action: TypedActionPayload<CoefficientEditorInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedComponentId: nextCompId, magnitude: nextVal },
    };
    onAction(action);
    setAnnouncement(
      `Component ${nextCompId} set to ${nextVal} ${activeComp?.unit || ""}. Transformed components updated.`,
    );
  };

  return (
    <div
      className={className || undefined}
      data-interaction-family="fields-boosts"
      data-testid={testId}
    >
      {/* Live Region for Screen-Reader Announcements */}
      <div style={srOnlyStyle} aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Component / Arrow Editing Pane */}
      <div
        style={{
          padding: "0.75rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
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
            marginBottom: "0.5rem",
          }}
        >
          Field and coordinate transformation coefficients
        </h4>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <label htmlFor={`${compId}-comp-select`} className="fine" style={{ fontWeight: 500 }}>
              Component:
            </label>
            <select
              id={`${compId}-comp-select`}
              value={activeCompId}
              disabled={disabled}
              onChange={(e) => handleUpdate(e.target.value, val)}
              style={{
                fontSize: "var(--type-fine)",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                padding: "0.25rem 0.5rem",
                background: "var(--panel)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.unit})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <label htmlFor={`${compId}-slider`} className="fine" style={{ fontWeight: 500 }}>
              Magnitude:
            </label>
            <input
              id={`${compId}-slider`}
              type="range"
              min="-1.0"
              max="1.0"
              step="0.05"
              value={val}
              disabled={disabled}
              onChange={(e) => handleUpdate(activeCompId, Number.parseFloat(e.target.value))}
              style={{
                width: "8rem",
                accentColor: "var(--accent)",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            />
            <span
              style={{
                fontSize: "var(--type-fine)",
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--ink)",
                width: "3rem",
                textAlign: "right",
              }}
            >
              {val.toFixed(2)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "var(--type-fine)",
              marginLeft: "auto",
            }}
          >
            <label htmlFor={`${compId}-text-input`} className="fine">
              Direct entry:
            </label>
            <input
              id={`${compId}-text-input`}
              type="text"
              value={draftText}
              disabled={disabled}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const p = Number.parseFloat(draftText);
                  if (!Number.isNaN(p)) handleUpdate(activeCompId, p);
                }
              }}
              onBlur={() => {
                const p = Number.parseFloat(draftText);
                if (!Number.isNaN(p)) handleUpdate(activeCompId, p);
              }}
              style={{
                width: "5rem",
                padding: "0.25rem 0.5rem",
                border: "1px solid var(--line)",
                borderRadius: "0.25rem",
                textAlign: "right",
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
                fontSize: "var(--type-fine)",
              }}
            >
              {activeComp?.unit}
            </span>
          </div>
        </div>

        {/* Transformed Components Readout Table */}
        {transformedValues && Object.keys(transformedValues).length > 0 && (
          <div
            style={{
              marginTop: "0.75rem",
              paddingTop: "0.5rem",
              borderTop: "1px solid var(--line)",
            }}
          >
            <h5
              style={{
                fontSize: "var(--type-fine)",
                fontWeight: "bold",
                color: "var(--ink)",
                marginBottom: "0.25rem",
              }}
            >
              Transformed quantities in moving frame
            </h5>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
                gap: "0.5rem",
                fontSize: "var(--type-fine)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {Object.entries(transformedValues).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    background: "var(--wash)",
                    padding: "0.375rem",
                    border: "1px solid var(--line)",
                    borderRadius: "0.25rem",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{key}: </span>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
