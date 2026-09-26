import { describe, expect, test } from "bun:test";
import { isCardVerified } from "./publicationGate.ts";
import { claimsVerification } from "./shelfPublication.ts";
import { sourceCheckProblems, uncheckedSources } from "./sourceChecks.ts";
import type { KnowledgeCard, SourceCheck } from "./types.ts";

const check: SourceCheck = {
  source: 0,
  checkedBy: "agent:Tester",
  checkedOn: "2026-09-26",
  url: "https://api.crossref.org/works/10.1002/andp.18552700102",
  read: "catalog-record",
  matched: "Title, author, journal, volume 94, first page 59 and year 1855.",
};
const card: KnowledgeCard = {
  id: "fixture-card",
  proposition: "A proposition for the checks' own test.",
  status: "available",
  sources: [{ title: "Ann. Phys. (Pogg.) 94", locator: "p. 59", date: "1855" }, "A second source"],
  date: { earliest: "1855", latest: "1855", precision: "year", latestYear: 1855 },
  sourceChecks: [check],
};
const withCheck = (c: Record<string, unknown>) =>
  ({ ...card, sourceChecks: [{ ...check, ...c }] }) as unknown as KnowledgeCard;

describe("a card's source checks", () => {
  test("a well-formed check passes, and a card without checks has nothing malformed", () => {
    expect(sourceCheckProblems(card)).toEqual([]);
    expect(sourceCheckProblems({ ...card, sourceChecks: undefined })).toEqual([]);
  });

  test("each malformed field is refused, each by its own sentence", () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ source: 2 }, /source must index/],
      [{ source: -1 }, /source must index/],
      [{ source: 0.5 }, /source must index/],
      [{ checkedBy: "SapphireCastle" }, /checkedBy must be an agent id/],
      // A person's check belongs in `verification`, never here.
      [{ checkedBy: "human:A Reviewer" }, /checkedBy must be an agent id/],
      [{ checkedOn: "26 September 2026" }, /checkedOn must be a day/],
      [{ checkedOn: "2026-13-01" }, /checkedOn must be a day/],
      [{ url: "http://example.org/scan" }, /url must be the https address/],
      [{ url: "" }, /url must be the https address/],
      [{ read: "text-layer" }, /read must be one of page-image, catalog-record/],
      [{ matched: "   " }, /matched must say/],
      [{ differs: ["", "ok"] }, /differs must be a list of sentences/],
    ];
    for (const [change, expected] of cases) {
      const problems = sourceCheckProblems(withCheck(change));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(expected);
    }
    expect(
      sourceCheckProblems({ ...card, sourceChecks: "no" } as unknown as KnowledgeCard),
    ).toEqual(["fixture-card: sourceChecks must be a list."]);
  });

  test("a source with no check is listed, and one check covers only its own source", () => {
    expect(uncheckedSources(card)).toEqual([1]);
    expect(uncheckedSources({ ...card, sourceChecks: undefined })).toEqual([0, 1]);
    expect(uncheckedSources({ ...card, sourceChecks: [check, { ...check, source: 1 }] })).toEqual(
      [],
    );
  });

  test("checks are evidence, not verification: the publication gate's record is untouched", () => {
    // A card with checks and no `verification` is still unverified, and claims no record.
    expect(isCardVerified(card)).toBe(false);
    expect(claimsVerification(card)).toBe(false);
  });
});
