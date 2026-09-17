import { describe, expect, test } from "bun:test";
import {
  classifyAlignableUnit,
  isPermanentEquationAnchor,
  isPermanentFootnoteId,
  isPermanentGermanId,
  isPermanentParagraphId,
} from "../../content/editions/alignableIds.ts";
import { validateManyToManyAlignment } from "../../content/editions/alignment.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-edn-alignment-tooling-do1";

describe("alignment consumes the id-scheme reject examples, paired with their siblings", () => {
  test("S3-p1 is rejected while s3-p1 accepts (case-sensitive paragraph id)", () => {
    expect(isPermanentParagraphId("s3-p1")).toBe(true);
    expect(isPermanentParagraphId("S3-p1")).toBe(false);
    expect(isPermanentGermanId("S3-p1")).toBe(false);
    expect(classifyAlignableUnit("S3-p1")).toBeNull();
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "S3-p1", targetId: "s3-p1-s1" }],
      germanIds: ["s3-p1"],
      englishIds: ["s3-p1-s1"],
    });
    expect(issues.some((i) => i.code === "missing-source-id" && i.sourceId === "S3-p1")).toBe(true);
    logger.log({
      testId: "id-scheme-reject-S3-p1",
      beadId: BEAD,
      extra: { check: "alignment-edges" },
      outcome: "passed",
      message: "uppercase S3-p1 is not an alignment source; s3-p1 is a paragraph id",
    });
  });

  test("s3-fn0 is rejected while s3-fn1 accepts (footnotes are 1-indexed)", () => {
    expect(isPermanentFootnoteId("s3-fn1")).toBe(true);
    expect(isPermanentFootnoteId("s3-fn0")).toBe(false);
    expect(isPermanentGermanId("s3-fn0")).toBe(false);
    expect(classifyAlignableUnit("s3-fn0")).toBeNull();
    const accepted = classifyAlignableUnit("s3-fn1");
    expect(accepted?.kind).toBe("footnote");
    expect(accepted?.alignsAt).toBe("block");
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "s3-fn0", targetId: "s3-fn1" }],
      germanIds: ["s3-fn1"],
      englishIds: ["s3-fn1"],
    });
    expect(issues.some((i) => i.code === "missing-source-id" && i.sourceId === "s3-fn0")).toBe(
      true,
    );
    logger.log({
      testId: "id-scheme-reject-s3-fn0",
      beadId: BEAD,
      extra: { check: "alignment-edges" },
      outcome: "passed",
      message: "s3-fn0 is not an alignment source; s3-fn1 is a block-level footnote",
    });
  });

  test("eq-s3-d0 is rejected while eq-s3-d1 accepts (display equations are 1-indexed)", () => {
    expect(isPermanentEquationAnchor("eq-s3-d1")).toBe(true);
    expect(isPermanentEquationAnchor("eq-s3-d0")).toBe(false);
    expect(isPermanentGermanId("eq-s3-d0")).toBe(false);
    const issues = validateManyToManyAlignment({
      edges: [{ sourceId: "eq-s3-d0", targetId: "eq-s3-d1" }],
      germanIds: ["eq-s3-d1"],
      englishIds: ["eq-s3-d1"],
    });
    expect(issues.some((i) => i.code === "missing-source-id" && i.sourceId === "eq-s3-d0")).toBe(
      true,
    );
    logger.log({
      testId: "id-scheme-reject-eq-s3-d0",
      beadId: BEAD,
      extra: { check: "alignment-edges" },
      outcome: "passed",
      message: "eq-s3-d0 is not an equation anchor; eq-s3-d1 is",
    });
  });
});
