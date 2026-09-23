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
      className={className || undefined}
      data-interaction-family="derivations"
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
            Derivation chain:{" "}
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent)",
              }}
            >
              {derivationChainId}
            </span>
          </h4>
          <span
            style={{
              fontSize: "var(--type-fine)",
              color: "var(--muted)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            Step {stepIdx + 1} of {subexpressions.length}
          </span>
        </div>

        {/* Visual Term Highlighter / Interactive Badges */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
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
                className="button"
                style={{
                  padding: "0.375rem 0.625rem",
                  borderRadius: "0.25rem",
                  fontSize: "var(--type-fine)",
                  textAlign: "left",
                  cursor: disabled ? "not-allowed" : "pointer",
                  background: isSelected ? "var(--accent)" : "var(--panel)",
                  color: isSelected ? "var(--panel)" : "var(--ink)",
                  fontWeight: isSelected ? 700 : "normal",
                  border: isSelected ? "1px solid var(--accent)" : "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 700,
                    marginRight: "0.25rem",
                  }}
                >
                  {idx + 1}.
                </span>{" "}
                {sub.label}
              </button>
            );
          })}
        </div>

        {/* Accessible Equivalent Subexpression Detail & Role */}
        {activeSub && (
          <div
            style={{
              padding: "0.625rem",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              marginBottom: "0.75rem",
              fontSize: "var(--type-fine)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.25rem",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{activeSub.label}</span>
              {activeSub.derivationRule && (
                <span
                  style={{
                    background: "var(--panel)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "0.25rem",
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "var(--type-fine)",
                    border: "1px solid var(--line)",
                  }}
                >
                  Rule: {activeSub.derivationRule}
                </span>
              )}
            </div>
            <div style={{ color: "var(--muted)", marginBottom: "0.25rem" }}>
              {activeSub.roleDescription}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                background: "var(--panel)",
                padding: "0.375rem",
                borderRadius: "0.25rem",
                color: "var(--ink)",
                fontSize: "var(--type-fine)",
                border: "1px solid var(--line)",
              }}
            >
              {activeSub.expressionLatex}
            </div>
          </div>
        )}

        {/* Action Button to Step Forward */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--line)",
            fontSize: "var(--type-fine)",
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={handleAdvanceStep}
            className="button"
            style={{
              padding: "0.375rem 0.75rem",
              background: "var(--accent)",
              color: "var(--panel)",
              fontWeight: 500,
              borderRadius: "0.25rem",
              cursor: disabled ? "not-allowed" : "pointer",
              border: "1px solid var(--accent)",
            }}
          >
            Advance Justified Step →
          </button>
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
            Command class: {commandClass} (digest invariant preserved)
          </span>
        </div>
      </div>
    </div>
  );
}
