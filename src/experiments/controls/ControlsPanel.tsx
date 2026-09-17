/**
 * Schema-driven Controls Panel Component.
 * Specification: am-inst-parameter-controls-cmj9.
 *
 * Groups controls into Primary section and "Experiment settings" drawer,
 * resolves dependent grid parameters, and provides explicit Reset semantics.
 */

import { useMemo } from "react";
import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import { ParameterControl } from "./ParameterControl.tsx";
import type { ControlsPanelProps } from "./types.ts";

export function ControlsPanel({
  specs,
  values,
  onChange,
  onReset,
  disabled = false,
  className = "",
  advancedParameterIds = [],
}: ControlsPanelProps) {
  // Categorize parameters into primary vs advanced drawer
  const { primarySpecs, advancedSpecs, gridParamMap } = useMemo(() => {
    const primary: ParameterSpec[] = [];
    const advanced: ParameterSpec[] = [];
    const gridMap = new Map<string, string>();

    const advancedSet = new Set(advancedParameterIds);

    for (const spec of specs) {
      if (
        spec.mapping.kind === "step" &&
        "gridParameterId" in spec.mapping &&
        spec.mapping.gridParameterId
      ) {
        gridMap.set(spec.id, spec.mapping.gridParameterId);
      }

      // Default rules: estimator-change or explicitly listed IDs go to advanced drawer
      if (advancedSet.has(spec.id) || spec.commandClass === "estimator-change") {
        advanced.push(spec);
      } else {
        primary.push(spec);
      }
    }

    return { primarySpecs: primary, advancedSpecs: advanced, gridParamMap: gridMap };
  }, [specs, advancedParameterIds]);

  const getDependentGridValue = (specId: string): number | undefined => {
    const gridTargetId = gridParamMap.get(specId);
    if (!gridTargetId) return undefined;
    const targetVal = values[gridTargetId];
    return typeof targetVal === "number" ? targetVal : undefined;
  };

  return (
    <div className={`controls-panel ${className}`} data-testid="controls-panel">
      {/* Primary Parameters */}
      <div className="primary-controls-group" data-testid="primary-controls-group">
        {primarySpecs.map((spec) => (
          <ParameterControl
            key={spec.id}
            spec={spec}
            value={values[spec.id] ?? spec.default}
            onChange={(val, cmdClass) => onChange(spec.id, val, cmdClass)}
            disabled={disabled}
            dependentGridValue={getDependentGridValue(spec.id)}
            data-testid={`control-${spec.id}`}
          />
        ))}
      </div>

      {/* Advanced Parameters Drawer */}
      {advancedSpecs.length > 0 && (
        <details className="experiment-settings-drawer" data-testid="experiment-settings-drawer">
          <summary className="settings-drawer-summary" data-testid="settings-drawer-summary">
            Experiment settings
          </summary>
          <div className="advanced-controls-group" data-testid="advanced-controls-group">
            {advancedSpecs.map((spec) => (
              <ParameterControl
                key={spec.id}
                spec={spec}
                value={values[spec.id] ?? spec.default}
                onChange={(val, cmdClass) => onChange(spec.id, val, cmdClass)}
                disabled={disabled}
                dependentGridValue={getDependentGridValue(spec.id)}
                data-testid={`control-${spec.id}`}
              />
            ))}
          </div>
        </details>
      )}

      {/* Reset Actions */}
      {onReset && (
        <div className="controls-reset-actions" data-testid="controls-reset-actions">
          <button
            type="button"
            className="btn-reset btn-reset-same-seed"
            onClick={() => onReset({ mode: "same-seed" })}
            disabled={disabled}
            data-testid="btn-reset-same-seed"
            aria-label="Reset parameters while keeping current seed"
          >
            Reset (Same seed)
          </button>
          <button
            type="button"
            className="btn-reset btn-reset-new-trial"
            onClick={() => onReset({ mode: "new-trial" })}
            disabled={disabled}
            data-testid="btn-reset-new-trial"
            aria-label="Reset parameters with new random seed"
          >
            Reset (New trial)
          </button>
        </div>
      )}
    </div>
  );
}
