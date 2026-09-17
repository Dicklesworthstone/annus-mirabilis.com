/**
 * Exact rational-exponent dimension checker forwarding to content dimensions engine.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import { checkDimensions as checkContentDimensions } from "../content/dimensions/check.ts";
import type { Dimension, DimensionSlotMismatch } from "../content/dimensions/rational.ts";
import type { Expression } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";

export type DimensionCheck =
  | Readonly<{ status: "consistent"; dimension: Dimension }>
  | Readonly<{
      status: "inconsistent";
      nodeId: string | null;
      reason: string;
      lhsDimension: Dimension;
      rhsDimension: Dimension;
      offendingBases: readonly DimensionSlotMismatch[];
      subexpression: string;
    }>
  | Readonly<{
      status: "semantic-mismatch";
      nodeId: string | null;
      reason: string;
      kinds: readonly [string, string];
      subexpression: string;
    }>
  | Readonly<{
      status: "unsupported-check";
      nodeId: string | null;
      reason: string;
    }>;

/**
 * Dimensions prove unit consistency, not a physical law or an arbitrary semantic equivalence.
 */
export function checkDimensions(
  root: Expression,
  registry: QuantityRegistry,
  options?: { context?: "si" | "gaussian-cgs" | "emu-cgs" },
): DimensionCheck {
  return checkContentDimensions(root, registry, options);
}
