import { describe, expect, it } from "bun:test";
import {
  anchorForSourceId,
  entranceForEntryAnchor,
  entryAnchorForEntrance,
  equationAnchorForRecord,
  equationRecordForAnchor,
  parseAnchor,
} from "../content/anchors.ts";
import { ENTRANCE_PAPER_SLUGS } from "../content/ids.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

describe("Anchors and Mappings", () => {
  const logger = new TestLogger("content-ids", newRunIdentity());

  it("round-trips equation records and anchors across papers", () => {
    const recordId = "eq-bm-s3-d4";
    const anchor = equationAnchorForRecord(recordId);
    expect(anchor).toBe("#eq-s3-d4");

    const backRecord = equationRecordForAnchor("bm", anchor);
    expect(backRecord).toBe(recordId);

    // The same anchor in a different paper maps to a different record ID
    const srRecord = equationRecordForAnchor("sr", anchor);
    expect(srRecord).toBe("eq-sr-s3-d4");
    expect(srRecord).not.toBe(recordId);

    logger.log({
      testId: "equation-anchor-roundtrip",
      beadId: "am-cm-id-scheme-8bn",
      expected: recordId,
      actual: backRecord,
      comparisonKind: "bitwise",
      outcome: "passed",
      extra: { anchor, srRecord, rule: "equation-record-anchor-bijection" },
    });
  });

  it("round-trips entrance IDs and entry anchors for all four papers", () => {
    for (const slug of ENTRANCE_PAPER_SLUGS) {
      const entranceId = `entrance-${slug}`;
      const entryAnchor = entryAnchorForEntrance(entranceId);
      expect(entryAnchor).toBe(`#entry-${slug}`);

      const resolvedEntrance = entranceForEntryAnchor(entryAnchor);
      expect(resolvedEntrance).toBe(entranceId);
    }
  });

  it("resolves valid anchors including #s3, #closing-received, and #lab-avogadro-lab", () => {
    const s3 = parseAnchor("#s3");
    expect(s3.ok).toBe(true);
    if (s3.ok) expect(s3.value.kind).toBe("section");

    const closing = parseAnchor("#closing-received");
    expect(closing.ok).toBe(true);
    if (closing.ok) expect(closing.value.kind).toBe("closing");

    const lab = parseAnchor("#lab-avogadro-lab");
    expect(lab.ok).toBe(true);
    if (lab.ok) expect(lab.value.targetId).toBe("avogadro-lab");
  });

  it("rejects retired anchor forms with descriptive messages", () => {
    const bareEntrance = parseAnchor("#entrance");
    expect(bareEntrance.ok).toBe(false);
    if (!bareEntrance.ok) {
      expect(bareEntrance.error).toContain("entry-");
    }

    const retiredHeading = parseAnchor("#s3-h");
    expect(retiredHeading.ok).toBe(false);
    if (!retiredHeading.ok) {
      expect(retiredHeading.error).toContain("#s3");
    }

    const retiredFnSentence = parseAnchor("#s3-fn1-s1");
    expect(retiredFnSentence.ok).toBe(false);
  });

  it("ensures every generated anchor is a valid URL fragment without percent-encoding", () => {
    const anchors = [
      anchorForSourceId("s3-p2-s1"),
      equationAnchorForRecord("eq-sr-s3-1"),
      entryAnchorForEntrance("entrance-special-relativity"),
      "#result-lorentz-transformation",
      "#card-rayleigh-1900-radiation-law",
    ];

    for (const a of anchors) {
      expect(encodeURIComponent(a.slice(1))).toBe(a.slice(1));
    }
  });
});
