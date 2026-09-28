/**
 * The ordering feedback a capstone gives (am-disc-capstones-infra-3352), on the fixture graph the
 * bead specifies: A->C, B->C, C->D, D->E, D->F.
 *
 * The consistent orders are ENUMERATED rather than asserted from a list I wrote down: all 720
 * permutations are generated, each is put through the function, and the ones it calls consistent are
 * compared with the ones a separate check finds consistent. A hand-written list of four orders would
 * pass just as well against a function that always said "consistent".
 */
import { describe, expect, test } from "bun:test";
import {
  consistentOrderCount,
  type DependencyEdge,
  DependencyGraphError,
  dependencyFeedback,
} from "./dependencyFeedback.ts";

const ITEMS = ["A", "B", "C", "D", "E", "F"] as const;
const EDGES: readonly DependencyEdge[] = [
  { from: "A", to: "C" },
  { from: "B", to: "C" },
  { from: "C", to: "D" },
  { from: "D", to: "E" },
  { from: "D", to: "F" },
];

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [
      value,
      ...rest,
    ]),
  );
}

/** Consistency computed independently of the function under test. */
function consistentByIndex(order: readonly string[]): boolean {
  const at = (id: string) => order.indexOf(id);
  return EDGES.every((edge) => at(edge.from) < at(edge.to));
}

describe("dependencyFeedback on the capstone fixture graph", () => {
  test("every order consistent with the dependencies is accepted, and only those", () => {
    const all = permutations([...ITEMS]);
    expect(all.length).toBe(720);
    const acceptedByFunction = all.filter(
      (order) => dependencyFeedback(ITEMS, EDGES, order).consistent,
    );
    const acceptedIndependently = all.filter(consistentByIndex);
    expect(acceptedByFunction.map((o) => o.join(""))).toEqual(
      acceptedIndependently.map((o) => o.join("")),
    );
    // The bead's own number, reported beside the verdict rather than assumed: four orders satisfy
    // A->C, B->C, C->D, D->E, D->F.
    console.log(
      `[dependency feedback] ${acceptedByFunction.length} of ${all.length} orders are consistent: ${acceptedByFunction.map((o) => o.join("")).join(", ")}`,
    );
    expect(acceptedByFunction.length).toBe(4);
  });

  test("the reversed order breaks every edge, named", () => {
    const result = dependencyFeedback(ITEMS, EDGES, [...ITEMS].reverse());
    expect(result.consistent).toBe(false);
    expect(result.violated.map((e) => `${e.from}->${e.to}`)).toEqual([
      "A->C",
      "B->C",
      "C->D",
      "D->E",
      "D->F",
    ]);
  });

  test("one claim out of place names exactly the one dependency it breaks", () => {
    const result = dependencyFeedback(ITEMS, EDGES, ["A", "B", "D", "C", "E", "F"]);
    expect(result.violated.map((e) => `${e.from}->${e.to}`)).toEqual(["C->D"]);
    expect(result.consistent).toBe(false);
  });

  test("a cycle is refused before any order is read", () => {
    const cyclic = [...EDGES, { from: "E", to: "A" }];
    // The order given here is one that would be consistent with the acyclic graph, so a function
    // that evaluated the order first would return "consistent" and never mention the cycle.
    expect(() => dependencyFeedback(ITEMS, cyclic, ["A", "B", "C", "D", "E", "F"])).toThrow(
      DependencyGraphError,
    );
    try {
      dependencyFeedback(ITEMS, cyclic, ["A", "B", "C", "D", "E", "F"]);
    } catch (error) {
      expect((error as DependencyGraphError).code).toBe("dependency-graph-cycle");
      expect((error as DependencyGraphError).message).toContain("cycle");
    }
  });

  test("an order that is not a permutation, and an edge naming nothing, are refused by code", () => {
    try {
      dependencyFeedback(ITEMS, EDGES, ["A", "B", "C"]);
      throw new Error("a short order was accepted");
    } catch (error) {
      expect((error as DependencyGraphError).code).toBe("dependency-order-not-a-permutation");
    }
    try {
      dependencyFeedback(ITEMS, EDGES, ["A", "A", "C", "D", "E", "F"]);
      throw new Error("a repeated item was accepted");
    } catch (error) {
      expect((error as DependencyGraphError).code).toBe("dependency-order-not-a-permutation");
    }
    try {
      dependencyFeedback(ITEMS, [{ from: "A", to: "Z" }], [...ITEMS]);
      throw new Error("an unknown edge end was accepted");
    } catch (error) {
      expect((error as DependencyGraphError).code).toBe("dependency-edge-unknown-item");
    }
  });

  test("consistentOrderCount agrees with the enumeration, and refuses past its limit", () => {
    // The same four the enumeration above finds, from the function a page will call.
    expect(consistentOrderCount(ITEMS, EDGES)).toBe(4);
    // A total order admits exactly one arrangement, and no edges admit all of them. Both are
    // computed here rather than asserted from the chain's shape.
    const chain: DependencyEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    expect(consistentOrderCount(["A", "B", "C"], chain)).toBe(1);
    expect(consistentOrderCount(["A", "B", "C"], [])).toBe(6);
    // Past the limit it says it did not look, rather than returning a number it did not compute or
    // taking minutes to produce one.
    expect(consistentOrderCount(ITEMS, EDGES, 5)).toBeUndefined();
    expect(consistentOrderCount(ITEMS, EDGES, 6)).toBe(4);
  });

  test("the result carries no score, count or verdict field a caller could print", () => {
    const result = dependencyFeedback(ITEMS, EDGES, ["A", "B", "D", "C", "E", "F"]);
    // AGENTS.md: no invented impact scores, no flattering percentage. The shape is the policy.
    expect(Object.keys(result).sort()).toEqual(["consistent", "violated"]);
    for (const value of Object.values(result)) expect(typeof value).not.toBe("number");
  });
});
