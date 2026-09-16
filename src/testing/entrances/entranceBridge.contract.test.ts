import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { ENTRANCE_PAPER_SLUGS } from "../../content/ids.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Bridge Cross-Paper Contract (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  // Slugs of entrance beads that have landed in the repository
  const LANDED_ENTRANCE_SLUGS = new Set<string>(["brownian-motion"]);

  for (const slug of ENTRANCE_PAPER_SLUGS) {
    const isLanded = LANDED_ENTRANCE_SLUGS.has(slug);

    it(`entrance contract for '${slug}' (${isLanded ? "landed" : "planned / pending"})`, () => {
      const start = performance.now();
      const possiblePaths = [
        resolve(process.cwd(), `content/arguments/${slug}/entrance-${slug}.json`),
        resolve(process.cwd(), `content/entrances/entrance-${slug}.json`),
        resolve(process.cwd(), `content/entrances/${slug}.json`),
      ];

      const foundPath = possiblePaths.find((p) => existsSync(p));

      if (!isLanded) {
        // Skip planned entrances by id without guessing missing files
        logger.log({
          testId: `entrance-contract-${slug}`,
          beadId: BEAD_ID,
          expected: `entrance-${slug}`,
          actual: "planned",
          outcome: "skipped",
          durationMs: performance.now() - start,
          comparisonKind: "bitwise",
          message: `Entrance for '${slug}' is planned in a future bead.`,
        });
        return;
      }

      expect(foundPath).toBeDefined();
      if (!foundPath) return;

      const raw = JSON.parse(readFileSync(foundPath, "utf-8"));
      const record = validateEntranceRecord(raw, foundPath);

      expect(record.id).toBe(`entrance-${slug}`);
      expect(record.paper).toBe(slug);
      expect(record.bridge).toBeDefined();
      expect(record.bridge.kind).toBe("bridge");
      expect(record.bridge.newSkill).toBeDefined();
      expect(record.bridge.whyUsefulHere).toBeDefined();
      expect(record.bridge.continueWith?.length).toBeGreaterThanOrEqual(2);

      const hasMore = record.bridge.continueWith?.some((r) => r.route === "more-guidance");
      const hasLess = record.bridge.continueWith?.some((r) => r.route === "less-guidance");
      expect(hasMore).toBe(true);
      expect(hasLess).toBe(true);

      logger.log({
        testId: `entrance-contract-${slug}`,
        beadId: BEAD_ID,
        expected: `entrance-${slug}`,
        actual: record.id,
        outcome: "passed",
        durationMs: performance.now() - start,
        comparisonKind: "bitwise",
        extra: {
          recordId: record.id,
          paper: slug,
          continueWithCount: record.bridge.continueWith?.length,
        },
      });
    });
  }
});
