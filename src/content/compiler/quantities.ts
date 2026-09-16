/**
 * Routes content/quantities/*.yaml through the quantity schema for the content compiler.
 * AGENTS.md sanctions YAML as a content format ("JSON or YAML, plus constrained Markdown");
 * this module is the compiler's admission path for it, narrow by construction: it owns
 * exactly the `quantities/` prefix (excluding the not-yet-schema-owned `constant-sets/`
 * subtree) and nothing else. A path outside that prefix is never touched here, so
 * `unrouted-content` keeps firing for anything this module does not explicitly claim.
 *
 * YAML parsing goes through `strictParse` (src/content/schemas/strictParse.ts), the same
 * zero-dependency parser every other YAML content record already uses: no tag construction,
 * no code execution, no merge keys, and no anchors or aliases at all (the parser does not
 * implement them), so there is no anchor-expansion amplification to bound.
 * am-not-quantity-registry-2f7.
 */
import { strictParse } from "../schemas/strictParse.ts";
import { validateQuantity, type Quantity } from "../schemas/argument.ts";
import { parseLegacySpellingEntries, type LegacySpellingEntry } from "../quantities/resolveQuantityId.ts";
import { ContentError } from "./json.ts";

const LEGACY_SPELLINGS_FILENAME = "legacy-spellings.yaml";

/** Matches a direct child of `quantities/` with a `.yaml`/`.yml` extension, excluding the
 * `constant-sets/` subtree (owned by am-ref-constants-xik; no schema here admits it yet, so
 * a file placed there still falls through to `unrouted-content`, exactly as intended). */
export const QUANTITIES_ROUTE_PATTERN = /^quantities\/(?!constant-sets\/)([a-zA-Z0-9_-]+\.ya?ml)$/;

export function isQuantitiesPath(path: string): boolean {
  return QUANTITIES_ROUTE_PATTERN.test(path);
}

function parseYamlOrThrowContentError(text: string, path: string): unknown {
  try {
    return strictParse(text, "yaml");
  } catch (e) {
    throw new ContentError("invalid-yaml", path, e instanceof Error ? e.message : String(e));
  }
}

/** Validates the legacy-spellings table. Pure text in, entries out; the compiler decides
 * what to do with duplicates against the live quantity set, since that requires every
 * quantities file's ids, not just this one file. */
export function compileLegacySpellingsFile(text: string, path: string): readonly LegacySpellingEntry[] {
  const parsed = parseYamlOrThrowContentError(text, path);
  try {
    return [...parseLegacySpellingEntries(parsed, path).values()];
  } catch (e) {
    throw new ContentError("invalid-legacy-spellings", path, e instanceof Error ? e.message : String(e));
  }
}

/** Validates one quantities domain file (an array of Quantity records) through the exact
 * same `validateQuantity` the registry loader uses -- one schema, one set of rules, whether
 * the record is read by the registry directly or admitted by the content compiler. */
export function compileQuantitiesFile(text: string, path: string, registeredIds: readonly string[]): readonly Quantity[] {
  const parsed = parseYamlOrThrowContentError(text, path);
  if (!Array.isArray(parsed)) {
    throw new ContentError("invalid-quantities-file", path, "Expected a YAML list of quantity records.");
  }
  const ids = [...registeredIds];
  const result: Quantity[] = [];
  parsed.forEach((raw, i) => {
    let quantity: Quantity;
    try {
      quantity = validateQuantity(raw, `${path}[${i}]`, ids);
    } catch (e) {
      throw new ContentError("invalid-quantity", path, e instanceof Error ? e.message : String(e));
    }
    ids.push(quantity.id);
    result.push(quantity);
  });
  return result;
}

/** Dispatches one `quantities/` file to the legacy-spellings or quantity-array validator by
 * filename, and reports which kind it routed as (used for compiler diagnostics only). */
export function compileQuantitiesRoutePath(
  path: string,
  text: string,
  registeredIds: readonly string[],
): { kind: "legacy-spellings"; entries: readonly LegacySpellingEntry[] } | { kind: "quantities"; quantities: readonly Quantity[] } {
  const filename = path.slice(path.lastIndexOf("/") + 1);
  if (filename === LEGACY_SPELLINGS_FILENAME) {
    return { kind: "legacy-spellings", entries: compileLegacySpellingsFile(text, path) };
  }
  return { kind: "quantities", quantities: compileQuantitiesFile(text, path, registeredIds) };
}
