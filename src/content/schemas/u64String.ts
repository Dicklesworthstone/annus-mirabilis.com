/**
 * Canonical unsigned 64-bit decimal string validator.
 * Re-exports the single grammar implementation from src/experiments/identity/u64.ts.
 * Specification: am-rt-u64-identities-7ce and am-cm-schemas-experiment-fuu
 */

export {
  parseU64,
  toBigIntU64,
  toU64String,
  type U64,
  U64_DECIMAL_PATTERN,
  U64_MAX,
  U64_MAX_BIGINT,
  type U64String,
  U64ValidationError,
  validateU64String,
} from "../../experiments/identity/u64.ts";
