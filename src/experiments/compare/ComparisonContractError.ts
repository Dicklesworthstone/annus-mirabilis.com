/** Failed comparison contracts are software errors, not scientific output statuses. */
export type ComparisonContractErrorCode =
  | "comparison-requires-scalar"
  | "comparison-incompatible";

/** TypeError compatibility is retained for callers of the original comparison APIs. */
export class ComparisonContractError extends TypeError {
  readonly code: ComparisonContractErrorCode;

  constructor(code: ComparisonContractErrorCode, message: string) {
    super(message);
    this.name = "ComparisonContractError";
    this.code = code;
  }
}
