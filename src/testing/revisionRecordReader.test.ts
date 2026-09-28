/**
 * THE CROSS-COMMIT CHECK CAN READ THE FIELD IT DEMANDS (am-9755).
 *
 * `validateRecordLineage` requires a lineage array of every record past revision 1, and the YAML
 * side of scripts/check-revisions.ts was two regexes, for `id` and `revision`, with the file's
 * text under a `raw` key. So `record.lineage` was ALWAYS undefined for a YAML record and the
 * check was asking 64 records for a field its own reader could not read. No lineage anyone wrote
 * would have satisfied it, which is the worst shape a gate can take: a demand that cannot be met
 * and therefore stops being read.
 *
 * WHY THIS TEST IS HERE AND NOT ONLY IN THE GATE'S OWN LANE. The reader is exercised by
 * verify-content, and a reader that returns null for everything makes verify-content greener, not
 * redder: an empty population passes. So the proof lives in the unit lane, where it can assert
 * what came back rather than that nothing complained (AGENTS.md, "A Gate's Own Test Must Not Live
 * Only In The Lane That Gate Controls").
 */
import { describe, expect, test } from "bun:test";
import { parseRecordContent, unparsed } from "../../scripts/check-revisions.ts";

const WITH_LINEAGE = `id: "s2-p4"
kind: "paragraph"
revision: 4
lineage:
  - revision: 1
    date: "2026-09-25"
    reason: "9d5f0530 the paper's 87 German source blocks"
  - revision: 2
    date: "2026-09-25"
    reason: "e86c6140 cut on the plate's sentence boundaries"
  - revision: 3
    date: "2026-09-25"
    reason: "c46a3e13 a space after each display formula"
  - revision: 4
    date: "2026-09-25"
    reason: "c7c9b661 a space after the last 6 display formulas"
status: "draft"
`;

describe("the record reader behind the cross-commit revision check", () => {
  test("a YAML record's lineage arrives, which the regex reader could never deliver", () => {
    const record = parseRecordContent(WITH_LINEAGE, "content/source-blocks/x/s2-p4.yaml");
    expect(record).not.toBeNull();
    expect(record?.id).toBe("s2-p4");
    expect(record?.revision).toBe(4);
    const lineage = record?.lineage;
    expect(Array.isArray(lineage)).toBe(true);
    expect(lineage?.map((entry) => entry.revision)).toEqual([1, 2, 3, 4]);
    // A reason with a commit hash in front of it is what makes the entry checkable by hand.
    expect(lineage?.[0]?.reason.startsWith("9d5f0530")).toBe(true);
    expect(lineage?.[3]?.date).toBe("2026-09-25");
  });

  test("a JSON record still arrives whole", () => {
    const record = parseRecordContent(
      JSON.stringify({
        id: "misc-x",
        revision: 2,
        lineage: [{ revision: 1, date: "2026-09-01", reason: "made" }],
      }),
      "content/misconceptions/x/misc-x.json",
    );
    expect(record?.id).toBe("misc-x");
    expect(record?.lineage?.length).toBe(1);
  });

  test("a file that looks like a record and will not parse is recorded, not dropped", () => {
    const before = unparsed.length;
    const record = parseRecordContent(
      'id: "broken"\nrevision: 2\n  badly: indented\n',
      "content/x/broken.yaml",
    );
    expect(record).toBeNull();
    // The population must be able to say it shrank; a silent null is a record nobody checks again.
    expect(unparsed.length).toBeGreaterThan(before);
    expect(unparsed[unparsed.length - 1]).toContain("content/x/broken.yaml");
  });

  test("a file that is not a record at all is skipped without being called unparseable", () => {
    const before = unparsed.length;
    expect(parseRecordContent("title: a tour\nsteps: []\n", "content/tours/x.yaml")).toBeNull();
    expect(unparsed.length).toBe(before);
  });
});
