/**
 * 64-bit Decimal Seed Parsing, Validation, and Entropy.
 * Specification: am-inst-parameter-controls-cmj9, am-rt-u64-identities-7ce.
 */

import {
  parseU64,
  randomU64Seed,
  toBigIntU64,
  toU64String,
  type U64,
  U64_DECIMAL_PATTERN,
  U64_MAX_BIGINT,
  type U64String,
  U64ValidationError,
  validateU64String,
} from "../identity/u64.ts";

export {
  parseU64,
  randomU64Seed,
  toBigIntU64,
  toU64String,
  type U64,
  U64_DECIMAL_PATTERN,
  U64_MAX_BIGINT,
  type U64String,
  U64ValidationError,
  validateU64String,
};

/**
 * Checks if a string is a valid 64-bit unsigned decimal integer.
 */
export function isValidSeed(raw: unknown): rawInput is string {
  if (typeof raw !== "string") return false;
  try {
    parseU64(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a seed into a canonical decimal string.
 */
export function formatSeed(seed: string | bigint | U64 | U64String): string {
  return toU64String(seed);
}

/**
 * Generates a fresh random seed using ambient crypto entropy.
 */
export function generateSeed(): U64String {
  return randomU64Seed();
}
