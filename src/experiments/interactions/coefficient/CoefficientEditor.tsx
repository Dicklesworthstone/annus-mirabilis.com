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
      className={`coefficient-editor ${className}`}
      data-interaction-family="fields-boosts"
      data-testid={testId}
    >
      {/* Live Region for Screen-Reader Announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Component / Arrow Editing Pane */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-800 mb-2">
          Field & Coordinate Transformation Coefficients
        </h4>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${compId}-comp-select`} className="text-xs text-stone-700 font-medium">
              Component:
            </label>
            <select
              id={`${compId}-comp-select`}
              value={activeCompId}
              disabled={disabled}
              onChange={(e) => handleUpdate(e.target.value, val)}
              className="text-xs border border-stone-300 rounded px-2 py-1 bg-white font-mono"
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor={`${compId}-slider`} className="text-xs text-stone-700 font-medium">
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
              className="w-32 accent-amber-600"
            />
            <span className="text-xs font-mono text-stone-900 w-12 text-right">
              {val.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs ml-auto">
            <label htmlFor={`${compId}-text-input`} className="text-stone-700">
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
              className="w-20 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs"
            />
            <span className="text-stone-600 font-mono text-xs">{activeComp?.unit}</span>
          </div>
        </div>

        {/* Transformed Components Readout Table */}
        {transformedValues && Object.keys(transformedValues).length > 0 && (
          <div className="mt-3 pt-2 border-t border-stone-200">
            <h5 className="text-xs font-bold text-stone-800 mb-1">
              Transformed Quantities in Moving Frame
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              {Object.entries(transformedValues).map(([key, value]) => (
                <div key={key} className="bg-white p-1.5 border border-stone-200 rounded">
                  <span className="text-stone-500">{key}: </span>
                  <span className="font-semibold text-stone-900">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
