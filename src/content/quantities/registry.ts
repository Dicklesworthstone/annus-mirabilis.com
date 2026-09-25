/**
 * The canonical quantity registry: loads content/quantities/*.yaml, validates every record
 * through the shared Quantity schema, and exposes exact id lookup. No label, prefix, or
 * case-insensitive lookup exists anywhere in this file -- that permissiveness
 * (`variableId.startsWith("var_" + id)`) is precisely the donor defect this registry exists
 * to prevent. am-not-quantity-registry-2f7.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Quantity, validateQuantity } from "../schemas/argument.ts";
import type { Frame } from "../schemas/meanings.ts";
import { strictParse } from "../schemas/strictParse.ts";

export class QuantityRegistryError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(code: string, message: string, path: string) {
    super(`[quantity-registry] ${path}: ${message} (${code})`);
    this.name = "QuantityRegistryError";
    this.code = code;
    this.path = path;
  }
}

export class UnknownQuantityError extends Error {
  readonly code = "unknown-quantity";
  constructor(id: string) {
    super(
      `Unknown quantity id: "${id}". No label, prefix, or case-insensitive lookup exists; check content/quantities/ or docs/QUANTITY_IDS.md.`,
    );
    this.name = "UnknownQuantityError";
  }
}

export const QUANTITIES_DIR = fileURLToPath(
  new URL("../../../content/quantities/", import.meta.url),
);

/** A record's id gets a distinct, frame-tagged pair only for a documented suffix. The suffix
 * must always agree with the record's own `frame` field; this is a defect, not a style note --
 * a mismatched pair would silently rename a quantity to something the id does not say. */
export const FRAME_SUFFIXES: Readonly<Record<string, Frame>> = Object.freeze({
  Stationary: "stationary-system",
  Moving: "moving-system",
  RestFrame: "object-rest",
  Comoving: "object-rest",
  Laboratory: "laboratory",
});

export function frameSuffixFor(id: string): { suffix: string; expected: Frame } | undefined {
  // Longest suffix first: "RestFrame" must not be shadowed by a hypothetical shorter match.
  const suffixes = Object.entries(FRAME_SUFFIXES).sort(([a], [b]) => b.length - a.length);
  for (const [suffix, expected] of suffixes) {
    if (id.endsWith(suffix)) return { suffix, expected };
  }
  return undefined;
}

function checkFrameSuffixAgreement(q: Quantity, path: string): void {
  const match = frameSuffixFor(q.id);
  if (!match) return;
  if (q.frame !== match.expected) {
    throw new QuantityRegistryError(
      "frame-suffix-mismatch",
      `id "${q.id}" ends with "${match.suffix}" so frame must be "${match.expected}", but it is "${q.frame}".`,
      path,
    );
  }
}

function listYamlFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "constant-sets") continue; // owned by am-ref-constants-xik; never loaded as quantities
    if (entry.name === "legacy-spellings.yaml") continue; // not a quantity record file
    if (entry.name === "__fixtures__") continue; // fixtures are loaded explicitly by tests, never by the real registry
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listYamlFiles(full));
    } else if (extname(entry.name) === ".yaml" || extname(entry.name) === ".yml") {
      out.push(full);
    }
  }
  return out.sort();
}

export type QuantityRegistry = Readonly<{
  quantities: ReadonlyMap<string, Quantity>;
  ids: readonly string[];
  files: readonly string[];
}>;

/** Loads and validates every quantity record under `dir` (default: the real content
 * directory). Exposed with a directory parameter so fixture-driven tests exercise the exact
 * loader the real registry uses, never a parallel check. */
export function loadQuantityRegistry(dir: string = QUANTITIES_DIR): QuantityRegistry {
  const files = listYamlFiles(dir);
  const quantities = new Map<string, Quantity>();

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const parsed = strictParse(text, "yaml");
    const records = Array.isArray(parsed) ? parsed : [parsed];
    records.forEach((raw, i) => {
      const path = `${file}[${i}]`;
      const q = validateQuantity(raw, path, [...quantities.keys()]);
      if (quantities.has(q.id)) {
        throw new QuantityRegistryError("duplicate-id", `Duplicate quantity id "${q.id}".`, path);
      }
      checkFrameSuffixAgreement(q, path);
      quantities.set(q.id, q);
    });
  }

  // Second pass: a representationFields entry must not shadow ANY registry id, including one
  // that loaded from a later file than the record declaring the representation field.
  for (const q of quantities.values()) {
    for (const rep of q.representationFields ?? []) {
      if (quantities.has(rep)) {
        throw new QuantityRegistryError(
          "representation-field-shadows-id",
          `Representation field "${rep}" declared on "${q.id}" shadows an existing quantity ID.`,
          `${q.id}.representationFields`,
        );
      }
    }
  }

  return Object.freeze({
    quantities,
    ids: Object.freeze([...quantities.keys()].sort()),
    files: Object.freeze(files),
  });
}

let cachedRegistry: QuantityRegistry | undefined;

/** The real, cached registry. Tests that need an isolated fixture directory call
 * `loadQuantityRegistry(dir)` directly instead, never mutating this cache. */
export function getQuantityRegistry(): QuantityRegistry {
  if (!cachedRegistry) cachedRegistry = loadQuantityRegistry();
  return cachedRegistry;
}

/** Exact lookup. Throws `UnknownQuantityError` for anything not a registered id -- never a
 * label, a prefix, or a case-insensitive match. */
export function getQuantity(id: string): Quantity {
  const q = getQuantityRegistry().quantities.get(id);
  if (!q) throw new UnknownQuantityError(id);
  return q;
}

export function isRegisteredQuantityId(id: string): boolean {
  return getQuantityRegistry().quantities.has(id);
}

/** Reserved spellings name a future record's id before that record exists, so two beads
 * cannot each invent a different name for the same not-yet-authored quantity.
 * `resolveQuantityId` still reports these `unregistered`; this table is documentation
 * (surfaced in docs/QUANTITY_IDS.md), never a silent stand-in binding. */
// magneticDeflectability and electricDeflectability, reserved here for am-sre-equations-2g3h, left
// this table on 2026-09-25 (dispatch 236): p. 920 names them and prints no definition, so they are
// registered with dimensionStatus "undefined-in-source" rather than waiting for one.
export const RESERVED_SPELLINGS: Readonly<Record<string, string>> = Object.freeze({});
