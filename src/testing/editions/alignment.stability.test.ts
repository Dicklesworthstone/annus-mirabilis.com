import { describe, expect, test } from "bun:test";
import {
  donorIndexAlignment,
  type ExplicitEdge,
  edgeStillPointsAtPair,
  insertGermanUnit,
  validateManyToManyAlignment,
} from "../../content/editions/alignment.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

const GERMAN = Object.freeze(["s0-p1-s1", "s0-p1-s2", "s0-p2-s1"]);
const ENGLISH = Object.freeze(["s0-p1-s1", "s0-p1-s2", "s0-p2-s1"]);
const EDGES: readonly ExplicitEdge[] = Object.freeze([
  { sourceId: "s0-p1-s1", targetId: "s0-p1-s1" },
  { sourceId: "s0-p1-s2", targetId: "s0-p1-s2" },
  { sourceId: "s0-p2-s1", targetId: "s0-p2-s1" },
]);

describe("alignment is by permanent id, not array position", () => {
  test("explicit many-to-many edges validate against id sets", () => {
    const issues = validateManyToManyAlignment({
      edges: EDGES,
      germanIds: GERMAN,
      englishIds: ENGLISH,
    });
    expect(issues).toEqual([]);
    logger.log({
      testId: "alignment-explicit-ids",
      beadId: BEAD,
      extra: { check: "alignment-edges" },
      outcome: "passed",
      message: "edges name permanent sentence ids",
    });
  });

  test("PLANTED: one German sentence to two English units is allowed", () => {
    const issues = validateManyToManyAlignment({
      edges: [
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1a" },
        { sourceId: "s0-p1-s1", targetId: "s0-p1-s1b" },
      ],
      germanIds: ["s0-p1-s1"],
      englishIds: ["s0-p1-s1a", "s0-p1-s1b"],
    });
    expect(issues).toEqual([]);
  });

  test("PLANTED: an index-based edge is refused", () => {
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "0", targetId: "0" }],
      germanIds: GERMAN,
      englishIds: ENGLISH,
    });
    expect(issues.some((i) => i.code === "index-based-edge")).toBe(true);
  });

  test("PLANTED NEGATIVE vs donor: insert a paragraph and id-edges still name the same pair; index-edges do not", () => {
    const inserted = insertGermanUnit(GERMAN, 2, "s0-p3-s1");
    expect(inserted).toEqual(["s0-p1-s1", "s0-p1-s2", "s0-p3-s1", "s0-p2-s1"]);

    for (const edge of EDGES) {
      expect(edgeStillPointsAtPair(EDGES, edge.sourceId, edge.targetId)).toBe(true);
    }
    const afterIssues = validateManyToManyAlignment({
      edges: EDGES,
      germanIds: inserted,
      englishIds: ENGLISH,
    });
    expect(afterIssues).toEqual([]);
    expect(edgeStillPointsAtPair(EDGES, "s0-p2-s1", "s0-p2-s1")).toBe(true);

    const donorBefore = donorIndexAlignment(GERMAN, ENGLISH);
    const donorAfter = donorIndexAlignment(inserted, ENGLISH);
    const lastBefore = donorBefore[donorBefore.length - 1];
    const shifted = donorAfter[2];
    expect(lastBefore?.sourceIndex).toBe(2);
    expect(GERMAN[2]).toBe("s0-p2-s1");
    expect(inserted[2]).toBe("s0-p3-s1");
    expect(shifted?.sourceIndex).toBe(2);
    expect(inserted[shifted?.sourceIndex ?? -1]).not.toBe("s0-p2-s1");
    logger.log({
      testId: "alignment-insert-paragraph",
      beadId: BEAD,
      extra: { check: "id-stability" },
      outcome: "passed",
      message:
        "inserting a paragraph leaves id-edges pointing at the same sentence pair; donor indices shift",
    });
  });
});
