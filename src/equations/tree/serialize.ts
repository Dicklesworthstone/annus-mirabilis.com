/**
 * Deterministic canonical serialization and content hashing for expression trees.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import { createHash } from "node:crypto";
import type { EquationTree, Expression } from "./types.ts";

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined) {
      entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
    }
  }

  return `{${entries.join(",")}}`;
}

export function computeTreeHash(tree: EquationTree | Expression): string {
  const canonical = canonicalJsonStringify(tree);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export const canonical = canonicalJsonStringify;
