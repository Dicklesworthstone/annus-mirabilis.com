/**
 * Canonical unsigned 64-bit decimal string validator (interim implementation).
 * Specification: am-cm-schemas-experiment-fuu and am-rt-u64-identities-7ce
 *
 * Enforces:
 * - string type (numbers rejected to prevent JS 2^53-1 float precision truncation)
 * - "0" or nonzero leading digit with up to 19 subsequent digits (at most 20 chars)
 * - exact range [0, 2^64 - 1] = [0, 18446744073709551615]
 * - no sign, no whitespace, no decimals, no scientific notation, no underscores
 */

export const U64_MAX_BIGINT = 18446744073709551615n;
export const U64_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)$/;

export class U64ValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "u64") {
    super(`[${path}] ${message} (${code})`);
    this.name = "U64ValidationError";
    this.code = code;
    this.path = path;
  }
}

export function validateU64String(raw: unknown, path = "u64"): string {
  if (typeof raw !== "string") {
    throw new U64ValidationError(
      "u64-not-string",
      `Expected a canonical string for 64-bit unsigned integer, received ${typeof raw}. JSON numbers lose precision above 2^53-1.`,
      path
    );
  }

  if (!U64_DECIMAL_PATTERN.test(raw)) {
    throw new U64ValidationError(
      "u64-invalid-format",
      `"${raw}" is not a canonical unsigned 64-bit decimal string (must be digits only, no leading zeros except "0", no signs, no whitespace).`,
      path
    );
  }

  const val = BigInt(raw);
  if (val > U64_MAX_BIGINT) {
    throw new U64ValidationError(
      "u64-overflow",
      `"${raw}" exceeds 2^64 - 1 (${U64_MAX_BIGINT.toString()}).`,
      path
    );
  }

  return raw;
}

export const parseU64 = validateU64String;
