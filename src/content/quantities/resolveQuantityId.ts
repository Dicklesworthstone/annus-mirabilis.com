/**
 * The one exact lookup and legacy-spelling resolution every quantity-id check uses.
 * Neither function ever resolves a binding for the author: a legacy spelling is reported,
 * never silently mapped. am-not-quantity-registry-2f7.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Quantity } from "../schemas/argument.ts";
import { strictParse } from "../schemas/strictParse.ts";
import {
  getQuantityRegistry,
  isRegisteredQuantityId,
  QUANTITIES_DIR,
  type QuantityRegistry,
} from "./registry.ts";

export type LegacySpellingEntry = Readonly<{
  spelling: string;
  canonicalIds: readonly string[];
  message?: string | undefined;
}>;

export const LEGACY_SPELLINGS_PATH = fileURLToPath(
  new URL("../../../content/quantities/legacy-spellings.yaml", import.meta.url),
);

/** Validates already-parsed legacy-spellings YAML data. Pure (no I/O), so both the file-based
 * loader below and the content compiler's text-based route (which already holds parsed YAML)
 * share exactly this one validation, never two copies of the entry shape. Throws `TypeError`;
 * callers that need a different error type (the compiler's `ContentError`) catch and rewrap. */
export function parseLegacySpellingEntries(
  parsed: unknown,
  path: string,
): ReadonlyMap<string, LegacySpellingEntry> {
  // A comment-only or blank file parses to {} (this parser's empty-document value): treat
  // that as zero entries rather than a shape error, so a fixture can declare "no spellings".
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.keys(parsed).length === 0
  ) {
    return new Map();
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError(`${path}: expected a YAML list of legacy-spelling entries.`);
  }
  const map = new Map<string, LegacySpellingEntry>();
  parsed.forEach((raw, i) => {
    const entryPath = `${path}[${i}]`;
    if (!raw || typeof raw !== "object") throw new TypeError(`${entryPath}: expected an object.`);
    const o = raw as Record<string, unknown>;
    if (typeof o.spelling !== "string" || !o.spelling.trim())
      throw new TypeError(`${entryPath}.spelling: required.`);
    if (
      !Array.isArray(o.canonicalIds) ||
      o.canonicalIds.length === 0 ||
      !o.canonicalIds.every((c) => typeof c === "string" && c.trim())
    ) {
      throw new TypeError(`${entryPath}.canonicalIds: required non-empty string array.`);
    }
    if (map.has(o.spelling))
      throw new TypeError(`${entryPath}: duplicate legacy spelling "${o.spelling}".`);
    map.set(
      o.spelling,
      Object.freeze({
        spelling: o.spelling,
        canonicalIds: Object.freeze([...o.canonicalIds] as string[]),
        message: typeof o.message === "string" ? o.message : undefined,
      }),
    );
  });
  return map;
}

/** Loads a legacy-spellings file from an arbitrary path, uncached -- used directly by
 * fixture-driven tests and by the id-doc generator's `--legacy` override. The real,
 * cached table (`getLegacySpellings`) always reads `LEGACY_SPELLINGS_PATH`. */
export function getLegacySpellingsFrom(path: string): ReadonlyMap<string, LegacySpellingEntry> {
  const text = readFileSync(path, "utf8");
  return parseLegacySpellingEntries(strictParse(text, "yaml"), path);
}

let cachedLegacySpellings: ReadonlyMap<string, LegacySpellingEntry> | undefined;

export function getLegacySpellings(): ReadonlyMap<string, LegacySpellingEntry> {
  if (!cachedLegacySpellings) cachedLegacySpellings = getLegacySpellingsFrom(LEGACY_SPELLINGS_PATH);
  return cachedLegacySpellings;
}

/** Every legacy spelling maps to a registry id and is never itself one. A spelling data file
 * that violates this is a defect in the data, not a runtime concern for callers -- checked
 * eagerly here and again by registry.test.ts, never silently tolerated. */
export function assertLegacySpellingsAreValid(
  registry: QuantityRegistry = getQuantityRegistry(),
): void {
  for (const entry of getLegacySpellings().values()) {
    if (registry.quantities.has(entry.spelling)) {
      throw new TypeError(
        `legacy-spellings.yaml: "${entry.spelling}" is a registry id; a legacy spelling must never also be an id.`,
      );
    }
    for (const canonicalId of entry.canonicalIds) {
      if (!registry.quantities.has(canonicalId)) {
        throw new TypeError(
          `legacy-spellings.yaml: "${entry.spelling}" names canonical id "${canonicalId}", which is not registered.`,
        );
      }
    }
  }
}

export type ResolveResult =
  | Readonly<{ ok: true; quantity: Quantity }>
  | Readonly<{ ok: false; kind: "legacy-spelling"; canonicalIds: readonly string[] }>
  | Readonly<{ ok: false; kind: "unregistered" }>;

/** The exact lookup and legacy-spelling resolution used everywhere a quantity id is checked.
 * A representation field name (e.g. logFrequencyEnergyDensity on frequencyEnergyDensity) is
 * declared data, never a legacy spelling: it is reported `unregistered`, exactly like any
 * other unrecognized spelling, so a plotting representation is never silently exchanged for a
 * different physical quantity. */
export function resolveQuantityId(id: string): ResolveResult {
  const registry = getQuantityRegistry();
  const quantity = registry.quantities.get(id);
  if (quantity) return { ok: true, quantity };
  const legacy = getLegacySpellings().get(id);
  if (legacy) return { ok: false, kind: "legacy-spelling", canonicalIds: legacy.canonicalIds };
  return { ok: false, kind: "unregistered" };
}

/** Builds the human-readable message for a recorded legacy spelling. Throws for any id that
 * is not itself a recorded legacy spelling -- callers branch on `resolveQuantityId`'s `kind`
 * first, exactly as `withinTolerance`'s callers branch on its verdict kind before reading `diff`. */
export function legacySpellingMessage(id: string): string {
  const entry = getLegacySpellings().get(id);
  if (!entry) throw new RangeError(`"${id}" is not a recorded legacy spelling.`);
  if (entry.message) return entry.message;
  return entry.canonicalIds.length === 1
    ? `use ${entry.canonicalIds[0]}`
    : `choose between ${entry.canonicalIds.join(" or ")}`;
}

export { isRegisteredQuantityId, QUANTITIES_DIR };
