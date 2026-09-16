/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/paramAliases.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed all donor patent alias dictionary entries.
 * - Parameter aliasing shape keyed by canonical quantity IDs for cross-instrument groups.
 * - No resolution by control name, glyph, or display unit.
 */

export interface ParamAliasSpec {
  readonly canonical: string;
  readonly toCanonical?: (val: number) => number;
  readonly fromCanonical?: (val: number) => number;
}

export type ParamAliasRegistry = Record<string, Record<string, ParamAliasSpec>>;

/**
 * Empty by default in the core runtime; populated by registered cross-instrument experiment groups
 * (am-linked-experiment-groups-5t5s).
 */
export const PARAM_ALIASES: ParamAliasRegistry = {};

/**
 * Helper to construct an identity alias mapping to a canonical quantity id.
 */
export function same(canonical: string): ParamAliasSpec {
  return { canonical };
}

/**
 * Helper to construct a scaled linear alias mapping.
 */
export function linear(canonical: string, scale: number, offset = 0): ParamAliasSpec {
  return {
    canonical,
    toCanonical: (v: number) => v * scale + offset,
    fromCanonical: (v: number) => (v - offset) / scale,
  };
}

export function canonicalizeParam(
  experimentId: string,
  paramId: string,
  value: number,
  registry: ParamAliasRegistry = PARAM_ALIASES,
): { id: string; value: number } {
  const spec = registry[experimentId]?.[paramId];
  if (!spec) return { id: paramId, value };
  return {
    id: spec.canonical,
    value: spec.toCanonical ? spec.toCanonical(value) : value,
  };
}

export function expandParamAliases(
  experimentId: string,
  params: Record<string, number>,
  registry: ParamAliasRegistry = PARAM_ALIASES,
): Record<string, number> {
  const aliases = registry[experimentId];
  if (!aliases) return params;
  const out = { ...params };
  for (const [alias, spec] of Object.entries(aliases)) {
    const canon = out[spec.canonical];
    if (typeof canon === "number") {
      out[alias] = spec.fromCanonical ? spec.fromCanonical(canon) : canon;
    }
  }
  return out;
}
