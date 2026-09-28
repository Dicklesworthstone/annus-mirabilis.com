/**
 * WHICH DEPENDENCIES AN ORDER BREAKS (am-disc-capstones-infra-3352).
 *
 * A capstone asks a reader to put an argument's claims in an order that works. A dependency chain is
 * a PARTIAL order, not a sequence: several orders can be consistent with the same argument, and the
 * order the paper prints is one of them rather than the answer. So this returns the edges an order
 * breaks and nothing else.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN. No score, no count of violations as a verdict, no
 * percentage, no "correct order". The shape is the policy: a caller that wanted to show "3 of 5"
 * would have to compute it itself, and AGENTS.md forbids that theatre. `violated` is a list a reader
 * can act on, named edge by edge.
 *
 * A CYCLE IS REFUSED BEFORE ANY ORDER IS READ, because no order can satisfy one and reporting
 * violations against an impossible graph would blame the reader for the record's defect. That is a
 * refusal about the authored capstone, not about the reader's attempt.
 *
 * Reused by the chapter-end ordering tasks (am-disc-ppe-teachback-wnp7), which is why it lives in
 * shared/ and takes plain ids rather than capstone records.
 */

/** `from` must come before `to`: the claim `to` uses or answers the claim `from`. */
export type DependencyEdge = Readonly<{ from: string; to: string }>;

export type DependencyFeedback = Readonly<{
  /** True when the order breaks no edge. The same fact as `violated.length === 0`, named. */
  consistent: boolean;
  /** Exactly the edges this order breaks, in the order the edges were given. */
  violated: readonly DependencyEdge[];
}>;

export class DependencyGraphError extends Error {
  readonly code:
    | "dependency-graph-cycle"
    | "dependency-order-not-a-permutation"
    | "dependency-edge-unknown-item";
  constructor(code: DependencyGraphError["code"], message: string) {
    super(`${code}: ${message}`);
    this.name = "DependencyGraphError";
    this.code = code;
  }
}

/** The ids of a cycle, or undefined where the graph is acyclic. Depth-first, iterative. */
function findCycle(
  items: readonly string[],
  edges: readonly DependencyEdge[],
): readonly string[] | undefined {
  const next = new Map<string, string[]>(items.map((id) => [id, []]));
  for (const edge of edges) next.get(edge.from)?.push(edge.to);
  const state = new Map<string, "open" | "closed">();
  const path: string[] = [];

  const walk = (id: string): readonly string[] | undefined => {
    state.set(id, "open");
    path.push(id);
    for (const child of next.get(id) ?? []) {
      if (state.get(child) === "open") return [...path.slice(path.indexOf(child)), child];
      if (!state.has(child)) {
        const found = walk(child);
        if (found) return found;
      }
    }
    path.pop();
    state.set(id, "closed");
    return undefined;
  };

  for (const id of items) {
    if (state.has(id)) continue;
    const found = walk(id);
    if (found) return found;
  }
  return undefined;
}

/**
 * The edges `order` breaks. `items` is the whole set, `edges` the authored dependencies, `order` the
 * reader's arrangement.
 */
export function dependencyFeedback(
  items: readonly string[],
  edges: readonly DependencyEdge[],
  order: readonly string[],
): DependencyFeedback {
  const known = new Set(items);
  for (const edge of edges) {
    for (const end of [edge.from, edge.to]) {
      if (!known.has(end))
        throw new DependencyGraphError(
          "dependency-edge-unknown-item",
          `edge ${edge.from} -> ${edge.to} names "${end}", which is not one of the items.`,
        );
    }
  }

  // Before any order is read: an impossible graph is the record's defect, not the reader's.
  const cycle = findCycle(items, edges);
  if (cycle)
    throw new DependencyGraphError(
      "dependency-graph-cycle",
      `the dependencies form a cycle: ${cycle.join(" -> ")}.`,
    );

  const seen = new Set(order);
  if (
    order.length !== items.length ||
    seen.size !== order.length ||
    ![...known].every((id) => seen.has(id))
  )
    throw new DependencyGraphError(
      "dependency-order-not-a-permutation",
      `the order must list each of the ${items.length} items exactly once; it lists ${order.length}.`,
    );

  const position = new Map(order.map((id, index) => [id, index]));
  const violated = edges.filter((edge) => {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    return from !== undefined && to !== undefined && from > to;
  });
  return { consistent: violated.length === 0, violated };
}
