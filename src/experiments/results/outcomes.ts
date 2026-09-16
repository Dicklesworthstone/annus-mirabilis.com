import type { JsonValue } from "./refusals.ts";

export type RetryGuidance = "retry-same-request" | "new-run" | "reload" | "none";
type OutcomeDefinition = Readonly<{ message: string; retry: RetryGuidance }>;
const definitions = {
  "transport-error": { message: "The calculation channel could not deliver its message.", retry: "retry-same-request" },
  "protocol-mismatch": { message: "The page and calculation engine use different message versions.", retry: "reload" },
  "malformed-response": { message: "The calculation returned a response that could not be validated.", retry: "new-run" },
  "budget-exhausted": { message: "This calculation exceeds the declared work or memory budget.", retry: "new-run" },
  cancelled: { message: "This calculation was stopped before completion.", retry: "retry-same-request" },
  superseded: { message: "A newer request replaced this calculation.", retry: "none" },
  "missing-artifact": { message: "The required calculation module is not available.", retry: "reload" },
  "artifact-mismatch": { message: "The calculation module does not match the verified edition.", retry: "reload" },
  "environment-unsupported": { message: "This device does not provide the features this calculation needs.", retry: "none" },
  "worker-crashed": { message: "The calculation worker stopped unexpectedly.", retry: "new-run" },
  "context-lost": { message: "The graphics context was lost; the accepted calculation is preserved.", retry: "retry-same-request" },
  "invariant-violation": { message: "The calculation did not satisfy its required consistency checks.", retry: "new-run" },
} satisfies Record<string, OutcomeDefinition>;
for (const definition of Object.values(definitions)) Object.freeze(definition);
export const executionOutcomeRegistry = Object.freeze(definitions);
export type ExecutionOutcomeId = keyof typeof executionOutcomeRegistry;
export type WorkBudget = Readonly<{ workUnits: number; allocationBytes: number }>;
export type ExecutionOutcome = Readonly<{
  outcome: ExecutionOutcomeId;
  message: string;
  retry: RetryGuidance;
  details?: Readonly<Record<string, JsonValue>>;
}> & (
  | Readonly<{ outcome: "budget-exhausted"; requested: WorkBudget; allowed: WorkBudget }>
  | Readonly<{ outcome: Exclude<ExecutionOutcomeId, "budget-exhausted"> }>
);
