/**
 * URL Codec for 64-bit identities and seed parameters.
 * Specification: am-rt-u64-identities-7ce
 *
 * Enforces:
 * - Direct extraction and validation of canonical decimal strings from URLs/query strings
 * - Rejection of plus signs (+1 decoded as " 1", %2B1 decoded as "+1"), percent-escaped whitespace, and formatting anomalies
 * - Rejection of repeated query parameters
 * - Preservation of full 64-bit precision across URL roundtrips
 */

import { parseU64, toU64String, type U64, type U64String, U64ValidationError } from "./u64.ts";

/**
 * Extracts and validates a 64-bit identity parameter from URL search parameters.
 * Returns null if the parameter is absent.
 * Throws U64ValidationError if the parameter is repeated or invalid.
 */
export function getU64QueryParam(
  source: string | URLSearchParams | URL,
  paramName = "seed",
): U64String | null {
  const searchParams =
    source instanceof URL
      ? source.searchParams
      : source instanceof URLSearchParams
        ? source
        : new URLSearchParams(
            source.startsWith("?") || source.includes("=")
              ? source.replace(/^[^?]*\?/, "")
              : source,
          );

  const values = searchParams.getAll(paramName);
  if (values.length === 0) {
    return null;
  }
  if (values.length > 1) {
    throw new U64ValidationError(
      "u64-invalid-format",
      `Repeated query parameter "${paramName}" is not permitted.`,
      paramName,
    );
  }

  const raw = values[0];
  if (raw === undefined) {
    return null;
  }
  return parseU64(raw, paramName);
}

/**
 * Parses all declared u64 query parameters from URL or search params.
 */
export function parseU64QueryParams(
  source: string | URLSearchParams | URL,
  u64Fields: readonly string[] = ["seed"],
): Record<string, U64String> {
  const result: Record<string, U64String> = {};
  for (const field of u64Fields) {
    const val = getU64QueryParam(source, field);
    if (val !== null) {
      result[field] = val;
    }
  }
  return result;
}

/**
 * Sets a canonical 64-bit parameter on URLSearchParams.
 */
export function setU64QueryParam(
  searchParams: URLSearchParams,
  paramName: string,
  value: bigint | U64 | U64String,
): void {
  const canonical = toU64String(value);
  searchParams.set(paramName, canonical);
}

/**
 * Encodes an object of parameters into a URL query string, formatting declared u64 fields canonically.
 */
export function encodeU64QueryParams(
  params: Record<string, unknown>,
  u64Fields: readonly string[] = ["seed"],
): string {
  const u64Set = new Set(u64Fields);
  const searchParams = new URLSearchParams();

  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) {
      continue;
    }
    if (u64Set.has(key)) {
      if (typeof val === "bigint" || typeof val === "string") {
        searchParams.set(key, toU64String(val));
      } else {
        throw new U64ValidationError(
          "u64-not-string",
          `Expected string or bigint for u64 query param "${key}", received ${typeof val}.`,
          key,
        );
      }
    } else {
      searchParams.set(key, String(val));
    }
  }

  return searchParams.toString();
}
