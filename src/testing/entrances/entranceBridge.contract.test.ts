import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { scanSkillSymbols } from "../../content/entrances/symbolGuard.ts";
import { ENTRANCE_PAPER_SLUGS } from "../../content/ids.ts";
import { CATALOGUE_IDS } from "../../experiments/catalogue.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Bridge Cross-Paper Contract (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  // Slugs of entrance beads that have landed in the repository
  const LANDED_ENTRANCE_SLUGS = new Set<string>(["brownian-motion", "mass-energy"]);

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

      // Verify no-symbol rule on newSkill (AC 12 cross-paper check)
      expect(record.bridge.newSkill).toBeDefined();
      if (!record.bridge.newSkill) throw new Error("newSkill is required on bridge");
      const symbolScan = scanSkillSymbols(record.bridge.newSkill);
      expect(symbolScan.ok).toBe(true);

      // Verify every continueWith target resolves to a known foundation or instrument (AC 11)
      for (const route of record.bridge.continueWith ?? []) {
        const target = route.targetId;
        expect(target).toBeDefined();
        if (target.startsWith("foundation:")) {
          const foundationSlug = target.slice("foundation:".length);
          const foundationJson = resolve(
            process.cwd(),
            `content/foundations/${foundationSlug}.json`,
          );
          const registryYaml = resolve(process.cwd(), `content/foundations/registry.yaml`);
          const fileExists = existsSync(foundationJson);
          const registered =
            existsSync(registryYaml) && readFileSync(registryYaml, "utf-8").includes(target);
          expect(fileExists || registered).toBe(true);
        } else if (target.startsWith("instrument:")) {
          const instrumentId = target.slice("instrument:".length);
          expect((CATALOGUE_IDS as readonly string[]).includes(instrumentId)).toBe(true);
        } else {
          expect(target.length).toBeGreaterThan(0);
        }
      }

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
          targetResolution: "resolved",
        },
      });
    });
  }
});
