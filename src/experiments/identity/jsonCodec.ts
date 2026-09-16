/**
 * JSON Codec for 64-bit identities and parameters.
 * Specification: am-rt-u64-identities-7ce
 *
 * Enforces:
 * - Scoped replacer/reviver for declared u64 fields
 * - Encodes BigInt/U64 as canonical U64String
 * - Strictly rejects JSON numbers for declared u64 fields (preventing precision loss above 2^53-1)
 * - Guarantees that distinct values such as 9007199254740992 and 9007199254740993 remain distinct
 */

import { parseU64, toU64String, U64ValidationError } from "./u64.ts";

/** Default field names treated as 64-bit unsigned decimal strings. */
export const DEFAULT_U64_FIELDS: readonly string[] = [
  "seed",
  "index",
  "draws",
  "startStep",
  "drawCounter",
];

/**
 * Creates a JSON replacer function that converts BigInt / U64 values in declared
 * fields to canonical U64String decimal strings.
 */
export function createU64JsonReplacer(
  u64Fields: readonly string[] | Set<string> = DEFAULT_U64_FIELDS,
): (key: string, value: unknown) => unknown {
  const fieldSet = u64Fields instanceof Set ? u64Fields : new Set(u64Fields);

  return function u64Replacer(key: string, value: unknown): unknown {
    if (key && fieldSet.has(key)) {
      if (typeof value === "bigint") {
        return toU64String(value);
      }
      if (typeof value === "string") {
        return parseU64(value, key);
      }
    }
    return value;
  };
}

/**
 * Creates a JSON reviver function that strictly validates declared u64 fields
 * with `parseU64`. Rejects JSON numbers, signs, and invalid formats.
 */
export function createU64JsonReviver(
  u64Fields: readonly string[] | Set<string> = DEFAULT_U64_FIELDS,
): (key: string, value: unknown) => unknown {
  const fieldSet = u64Fields instanceof Set ? u64Fields : new Set(u64Fields);

  return function u64Reviver(key: string, value: unknown): unknown {
    if (key && fieldSet.has(key)) {
      if (typeof value === "number") {
        throw new U64ValidationError(
          "u64-not-string",
          `JSON number received for u64 field "${key}". 64-bit identities must be serialized as strings to prevent float precision loss.`,
          key,
        );
      }
      if (typeof value !== "string") {
        throw new U64ValidationError(
          "u64-not-string",
          `Expected string for u64 field "${key}", received ${typeof value}.`,
          key,
        );
      }
      return parseU64(value, key);
    }
    return value;
  };
}

/**
 * Serializes an object to JSON, safely converting declared u64 BigInt fields to canonical strings.
 */
export function stringifyWithU64<T>(
  value: T,
  u64Fields: readonly string[] = DEFAULT_U64_FIELDS,
  space?: number | string,
): string {
  return JSON.stringify(value, createU64JsonReplacer(u64Fields), space);
}

/**
 * Parses a JSON string, strictly validating declared u64 fields as canonical decimal strings.
 */
export function parseWithU64<T>(
  json: string,
  u64Fields: readonly string[] = DEFAULT_U64_FIELDS,
): T {
  return JSON.parse(json, createU64JsonReviver(u64Fields)) as T;
}
