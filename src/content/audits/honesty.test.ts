import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import {
  auditCitationsResolve,
  auditEquationBlocksIdentical,
  auditQuantityIdsRegistered,
  auditReviewHonesty,
  type EquationPair,
  type ReviewHonestyRecord,
} from "./honesty.ts";
import { errorCheckCodes } from "./types.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "honesty");
const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as T;
}

describe("auditReviewHonesty: paired ok/broken fixtures", () => {
  test("GOOD RECORD: accepted review with a named reviewer and a review record passes", () => {
    const records = loadJson<ReviewHonestyRecord[]>("review.ok.json");
    const report = auditReviewHonesty(records);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "honesty-review-ok",
      beadId: BEAD,
      extra: { family: "audit", check: "review-honesty" },
      outcome: "passed",
      message: "accepted review with reviewer is admitted",
    });
  });

  test("PLANTED: a record that claims review without a reviewer is rejected by code", () => {
    const good = loadJson<ReviewHonestyRecord[]>("review.ok.json");
    const planted = loadJson<ReviewHonestyRecord[]>("review-claim-without-reviewer.broken.json");
    const report = auditReviewHonesty([...good, ...planted]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("review-claim-without-reviewer");
    expect(
      report.findings.some((f) => f.recordId === "arg-reviewed" && f.severity === "error"),
    ).toBe(false);
    expect(
      report.findings.some(
        (f) =>
          f.recordId === "arg-claimed-without-reviewer" &&
          f.check === "review-claim-without-reviewer",
      ),
    ).toBe(true);
    logger.log({
      testId: "honesty-review-claim-without-reviewer",
      beadId: BEAD,
      extra: { family: "audit", check: "review-claim-without-reviewer" },
      outcome: "passed",
      message: "claimed review without reviewer is rejected by check code",
    });
  });

  test("PLANTED: accepted without a review record is rejected by code", () => {
    const report = auditReviewHonesty(
      loadJson<ReviewHonestyRecord[]>("review-claim-unbacked.broken.json"),
    );
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("review-claim-unbacked");
  });

  test("PLANTED: a draft that does not emit editorial-review-pending is rejected by code", () => {
    const report = auditReviewHonesty(
      loadJson<ReviewHonestyRecord[]>("editorial-review-pending-missing.broken.json"),
    );
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("editorial-review-pending-missing");
  });
});

describe("auditCitationsResolve: paired ok/broken fixtures", () => {
  test("GOOD RECORD: every cited id is in the bibliography", () => {
    const fixture = loadJson<{ defined: string[]; uses: { from: string; citationId: string }[] }>(
      "citations.ok.json",
    );
    const report = auditCitationsResolve(new Set(fixture.defined), fixture.uses);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
  });

  test("PLANTED: an unresolved citation is rejected by code", () => {
    const fixture = loadJson<{ defined: string[]; uses: { from: string; citationId: string }[] }>(
      "citations.broken.json",
    );
    const report = auditCitationsResolve(new Set(fixture.defined), fixture.uses);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("citation-unresolved");
    expect(report.findings.some((f) => f.recordId === "arg-planted")).toBe(true);
    expect(report.findings.some((f) => f.recordId === "arg-bm-observable")).toBe(false);
  });
});

describe("auditQuantityIdsRegistered: paired ok/broken fixtures", () => {
  test("GOOD RECORD: every bound quantity id is registered", () => {
    const fixture = loadJson<{
      registered: string[];
      uses: { from: string; quantityId: string }[];
    }>("quantities.ok.json");
    const report = auditQuantityIdsRegistered(new Set(fixture.registered), fixture.uses);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
  });

  test("PLANTED: an unregistered quantity id is rejected by code", () => {
    const fixture = loadJson<{
      registered: string[];
      uses: { from: string; quantityId: string }[];
    }>("quantities.broken.json");
    const report = auditQuantityIdsRegistered(new Set(fixture.registered), fixture.uses);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("quantity-unregistered");
  });
});

describe("auditEquationBlocksIdentical: paired ok/broken fixtures", () => {
  test("GOOD RECORD: German and English equation blocks are byte-identical", () => {
    const report = auditEquationBlocksIdentical(loadJson<EquationPair[]>("equations.ok.json"));
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
  });

  test("PLANTED: a paraphrased English equation block is rejected by code", () => {
    const report = auditEquationBlocksIdentical(loadJson<EquationPair[]>("equations.broken.json"));
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("equation-not-identical");
  });
});

afterAll(async () => {
  await logger.flush();
});
