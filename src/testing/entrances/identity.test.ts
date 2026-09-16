import { afterAll, describe, expect, it } from "bun:test";
import {
  entranceForEntryAnchor,
  entryAnchorForEntrance,
  parseAnchor,
} from "../../content/anchors.ts";
import {
  paperSlugToEntranceId,
  paperSlugToEntryAnchor,
} from "../../content/entrances/entranceRecord.ts";
import { ENTRANCE_PAPER_SLUGS, type EntranceId, parseEntranceId } from "../../content/ids.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Identity & Anchor Inversion Contract (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  it("round-trips the Brownian motion entrance record ID and entry anchor", () => {
    const start = performance.now();
    const entranceId = "entrance-brownian-motion" as EntranceId;
    const expectedAnchor = "#entry-brownian-motion";

    const derivedAnchor = entryAnchorForEntrance(entranceId);
    expect(derivedAnchor).toBe(expectedAnchor);

    const recoveredEntranceId = entranceForEntryAnchor(derivedAnchor);
    expect(recoveredEntranceId).toBe(entranceId);

    // Helpers from entranceRecord
    expect(paperSlugToEntranceId("brownian-motion")).toBe(entranceId);
    expect(paperSlugToEntryAnchor("brownian-motion")).toBe(expectedAnchor);

    logger.log({
      testId: "entrance-identity-roundtrip-brownian",
      beadId: BEAD_ID,
      expected: { anchor: expectedAnchor, entranceId },
      actual: { derivedAnchor, recoveredEntranceId },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        paper: "brownian-motion",
        anchor: expectedAnchor,
        recordId: entranceId,
      },
    });
  });

  it("round-trips all four main entrance record IDs and entry anchors", () => {
    for (const slug of ENTRANCE_PAPER_SLUGS) {
      const entranceId = `entrance-${slug}` as EntranceId;
      const anchor = `#entry-${slug}`;

      expect(entryAnchorForEntrance(entranceId)).toBe(anchor);
      expect(entranceForEntryAnchor(anchor)).toBe(entranceId);
      expect(paperSlugToEntranceId(slug)).toBe(entranceId);
      expect(paperSlugToEntryAnchor(slug)).toBe(anchor);

      const parsedAnchor = parseAnchor(anchor);
      expect(parsedAnchor.ok).toBe(true);
      if (parsedAnchor.ok) {
        expect(parsedAnchor.value.kind).toBe("entry");
        expect(parsedAnchor.value.targetId).toBe(entranceId);
      }
    }
  });

  it("rejects invalid shorthand entrance record ID (e.g. 'entrance-brownian')", () => {
    const res = parseEntranceId("entrance-brownian");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("entrance-id-grammar");
      expect(res.error).toContain("must be 'entrance-<paperSlug>' for one of the four main papers");
    }

    expect(() => entryAnchorForEntrance("entrance-brownian")).toThrow(
      /Cannot derive entry anchor from invalid entrance ID 'entrance-brownian'/,
    );
  });

  it("rejects invalid shorthand entry anchor (e.g. '#entry-brownian')", () => {
    const res = parseAnchor("#entry-brownian");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("entry-anchor-grammar");
      expect(res.error).toContain("target slug must be one of");
    }

    expect(() => entranceForEntryAnchor("#entry-brownian")).toThrow(
      /must be '#entry-<paper-slug>' for one of the four main papers/,
    );
  });

  it("rejects retired bare anchors '#entrance' and '#entry'", () => {
    expect(() => entranceForEntryAnchor("#entrance")).toThrow(/Retired bare anchor/);
    expect(() => entranceForEntryAnchor("#entry")).toThrow(/Retired bare anchor/);

    const parsedEntrance = parseAnchor("#entrance");
    expect(parsedEntrance.ok).toBe(false);
    if (!parsedEntrance.ok) {
      expect(parsedEntrance.rule).toBe("retired-entrance-anchor");
    }

    const parsedEntry = parseAnchor("#entry");
    expect(parsedEntry.ok).toBe(false);
    if (!parsedEntry.ok) {
      expect(parsedEntry.rule).toBe("retired-entrance-anchor");
    }
  });
});
