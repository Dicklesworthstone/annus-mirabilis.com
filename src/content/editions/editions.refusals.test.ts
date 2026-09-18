/**
 * Refusal site coverage for src/content/editions (am-muyh).
 *
 * Covers 10 refusal sites across three files in src/content/editions/:
 * - segmentSentences.ts (2 sites):
 *   1. (segmentSentences.ts:195) non-contiguous-segmentation (dropped middle text)
 *   2. (segmentSentences.ts:210) non-contiguous-segmentation (dropped trailing text)
 * - editionDeclaration.ts (4 sites):
 *   3. (editionDeclaration.ts:48) unknown-paper
 *   4. (editionDeclaration.ts:53) bib-key-mismatch
 *   5. (editionDeclaration.ts:77) unknown-editor
 *   6. (editionDeclaration.ts:84) missing-reconciliation-run
 * - brownianInventory.ts (4 sites):
 *   7. (brownianInventory.ts:246) invented-source-units
 *   8. (brownianInventory.ts:252) ids-frozen-without-facsimile
 *   9. (brownianInventory.ts:258) aliases-not-empty
 *   10. (brownianInventory.ts:264) paper-overclaimed
 */

import assert from "node:assert/strict";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import {
  InventoryHonestyError,
  loadBrownianInventory,
} from "./brownianInventory.ts";
import { validateEditionDeclaration } from "./editionDeclaration.ts";
import { validateSegmentation } from "./segmentSentences.ts";

function createTempBrownianFixture(): string {
  const base = "/Volumes/USBNVME16TB/temp_agent_space";
  const tempRoot = join(
    base,
    `bm-inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  mkdirSync(join(tempRoot, "docs/provenance"), { recursive: true });
  mkdirSync(join(tempRoot, "public/papers/pdfs"), { recursive: true });
  mkdirSync(join(tempRoot, "content/papers"), { recursive: true });
  mkdirSync(join(tempRoot, "content/arguments/brownian-motion"), { recursive: true });
  mkdirSync(join(tempRoot, "content/equations/brownian-motion"), { recursive: true });
  mkdirSync(join(tempRoot, "content/source-blocks/brownian-motion"), { recursive: true });
  mkdirSync(join(tempRoot, "content/aliases"), { recursive: true });
  mkdirSync(join(tempRoot, "docs/editorial"), { recursive: true });

  cpSync("docs/provenance/ap-17-549.md", join(tempRoot, "docs/provenance/ap-17-549.md"));
  cpSync("public/papers/pdfs/ap-17-549.pdf", join(tempRoot, "public/papers/pdfs/ap-17-549.pdf"));
  cpSync("content/papers/brownian-motion.json", join(tempRoot, "content/papers/brownian-motion.json"));
  cpSync(
    "content/source-blocks/brownian-motion/manifest.yaml",
    join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml"),
  );
  cpSync(
    "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
    join(tempRoot, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
  );
  cpSync("content/aliases/brownian-motion.yaml", join(tempRoot, "content/aliases/brownian-motion.yaml"));
  cpSync(
    "docs/editorial/brownian-motion-difficulties.md",
    join(tempRoot, "docs/editorial/brownian-motion-difficulties.md"),
  );

  return tempRoot;
}

describe("Editions Refusal Sites", () => {
  // ==========================================
  // segmentSentences.ts (2 sites)
  // ==========================================
  describe("segmentSentences.ts refusal sites", () => {
    // 1. (segmentSentences.ts:195) non-contiguous-segmentation (gap in middle)
    describe("Site (segmentSentences.ts:195): non-contiguous-segmentation (gap in middle)", () => {
      it("reports non-contiguous-segmentation when text between segments is dropped (segmentSentences.ts:195)", () => {
        // "Hello dropped world." -> segment 1 is "Hello", segment 2 is "world." ("dropped " is omitted)
        const text = "Hello dropped world.";
        const segments = [
          { id: "s1", start: 0, end: 5 },
          { id: "s2", start: 14, end: 20 },
        ];
        const issues = validateSegmentation(text, segments);
        const issue = issues.find(
          (i) => i.code === "non-contiguous-segmentation" && i.message.includes("was dropped"),
        );
        assert.ok(issue !== undefined);
        assert.equal(issue.code, "non-contiguous-segmentation");
        assert.ok(issue.message.includes("dropped"));
      });

      it("accepts contiguous segmentation without middle gap (segmentSentences.ts:195)", () => {
        const text = "Hello world.";
        const segments = [
          { id: "s1", start: 0, end: 5 },
          { id: "s2", start: 6, end: 12 },
        ];
        const issues = validateSegmentation(text, segments);
        assert.ok(
          !issues.some(
            (i) => i.code === "non-contiguous-segmentation" && i.message.includes("was dropped"),
          ),
        );
      });
    });

    // 2. (segmentSentences.ts:210) non-contiguous-segmentation (trailing text dropped)
    describe("Site (segmentSentences.ts:210): non-contiguous-segmentation (trailing text)", () => {
      it("reports non-contiguous-segmentation when trailing text after last segment is dropped (segmentSentences.ts:210)", () => {
        const text = "Hello world extra.";
        const segments = [{ id: "s1", start: 0, end: 11 }];
        const issues = validateSegmentation(text, segments);
        const issue = issues.find(
          (i) =>
            i.code === "non-contiguous-segmentation" &&
            i.message.includes("trailing text was dropped"),
        );
        assert.ok(issue !== undefined);
        assert.equal(issue.code, "non-contiguous-segmentation");
        assert.ok(issue.message.includes("extra."));
      });

      it("accepts segmentation covering entire string to the end (segmentSentences.ts:210)", () => {
        const text = "Hello world.";
        const segments = [{ id: "s1", start: 0, end: 12 }];
        const issues = validateSegmentation(text, segments);
        assert.ok(
          !issues.some(
            (i) =>
              i.code === "non-contiguous-segmentation" &&
              i.message.includes("trailing text was dropped"),
          ),
        );
      });
    });
  });

  // ==========================================
  // editionDeclaration.ts (4 sites)
  // ==========================================
  describe("editionDeclaration.ts refusal sites", () => {
    function createValidDeclaration(): Record<string, unknown> {
      return {
        paper: "brownian-motion",
        bibliographicKey: "ap-17-549",
        facsimileDigest: "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f",
        ledgerDigest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        editors: ["ed-albert"],
        reconciliationRunId: "run-2026-09-18",
      };
    }

    // 3. (editionDeclaration.ts:48) unknown-paper
    describe("Site (editionDeclaration.ts:48): unknown-paper", () => {
      it("reports unknown-paper when paper slug is unrecognized (editionDeclaration.ts:48)", () => {
        const raw = { ...createValidDeclaration(), paper: "unknown-paper-slug" };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "unknown-paper"));
      });

      it("accepts known paper slug (editionDeclaration.ts:48)", () => {
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw);
        assert.ok(!res.issues.some((i) => i.code === "unknown-paper"));
      });
    });

    // 4. (editionDeclaration.ts:53) bib-key-mismatch
    describe("Site (editionDeclaration.ts:53): bib-key-mismatch", () => {
      it("reports bib-key-mismatch when bibliographicKey does not match paper (editionDeclaration.ts:53)", () => {
        const raw = { ...createValidDeclaration(), bibliographicKey: "ap-17-132" }; // brownian expects ap-17-549
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "bib-key-mismatch"));
      });

      it("accepts bibliographicKey matching paper bib key (editionDeclaration.ts:53)", () => {
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw);
        assert.ok(!res.issues.some((i) => i.code === "bib-key-mismatch"));
      });
    });

    // 5. (editionDeclaration.ts:77) unknown-editor
    describe("Site (editionDeclaration.ts:77): unknown-editor", () => {
      it("reports unknown-editor when human editor fails editor ID pattern (editionDeclaration.ts:77)", () => {
        const raw = { ...createValidDeclaration(), editors: ["invalid!editor?name"] };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "unknown-editor"));
      });

      it("accepts recognized human editor identifier (editionDeclaration.ts:77)", () => {
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw);
        assert.ok(!res.issues.some((i) => i.code === "unknown-editor"));
      });
    });

    // 6. (editionDeclaration.ts:84) missing-reconciliation-run
    describe("Site (editionDeclaration.ts:84): missing-reconciliation-run", () => {
      it("reports missing-reconciliation-run when reconciliationRunId is empty string or non-string (editionDeclaration.ts:84)", () => {
        const raw = { ...createValidDeclaration(), reconciliationRunId: "" };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "missing-reconciliation-run"));
      });

      it("accepts valid non-empty reconciliationRunId (editionDeclaration.ts:84)", () => {
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw);
        assert.ok(!res.issues.some((i) => i.code === "missing-reconciliation-run"));
      });
    });
  });

  // ==========================================
  // brownianInventory.ts (4 sites)
  // ==========================================
  describe("brownianInventory.ts refusal sites", () => {
    // 7. (brownianInventory.ts:246) invented-source-units
    describe("Site (brownianInventory.ts:246): invented-source-units", () => {
      it("throws invented-source-units when source units are present without pinned facsimile (brownianInventory.ts:246)", () => {
        const tempRoot = createTempBrownianFixture();

        // Break the facsimile receipt so facsimilePinned is false
        const receiptPath = join(tempRoot, "docs/provenance/ap-17-549.md");
        writeFileSync(receiptPath, "sha256: 0000000000000000000000000000000000000000000000000000000000000000\n");

        // Add units to manifest
        const manifestPath = join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml");
        const manifestWithUnits = {
          paper: "brownian-motion",
          document: "ap-17-549",
          status: "in-preparation",
          pageCount: 12,
          pageRange: [549, 560],
          units: [
            {
              id: "bm-s1-p1",
              kind: "paragraph",
              locators: [{ page: 549 }],
            },
          ],
        };
        writeFileSync(manifestPath, yaml.dump(manifestWithUnits));

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "invented-source-units");
            assert.ok(err.message.includes("Invented units are not admitted"));
            return true;
          },
        );
      });

      it("does not throw invented-source-units when units array is empty without pinned facsimile (brownianInventory.ts:246)", () => {
        const tempRoot = createTempBrownianFixture();
        // Default fixture has empty units in manifest
        const inv = loadBrownianInventory(tempRoot);
        assert.ok(inv !== undefined);
        assert.equal(inv.paper, "brownian-motion");
      });
    });

    // 8. (brownianInventory.ts:252) ids-frozen-without-facsimile
    describe("Site (brownianInventory.ts:252): ids-frozen-without-facsimile", () => {
      it("throws ids-frozen-without-facsimile when idsFrozenAt or snapshotIds are set (brownianInventory.ts:252)", () => {
        const tempRoot = createTempBrownianFixture();

        // Populate snapshotIds file
        const snapshotPath = join(
          tempRoot,
          "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
        );
        writeFileSync(snapshotPath, "bm-s1-p1\nbm-s1-p2\n");

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "ids-frozen-without-facsimile");
            assert.ok(err.message.includes("Source ids cannot freeze"));
            return true;
          },
        );
      });

      it("does not throw ids-frozen-without-facsimile when IDs are not frozen (brownianInventory.ts:252)", () => {
        const tempRoot = createTempBrownianFixture();
        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
      });
    });

    // 9. (brownianInventory.ts:258) aliases-not-empty
    describe("Site (brownianInventory.ts:258): aliases-not-empty", () => {
      it("throws aliases-not-empty when alias file contains alias entries (brownianInventory.ts:258)", () => {
        const tempRoot = createTempBrownianFixture();

        const aliasPath = join(tempRoot, "content/aliases/brownian-motion.yaml");
        const aliasPayload = {
          paper: "brownian-motion",
          aliases: [
            {
              retiredId: "bm-s1-p9",
              kind: "retired",
              replacementIds: ["bm-s1-p8"],
              reason: "Pre-freeze alias",
              editor: "ed-albert",
              date: "2026-09-18",
            },
          ],
        };
        writeFileSync(aliasPath, yaml.dump(aliasPayload));

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "aliases-not-empty");
            assert.ok(err.message.includes("alias file must stay empty"));
            return true;
          },
        );
      });

      it("does not throw aliases-not-empty when alias file is empty (brownianInventory.ts:258)", () => {
        const tempRoot = createTempBrownianFixture();
        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
      });
    });

    // 10. (brownianInventory.ts:264) paper-overclaimed
    describe("Site (brownianInventory.ts:264): paper-overclaimed", () => {
      it("throws paper-overclaimed when paper status is not explanation-preview (brownianInventory.ts:264)", () => {
        const tempRoot = createTempBrownianFixture();

        const paperPath = join(tempRoot, "content/papers/brownian-motion.json");
        const paperObj = {
          slug: "brownian-motion",
          title: "Brownian Motion",
          status: "complete", // Overclaimed status!
          sourceStatus: "in-preparation",
        };
        writeFileSync(paperPath, JSON.stringify(paperObj, null, 2));

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "paper-overclaimed");
            assert.ok(err.message.includes("Paper status is complete"));
            return true;
          },
        );
      });

      it("does not throw paper-overclaimed when status is explanation-preview / in-preparation (brownianInventory.ts:264)", () => {
        const tempRoot = createTempBrownianFixture();
        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
      });
    });
  });
});
