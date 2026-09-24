import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { loadRegistry } from "./registry";

/**
 * am-ep-foundations-z1e: "Every selected proof route is acyclic back to its entry assumptions;
 * cross-links are typed as cross-links, and every prerequisite carries its kind." Over every
 * lesson record, not one cluster's: foundTransport.records.test.ts walks proof edges from its own
 * six lessons only, so a cycle among lessons none of them reaches went unchecked. The reading
 * schema still admits a bare-string prerequisite, which renders as a proof edge without saying so.
 */
const DIR = new URL("../../../content/foundations/", import.meta.url);
type Prerequisite = string | { foundationId?: unknown; kind?: unknown };
const lessons = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as {
        id: string;
        kind: string;
        prerequisites?: Prerequisite[];
      },
  )
  .filter((r) => r.kind === "foundation");
const bare = (id: string) => id.replace(/^foundation:/, "");

/** Each lesson's proof-edge prerequisites, by lesson id. */
const proofEdges = (records: typeof lessons) =>
  new Map(
    records.map((r) => [
      r.id,
      (r.prerequisites ?? []).flatMap((p) =>
        typeof p === "object" && p.kind === "proof-edge" && typeof p.foundationId === "string"
          ? [bare(p.foundationId)]
          : [],
      ),
    ]),
  );

/** A path that leaves a lesson and comes back to it through proof edges, or null. */
export function proofCycle(edges: ReadonlyMap<string, readonly string[]>): string[] | null {
  for (const start of edges.keys()) {
    const stack: string[][] = [[start]];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const path = stack.pop() as string[];
      for (const next of edges.get(path.at(-1) as string) ?? []) {
        if (next === start) return [...path, next];
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push([...path, next]);
      }
    }
  }
  return null;
}

describe("every lesson's prerequisites", () => {
  const registered = new Set(loadRegistry().entries.map((e) => bare(e.id)));

  test("each carries its kind, proof-edge or cross-link, and names a registered lesson", () => {
    let checked = 0;
    for (const lesson of lessons)
      for (const p of lesson.prerequisites ?? []) {
        checked++;
        expect(typeof p, `${lesson.id}: ${JSON.stringify(p)}`).toBe("object");
        if (typeof p !== "object") continue;
        expect(["proof-edge", "cross-link"], `${lesson.id}`).toContain(p.kind as string);
        expect(
          registered.has(bare(String(p.foundationId))),
          `${lesson.id} -> ${p.foundationId}`,
        ).toBe(true);
      }
    expect(lessons.length).toBeGreaterThan(40);
    expect(checked).toBeGreaterThan(0);
  });

  test("no lesson reaches itself through proof edges", () => {
    expect(proofCycle(proofEdges(lessons))).toBeNull();
  });

  test("planted: the walk finds a cycle two lessons deep, and ignores one through a cross-link", () => {
    const edges = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);
    expect(proofCycle(edges)).toEqual(["a", "b", "c", "a"]);
    const withCrossLink = proofEdges([
      { id: "a", kind: "foundation", prerequisites: [{ foundationId: "b", kind: "proof-edge" }] },
      { id: "b", kind: "foundation", prerequisites: [{ foundationId: "a", kind: "cross-link" }] },
    ]);
    expect(proofCycle(withCrossLink)).toBeNull();
  });
});
