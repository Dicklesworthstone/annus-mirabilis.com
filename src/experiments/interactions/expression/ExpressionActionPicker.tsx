/**
 * ExpressionActionPicker Primitive (derivations family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Clickable equation term highlighting.
 * Equivalent: Select a named subexpression, read its role, and advance a justified step.
 * Default Command Class: presentation-change (explanation step) or estimator-change (inference constraint).
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface SubexpressionOption {
  readonly id: string;
  readonly label: string;
  readonly expressionLatex: string;
  readonly roleDescription: string;
  readonly derivationRule?: string | undefined;
}

export interface ExpressionActionPickerInputs {
  readonly selectedSubexpressionId: string;
  readonly activeStepIndex?: number | undefined;
}

export interface ExpressionActionPickerProps
  extends BaseInteractionProps<ExpressionActionPickerInputs> {
  readonly subexpressions: readonly SubexpressionOption[];
  readonly selectedSubexpressionId?: string | undefined;
  readonly activeStepIndex?: number | undefined;
  readonly derivationChainId?: string | undefined;
}

export function ExpressionActionPicker({
  instrumentId,
  actionId,
  commandClass = "presentation-change",
  subexpressions,
  selectedSubexpressionId,
  activeStepIndex = 0,
  derivationChainId = "me-two-ledgers",
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "expression-action-picker",
}: ExpressionActionPickerProps) {
  const _compId = useId();
  const defaultSub = subexpressions[0]?.id || "";
  const [selectedSubId, setSelectedSubId] = useState<string>(selectedSubexpressionId || defaultSub);
  const [stepIdx, setStepIdx] = useState<number>(activeStepIndex);
  const [announcement, setAnnouncement] = useState<string>("");

  const activeSub = subexpressions.find((s) => s.id === selectedSubId) || subexpressions[0];

  const handleSelectSubexpression = (subId: string) => {
    if (disabled) return;
    setSelectedSubId(subId);
    const sub = subexpressions.find((s) => s.id === subId);
    const action: TypedActionPayload<ExpressionActionPickerInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedSubexpressionId: subId, activeStepIndex: stepIdx },
    };
    onAction(action);
    setAnnouncement(
      `Subexpression selected: ${sub?.label || subId}. Role: ${sub?.roleDescription || ""}`,
    );
  };

  const handleAdvanceStep = () => {
    if (disabled) return;
    const nextIdx = (stepIdx + 1) % subexpressions.length;
    const nextSub = subexpressions[nextIdx];
    if (!nextSub) return;
    setStepIdx(nextIdx);
    setSelectedSubId(nextSub.id);

    const action: TypedActionPayload<ExpressionActionPickerInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedSubexpressionId: nextSub.id, activeStepIndex: nextIdx },
    };
    onAction(action);
    setAnnouncement(
      `Advanced derivation step to ${nextIdx + 1}/${subexpressions.length}: ${nextSub.label}. Rule: ${nextSub.derivationRule || "algebraic reduction"}`,
    );
  };

  return (
    <div
      className={`expression-action-picker ${className}`}
      data-interaction-family="derivations"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      <div className="p-3 bg-stone-50 border border-stone-200 rounded">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-800">
            Derivation Chain: <span className="font-mono text-amber-900">{derivationChainId}</span>
          </h4>
          <span className="text-xs text-stone-500 font-mono">
            Step {stepIdx + 1} of {subexpressions.length}
          </span>
        </div>

        {/* Visual Term Highlighter / Interactive Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {subexpressions.map((sub, idx) => {
            const isSelected = sub.id === selectedSubId;
            return (
              <button
                key={sub.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setStepIdx(idx);
                  handleSelectSubexpression(sub.id);
                }}
                className={`px-2.5 py-1.5 rounded text-xs transition-colors text-left ${
                  isSelected
                    ? "bg-amber-600 text-white font-bold shadow-sm"
                    : "bg-white border border-stone-300 text-stone-800 hover:bg-amber-50"
                }`}
              >
                <span className="font-mono font-bold mr-1">{idx + 1}.</span> {sub.label}
              </button>
            );
          })}
        </div>

        {/* Accessible Equivalent Subexpression Detail & Role */}
        {activeSub && (
          <div className="p-2.5 bg-white border border-stone-200 rounded mb-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-stone-900">{activeSub.label}</span>
              {activeSub.derivationRule && (
                <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-600 font-mono text-xs">
                  Rule: {activeSub.derivationRule}
                </span>
              )}
            </div>
            <div className="text-stone-600 mb-1">{activeSub.roleDescription}</div>
            <div className="font-mono bg-stone-50 p-1.5 rounded text-stone-800 text-xs border border-stone-100">
              {activeSub.expressionLatex}
            </div>
          </div>
        )}

        {/* Action Button to Step Forward */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={handleAdvanceStep}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded transition-colors"
          >
            Advance Justified Step →
          </button>
          <span className="text-stone-500 italic">
            Command class: {commandClass} (digest invariant preserved)
          </span>
        </div>
      </div>
    </div>
  );
}
