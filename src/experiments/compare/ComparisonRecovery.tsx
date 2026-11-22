import { failureCode } from "../results/applyFailure.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";
import type { ComparisonRepair, ControlledComparisonState } from "./controlledComparison.ts";
import type { ComparisonContract } from "./singleVariationLock.ts";

export function comparisonCurrency(state: ControlledComparisonState, localError = "") {
  if (state.pending) return "pending";
  if (!localError && state.failure?.kind === "unavailable") return "unavailable";
  return localError || state.error ? "refused" : "current";
}

/** Recovery operates on the rejected request. The two accepted columns remain readable. */
export function ComparisonRecovery({
  state,
  contract,
  localError = "",
  id,
  ready,
  onRepair,
  onRetry,
  onRebuild,
}: {
  state: ControlledComparisonState;
  contract: ComparisonContract;
  localError?: string;
  id: string;
  ready: boolean;
  onRepair(choice: ComparisonRepair): void;
  onRetry(): void;
  onRebuild(): void;
}) {
  const text = localError || state.error;
  if (!text) return null;
  const failure = localError ? null : state.failure;
  const requested = localError ? null : state.rejectedParameters;
  const changes = Object.entries(requested ?? {}).filter(
    ([key, value]) => !Object.is(state.baseline.parameters[key], value),
  );
  return (
    <aside
      id={id}
      className="notice error"
      role="alert"
      data-comparison-recovery
      data-currency-state={comparisonCurrency(state, localError)}
      data-apply-failure={failure?.kind}
      data-refusal-code={failure ? failureCode(failure) : undefined}
      data-execution-outcome={failure?.kind === "unavailable" ? failure.outcome.outcome : undefined}
    >
      <p>{text}</p>
      <p>
        Both columns still show the last completed comparison. The requested settings have not
        replaced either result.
      </p>
      {changes.length > 0 && (
        <dl aria-label="Rejected comparison settings">
          {changes.map(([key, value]) => {
            const field = contract.inputs[key];
            return (
              <div key={key} data-comparison-rejected-input={key}>
                <dt>{field?.label ?? key}</dt>
                <dd>
                  {comparisonDisplay(value, field?.displayFactor ?? 1)} {field?.unit}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {failure?.kind === "refused" && state.repairs.length > 0 && (
        <>
          <p>Suggested next actions for this rejected request:</p>
          <ul>
            {state.repairs.map((choice) => (
              <li key={choice.index}>
                {choice.parameters ? (
                  <button
                    type="button"
                    disabled={!ready || state.pending}
                    data-comparison-repair={choice.index}
                    onClick={() => onRepair(choice)}
                  >
                    {choice.label}
                  </button>
                ) : (
                  <span>{choice.label}</span>
                )}
                {choice.blockedReason && <p className="fine">{choice.blockedReason}</p>}
              </li>
            ))}
          </ul>
          <p className="fine">
            A suggested change is checked by the laboratory again. A recovery action keeps the same
            pinned baseline and may change only one declared input.
          </p>
        </>
      )}
      {failure?.kind === "unavailable" && (
        <div className="actions">
          {failure.outcome.retry === "retry-same-request" && requested && (
            <button type="button" disabled={!ready || state.pending} onClick={onRetry}>
              Retry the same comparison request
            </button>
          )}
          {failure.outcome.retry === "new-run" && (
            <button type="button" disabled={!ready || state.pending} onClick={onRebuild}>
              Rebuild the pinned baseline
            </button>
          )}
          {failure.outcome.retry === "reload" && (
            <p>Reload the page to obtain a compatible calculation engine.</p>
          )}
        </div>
      )}
    </aside>
  );
}
