/**
 * Exact rational-exponent dimension checker forwarding to content dimensions engine.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import {
  type DimensionCheckResult,
  type DimensionCheckStatus,
  checkDimensions as checkContentDimensions,
} from "../content/dimensions/check.ts";
import type { Dimension } from "../content/dimensions/rational.ts";
import type { Expression } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";

export type DimensionCheck =
  | Readonly<{ status: "consistent"; dimension: Dimension }>
  | Readonly<{
      status: "inconsistent" | "semantic-mismatch" | "unsupported-check";
      nodeId: string | null;
      reason: string;
      lhsDimension?: Dimension;
      rhsDimension?: Dimension;
      kinds?: readonly [string, string];
    }>;

/**
 * Dimensions prove unit consistency, not a physical law or an arbitrary semantic equivalence.
 */
export function checkDimensions(
  root: Expression,
  registry: QuantityRegistry,
  options?: { context?: "si" | "gaussian-cgs" | "emu-cgs" },
): DimensionCheck {
  const result = checkContentDimensions(root, registry as any, options);
  if (result.status === "consistent") {
    return { status: "consistent", dimension: result.dimension };
  }
  return {
    status: result.status,
    nodeId: result.nodeId,
    reason: result.reason,
    ...(result.status === "inconsistent"
      ? { lhsDimension: result.lhsDimension, rhsDimension: result.rhsDimension }
      : {}),
    ...(result.status === "semantic-mismatch" ? { kinds: result.kinds } : {}),
  };
}
