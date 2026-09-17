/**
 * Derivation Step View Component (am-eq-derivation-renderer-9gd7).
 *
 * Renders an individual derivation step with the marked move,
 * detail-level reasons (R0/R1/R2), MathML/KaTeX transforms,
 * approximation text, tool/source links, and the computational disclosure slot.
 */

import { useState } from "react";
import { ruleInWords, stepAccessibleText } from "./a11yText.ts";
import { codeSlotFor } from "./hooks.ts";
import { renderExpressionMarkup } from "./mathRenderer.ts";
import type { DerivationStep } from "./types.ts";

export interface DerivationStepComponentProps {
  readonly step: DerivationStep;
  readonly index: number;
  readonly chainId: string;
  readonly activeDetail?: "0" | "1" | "2" | undefined;
  readonly isLocallyExpanded?: boolean | undefined;
  readonly isFocused?: boolean | undefined;
  readonly isProduction?: boolean | undefined;
  readonly onToggleLocalExpand?: () => void;
  readonly onStepFocus?: () => void;
}

export function DerivationStepComponent({
  step,
  index,
  chainId,
  activeDetail = "1",
  isLocallyExpanded = false,
  isFocused = false,
  isProduction = true,
  onToggleLocalExpand,
  onStepFocus,
}: DerivationStepComponentProps) {
  const [activeTab, setActiveTab] = useState<"words" | "math" | "impl">("words");

  const highlightSet = new Set(step.changedSubexpressionIds);
  const fromMarkup = renderExpressionMarkup(step.from, highlightSet);
  const toMarkup = renderExpressionMarkup(step.to, highlightSet);

  const isComputational = step.rule.kind === "evaluate-numerical-instance";
  const codeSlot = codeSlotFor(chainId);
  const a11yLabel = stepAccessibleText(step, index);

  return (
    <li
      id={step.id}
      data-step-id={step.id}
      data-is-move={step.isMove ? "true" : undefined}
      className={`derivation-step ${step.isMove ? "is-move" : ""} ${isFocused ? "is-focused" : ""}`}
      tabIndex={-1}
      onFocus={onStepFocus}
      aria-label={a11yLabel}
    >
      {/* Unverified Marker in Preview Builds */}
      {step.verification.status === "authored-unverified" && !isProduction && (
        <div className="unverified-marker" data-unverified="true">
          Step not yet verified
        </div>
      )}

      {/* The Marked Move Box */}
      {step.isMove && (
        <aside
          className="the-move-box"
          aria-label={`The move: ${step.moveLabel ?? "Key non-obvious step"}`}
        >
          <strong>The move:</strong>
          <span>{step.moveLabel}</span>
        </aside>
      )}

      {/* Step Header */}
      <div className="step-header">
        <span className="step-number">Step {index + 1}</span>
        <span className="step-rule" data-rule={step.rule.kind}>
          {ruleInWords(step.rule.kind)}
        </span>
      </div>

      {/* Math Transformation (Before & After) */}
      <div className="step-math-comparison">
        <section
          className="step-math step-from"
          data-highlight-ids={step.changedSubexpressionIds.join(",")}
          aria-label={`Step ${index + 1} initial mathematical expression`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
          tabIndex={0}
          {...{ dangerouslySetInnerHTML: { __html: fromMarkup.html } }}
        />
        <span className="step-arrow" aria-hidden="true">
          →
        </span>
        <section
          className="step-math step-to"
          data-highlight-ids={step.changedSubexpressionIds.join(",")}
          aria-label={`Step ${index + 1} transformed mathematical expression`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
          tabIndex={0}
          {...{ dangerouslySetInnerHTML: { __html: toMarkup.html } }}
        />
      </div>

      {/* Reasons at Reader's Detail */}
      <div className="step-reasons">
        <p className="step-reason" data-detail="0" hidden={activeDetail !== "0"}>
          {step.reasons.r0}
        </p>
        <p className="step-reason" data-detail="1" hidden={activeDetail !== "1"}>
          {step.reasons.r1}
        </p>
        <p className="step-reason" data-detail="2" hidden={activeDetail !== "2"}>
          {step.reasons.r2}
        </p>
      </div>

      {/* Per-Step Local "Show every step" Expansion */}
      <details className="step-local-steps" open={isLocallyExpanded} onToggle={onToggleLocalExpand}>
        <summary>Show every step here</summary>
        <div className="step-r2-content">{step.reasons.r2}</div>
      </details>

      {/* Approximation Info */}
      {step.approximation && (
        <div className="step-approximation" data-approximation="true">
          <strong>Approximation:</strong> to order {step.approximation.order} in{" "}
          <code>{step.approximation.variable}</code>, valid when{" "}
          <code>{step.approximation.domain}</code>. Neglected: {step.approximation.neglected}.
        </div>
      )}

      {/* Scope Change */}
      {step.scopeChange && (
        <div className="step-scope-change" data-scope-change="true">
          <strong>Scope change:</strong> from{" "}
          <span className="scope-from">{step.scopeChange.from}</span> to{" "}
          <span className="scope-to">{step.scopeChange.to}</span>{" "}
          <a
            href={`#${step.scopeChange.bridgeId}`}
            className="bridge-link"
            data-bridge-id={step.scopeChange.bridgeId}
          >
            [Bridge]
          </a>
        </div>
      )}

      {/* Tool & Source Links */}
      {(step.tool || step.sourceAnchor) && (
        <div className="step-links">
          {step.tool && (
            <a
              href={`/foundations/${step.tool.replace("foundation:", "")}/`}
              className="step-tool-link"
              data-tool-id={step.tool}
              data-open-foundation={step.tool}
            >
              Foundation: {step.tool.replace("foundation:", "")} →
            </a>
          )}
          {step.sourceAnchor && (
            <a
              href={`#${step.sourceAnchor}`}
              className="step-source-link"
              data-source-anchor={step.sourceAnchor}
            >
              Where Einstein does this →
            </a>
          )}
        </div>
      )}

      {/* Computational Justification ("Show the code" 3-tab slot) */}
      {isComputational && (
        <div className="step-disclosure-slot" data-computation-disclosure="true">
          <div className="disclosure-tabs" role="tablist">
            <button
              type="button"
              className="disclosure-tab"
              role="tab"
              aria-selected={activeTab === "words"}
              onClick={() => setActiveTab("words")}
            >
              In words
            </button>
            <button
              type="button"
              className="disclosure-tab"
              role="tab"
              aria-selected={activeTab === "math"}
              onClick={() => setActiveTab("math")}
            >
              Mathematics
            </button>
            <button
              type="button"
              className="disclosure-tab"
              role="tab"
              aria-selected={activeTab === "impl"}
              onClick={() => setActiveTab("impl")}
            >
              Implementation
            </button>
          </div>

          <div className="disclosure-tabpanel" role="tabpanel">
            {activeTab === "words" && <p>{step.reasons.r1}</p>}
            {activeTab === "math" && (
              <div>
                <code>
                  {fromMarkup.plainLatex} → {toMarkup.plainLatex}
                </code>
              </div>
            )}
            {activeTab === "impl" && (
              <div>
                <p>Evaluator reference: {codeSlot ?? "reference-evaluator"}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
