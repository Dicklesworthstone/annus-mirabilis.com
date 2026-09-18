/**
 * Schema-driven Parameter Control Component.
 * Specification: am-inst-parameter-controls-cmj9.
 *
 * Provides synchronized typed entry, sliders, and step buttons for:
 * - Linear numeric fields
 * - Logarithmic numeric fields
 * - Grid-stepped fields with dependent grid step resolution
 * - Enumerated/select fields
 * - Derived read-only values
 * - 64-bit decimal seeds
 */

import type React from "react";
import { useEffect, useId, useState } from "react";
import { validateDomain } from "./domain.ts";
import {
  formatParameterValue,
  parseParameterValue,
  toCanonicalValue,
  toDisplayUnitValue,
} from "./parse.ts";
import { generateSeed } from "./seed.ts";
import type { ParameterControlProps } from "./types.ts";

export function ParameterControl({
  spec,
  value,
  onChange,
  disabled = false,
  dependentGridValue,
  "data-testid": testId,
  acceptedInputRevision,
}: ParameterControlProps) {
  const controlId = useId();
  const inputId = `${controlId}-input`;
  const sliderId = `${controlId}-slider`;
  const explanationId = `${controlId}-explanation`;

  const isSeed =
    spec.quantityId === "seed" ||
    spec.quantityId === "streamSeed" ||
    spec.id === "seed" ||
    (typeof spec.default === "string" && /^[0-9]+$/.test(spec.default));

  const isDerived = spec.role === "derived";
  const isEnumerated =
    Array.isArray(spec.modelDomain.enumerated) && spec.modelDomain.enumerated.length > 0;

  // Local draft text state for typed input
  const [draftText, setDraftText] = useState<string>(() =>
    isSeed ? String(value) : formatParameterValue(spec, value),
  );
  const [errorExplanation, setErrorExplanation] = useState<string | null>(null);
  const [offeredNeighbours, setOfferedNeighbours] = useState<readonly number[]>([]);

  // Synchronize draft text when external value changes
  useEffect(() => {
    if (isSeed) {
      setDraftText(String(value));
      setErrorExplanation(null);
      setOfferedNeighbours([]);
    } else {
      setDraftText(formatParameterValue(spec, value));
      setErrorExplanation(null);
      setOfferedNeighbours([]);
    }
  }, [value, spec, isSeed]);

  // Derived parameter (read-only)
  if (isDerived) {
    const formattedDerived =
      typeof value === "number" ? formatParameterValue(spec, value) : String(value);

    return (
      <div
        className="parameter-control parameter-derived"
        data-parameter-id={spec.id}
        data-command-class={spec.commandClass}
        data-accepted-input-revision={
          acceptedInputRevision !== undefined ? String(acceptedInputRevision) : undefined
        }
        data-testid={testId ?? `control-${spec.id}`}
      >
        <div className="parameter-header">
          <label className="parameter-label" htmlFor={inputId}>
            {spec.label}
          </label>
          <span className="command-class-badge" data-command-class={spec.commandClass}>
            {spec.commandClass}
          </span>
        </div>
        <div className="parameter-description">{spec.accessibleDescription}</div>
        <div className="derived-value-display" data-testid={`derived-${spec.id}`}>
          <input
            id={inputId}
            type="text"
            readOnly
            aria-readonly="true"
            value={formattedDerived}
            className="derived-numeric"
            aria-label={`${spec.accessibleName}: ${formattedDerived} ${spec.displayUnit}`}
          />
          {spec.displayUnit && <span className="derived-unit">{spec.displayUnit}</span>}
          <span className="derived-badge">Derived</span>
        </div>
      </div>
    );
  }

  // Seed parameter (64-bit unsigned integer)
  if (isSeed) {
    const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setDraftText(text);

      const parsed = parseParameterValue(spec, text);
      if (parsed.ok) {
        setErrorExplanation(null);
        setOfferedNeighbours([]);
        onChange?.(parsed.canonicalValue, spec.commandClass);
      } else {
        setErrorExplanation(parsed.explanation);
      }
    };

    const handleRollSeed = () => {
      const newSeed = generateSeed();
      setDraftText(newSeed);
      setErrorExplanation(null);
      setOfferedNeighbours([]);
      onChange?.(newSeed, spec.commandClass);
    };

    const hasError = Boolean(errorExplanation);

    return (
      <div
        className={`parameter-control parameter-seed ${hasError ? "has-error" : ""}`}
        data-parameter-id={spec.id}
        data-command-class={spec.commandClass}
        data-accepted-input-revision={
          acceptedInputRevision !== undefined ? String(acceptedInputRevision) : undefined
        }
        data-testid={testId ?? `control-${spec.id}`}
      >
        <div className="parameter-header">
          <label className="parameter-label" htmlFor={inputId}>
            {spec.label}
          </label>
          <span className="command-class-badge" data-command-class={spec.commandClass}>
            {spec.commandClass}
          </span>
        </div>
        <div className="parameter-description">{spec.accessibleDescription}</div>
        <div className="seed-input-row">
          <input
            id={inputId}
            type="text"
            className="seed-input"
            value={draftText}
            onChange={handleSeedChange}
            disabled={disabled}
            aria-label={spec.accessibleName}
            aria-invalid={hasError}
            aria-describedby={hasError ? explanationId : undefined}
            data-testid={`seed-input-${spec.id}`}
          />
          <button
            type="button"
            className="btn-roll-seed"
            onClick={handleRollSeed}
            disabled={disabled}
            aria-label="Generate fresh random seed"
            data-testid={`seed-roll-${spec.id}`}
          >
            Roll Seed
          </button>
        </div>
        {hasError && (
          <div
            id={explanationId}
            role="alert"
            className="domain-explanation"
            data-testid={`explanation-${spec.id}`}
          >
            {errorExplanation}
          </div>
        )}
      </div>
    );
  }

  // Enumerated parameter (select dropdown)
  if (isEnumerated && spec.modelDomain.enumerated) {
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const numVal = Number(e.target.value);
      const parsed = parseParameterValue(spec, String(numVal));
      if (parsed.ok) {
        setErrorExplanation(null);
        onChange?.(parsed.canonicalValue, spec.commandClass);
      } else {
        setErrorExplanation(parsed.explanation);
      }
    };

    return (
      <div
        className="parameter-control parameter-select"
        data-parameter-id={spec.id}
        data-command-class={spec.commandClass}
        data-accepted-input-revision={
          acceptedInputRevision !== undefined ? String(acceptedInputRevision) : undefined
        }
        data-testid={testId ?? `control-${spec.id}`}
      >
        <div className="parameter-header">
          <label className="parameter-label" htmlFor={inputId}>
            {spec.label}
          </label>
          <span className="command-class-badge" data-command-class={spec.commandClass}>
            {spec.commandClass}
          </span>
        </div>
        <div className="parameter-description">{spec.accessibleDescription}</div>
        <select
          id={inputId}
          className="parameter-dropdown"
          value={typeof value === "number" ? value : Number(value)}
          onChange={handleSelectChange}
          disabled={disabled}
          aria-label={spec.accessibleName}
          data-testid={`select-${spec.id}`}
        >
          {spec.modelDomain.enumerated.map((opt) => (
            <option key={opt} value={opt}>
              {opt} {spec.displayUnit}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Standard numeric parameter (Linear / Log / Step)
  const numValue = typeof value === "number" ? value : Number(value);
  const displayVal = toDisplayUnitValue(spec, numValue);
  const displayMin = toDisplayUnitValue(spec, spec.visualRange.min);
  const displayMax = toDisplayUnitValue(spec, spec.visualRange.max);

  const domainValidation = validateDomain(spec, numValue);
  const isBeyondTrack = domainValidation.isBeyondVisualTrack;

  // Step resolution
  const stepIncrement =
    spec.mapping.kind === "step"
      ? (dependentGridValue ??
        ("size" in spec.mapping && typeof spec.mapping.size === "number"
          ? spec.mapping.size
          : spec.step) ??
        1)
      : (spec.step ?? (displayMax - displayMin) / 100);

  // Handle typed numeric input submit / change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDraftText(text);

    const options =
      dependentGridValue !== undefined ? { gridStepOverride: dependentGridValue } : undefined;
    const parsed = parseParameterValue(spec, text, options);

    if (parsed.ok) {
      setErrorExplanation(null);
      setOfferedNeighbours([]);
      onChange?.(parsed.canonicalValue, spec.commandClass);
    } else {
      setErrorExplanation(parsed.explanation);
      setOfferedNeighbours(parsed.offeredNeighbours ?? []);
    }
  };

  // Handle slider changes
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderNum = Number(e.target.value);
    const canonicalVal = toCanonicalValue(spec, sliderNum);
    const options =
      dependentGridValue !== undefined ? { gridStepOverride: dependentGridValue } : undefined;
    const parsed = parseParameterValue(spec, String(canonicalVal), options);

    if (parsed.ok) {
      setErrorExplanation(null);
      setOfferedNeighbours([]);
      setDraftText(formatParameterValue(spec, parsed.canonicalValue));
      onChange?.(parsed.canonicalValue, spec.commandClass);
    } else {
      setErrorExplanation(parsed.explanation);
      setOfferedNeighbours(parsed.offeredNeighbours ?? []);
    }
  };

  // Step button handlers
  const handleStepDelta = (direction: -1 | 1) => {
    const currentDisp = toDisplayUnitValue(spec, numValue);
    const nextDisp = currentDisp + direction * stepIncrement;
    const nextCanonical = toCanonicalValue(spec, nextDisp);

    const options =
      dependentGridValue !== undefined ? { gridStepOverride: dependentGridValue } : undefined;
    const parsed = parseParameterValue(spec, String(nextCanonical), options);

    if (parsed.ok) {
      setErrorExplanation(null);
      setOfferedNeighbours([]);
      setDraftText(formatParameterValue(spec, parsed.canonicalValue));
      onChange?.(parsed.canonicalValue, spec.commandClass);
    } else {
      setErrorExplanation(parsed.explanation);
      setOfferedNeighbours(parsed.offeredNeighbours ?? []);
    }
  };

  // Apply offered neighbour option
  const handleApplyNeighbour = (neighbour: number) => {
    const options =
      dependentGridValue !== undefined ? { gridStepOverride: dependentGridValue } : undefined;
    const parsed = parseParameterValue(spec, String(neighbour), options);
    if (parsed.ok) {
      setErrorExplanation(null);
      setOfferedNeighbours([]);
      setDraftText(formatParameterValue(spec, parsed.canonicalValue));
      onChange?.(parsed.canonicalValue, spec.commandClass);
    }
  };

  const hasError = Boolean(errorExplanation);
  const showBeyondTrack = isBeyondTrack && !hasError;
  const domainStatus = hasError
    ? "outside"
    : showBeyondTrack
      ? "beyond-track"
      : domainValidation.status;

  return (
    <div
      className={`parameter-control ${hasError ? "has-error" : ""} ${showBeyondTrack ? "beyond-track" : ""}`}
      data-parameter-id={spec.id}
      data-command-class={spec.commandClass}
      data-beyond-track={showBeyondTrack ? "true" : "false"}
      data-domain-status={domainStatus}
      data-accepted-input-revision={
        acceptedInputRevision !== undefined ? String(acceptedInputRevision) : undefined
      }
      data-testid={testId ?? `control-${spec.id}`}
    >
      <div className="parameter-header">
        <label className="parameter-label" htmlFor={inputId}>
          {spec.label}
          {spec.displayUnit && <span className="unit-label"> ({spec.displayUnit})</span>}
        </label>
        <span className="command-class-badge" data-command-class={spec.commandClass}>
          {spec.commandClass}
        </span>
      </div>

      <div className="parameter-description">{spec.accessibleDescription}</div>

      <div className="parameter-interactive-row">
        <button
          type="button"
          className="step-btn step-decrement"
          onClick={() => handleStepDelta(-1)}
          disabled={disabled}
          aria-label={`Decrease ${spec.accessibleName} by ${stepIncrement}`}
          data-testid={`step-dec-${spec.id}`}
        >
          −
        </button>

        <input
          id={sliderId}
          type="range"
          className="parameter-slider"
          min={displayMin}
          max={displayMax}
          step={stepIncrement}
          value={Math.min(Math.max(displayVal, displayMin), displayMax)}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-label={`${spec.accessibleName} slider`}
          data-testid={`slider-${spec.id}`}
        />

        <button
          type="button"
          className="step-btn step-increment"
          onClick={() => handleStepDelta(1)}
          disabled={disabled}
          aria-label={`Increase ${spec.accessibleName} by ${stepIncrement}`}
          data-testid={`step-inc-${spec.id}`}
        >
          +
        </button>

        <input
          id={inputId}
          type="text"
          className="parameter-typed-input"
          value={draftText}
          onChange={handleInputChange}
          disabled={disabled}
          aria-label={spec.accessibleName}
          aria-invalid={hasError}
          aria-describedby={hasError ? explanationId : undefined}
          data-testid={`input-${spec.id}`}
        />
      </div>

      {isBeyondTrack && !hasError && (
        <div className="beyond-track-marker" data-testid={`beyond-track-${spec.id}`}>
          Beyond visual track ({displayVal} {spec.displayUnit})
        </div>
      )}

      {hasError && (
        <div
          id={explanationId}
          role="alert"
          className="domain-explanation"
          data-testid={`explanation-${spec.id}`}
        >
          <div className="explanation-text">{errorExplanation}</div>
          {offeredNeighbours.length > 0 && (
            <div className="offered-neighbours">
              <span>Nearest valid options: </span>
              {offeredNeighbours.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="btn-neighbour-option"
                  onClick={() => handleApplyNeighbour(opt)}
                  data-testid={`neighbour-opt-${opt}`}
                >
                  Set to {opt} {spec.displayUnit}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
