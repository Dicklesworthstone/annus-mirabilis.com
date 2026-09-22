import type { ReactElement, ReactNode } from "react";
import type { OutputStatus } from "../../experiments/results/types.ts";
import "./visuals.css";

export interface ResultStatusPresentationProps {
  readonly status: OutputStatus;
  readonly message?: string | undefined;
  readonly children?: ReactNode;
}

/**
 * Result status presentation wrapper (am-inst-2d-view-kit-u75r).
 * Renders non-breaking reader-facing notices when a result is outside domain,
 * divergent, underdetermined, or not applicable.
 */
const STATUS_CLASS_MAP: Record<OutputStatus, string> = {
  value: "status-value",
  "analytic-limit": "status-analytic-limit",
  symbolic: "status-symbolic",
  "outside-domain": "status-outside-domain",
  divergent: "status-divergent",
  underdetermined: "status-underdetermined",
  "not-applicable": "status-not-applicable",
};

export function ResultStatusPresentation({
  status,
  message,
  children,
}: ResultStatusPresentationProps): ReactElement {
  if (status === "value" || status === "analytic-limit" || status === "symbolic") {
    return <>{children}</>;
  }

  let title = "Result unavailable";
  let explanation = message ?? "This calculation is outside the currently computable domain.";

  if (status === "outside-domain") {
    title = "Outside physical or model domain";
    explanation =
      message ??
      "The requested parameter values are outside the domain of validity for this model.";
  } else if (status === "divergent") {
    title = "Model prediction diverges";
    explanation = message ?? "The model predicts no finite total over this range.";
  } else if (status === "underdetermined") {
    title = "Observations underdetermined";
    explanation = message ?? "These observations do not select a unique value.";
  } else if (status === "not-applicable") {
    title = "Quantity not applicable";
    explanation = message ?? "This quantity is not defined for this configuration.";
  }

  return (
    <div
      className={`result-status-notice ${STATUS_CLASS_MAP[status] ?? "status-outside-domain"}`}
      role="alert"
      data-result-status={status}
    >
      <h5 className="notice-title">{title}</h5>
      <p className="notice-explanation">{explanation}</p>
    </div>
  );
}
