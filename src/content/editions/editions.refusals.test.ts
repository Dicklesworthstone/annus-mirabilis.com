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
 *   8. (brownianInventory.ts:301) ids-frozen-without-facsimile
 *   9. (brownianInventory.ts) alias admission: legitimate retirement vs defect
 *   10. (brownianInventory.ts:264) paper-overclaimed
 */

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import {
  admitAliasRecords,
  brownianPageMapMismatches,
  InventoryHonestyError,
  loadBrownianInventory,
  type PageMapMismatch,
  verifyBrownianFacsimilePin,
} from "./brownianInventory.ts";
import { validateEditionDeclaration } from "./editionDeclaration.ts";
import { validateSegmentation } from "./segmentSentences.ts";

function createTempBrownianFixture(): string {
  // am-yhus: mkdtempSync under the OS temp dir, so this runs the same everywhere.
  const tempRoot = mkdtempSync(join(tmpdir(), "bm-inventory-"));

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
  cpSync(
    "content/papers/brownian-motion.json",
    join(tempRoot, "content/papers/brownian-motion.json"),
  );
  cpSync(
    "content/source-blocks/brownian-motion/manifest.yaml",
    join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml"),
  );
  cpSync(
    "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt",
    join(tempRoot, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
  );
  cpSync(
    "content/aliases/brownian-motion.yaml",
    join(tempRoot, "content/aliases/brownian-motion.yaml"),
  );
  cpSync(
    "docs/editorial/brownian-motion-difficulties.md",
    join(tempRoot, "docs/editorial/brownian-motion-difficulties.md"),
  );

  return tempRoot;
}

const BROWNIAN_RECEIPT_REL = "docs/provenance/ap-17-549.md";

/**
 * Replaces the top-level `pageMap:` block of a fixture's pinned receipt.
 *
 * `null` removes the key outright; a string is spliced in where the block was.
 * Textual rather than a YAML round trip, because the receipt is read back by
 * the project's own restricted parser and a re-dump would change far more of
 * the file than the one key under test.
 */
function rewriteReceiptPageMap(tempRoot: string, replacement: string | null): void {
  const receiptPath = join(tempRoot, BROWNIAN_RECEIPT_REL);
  const lines = readFileSync(receiptPath, "utf8").split("\n");
  const start = lines.indexOf("pageMap:");
  assert.notEqual(start, -1, "the fixture receipt must carry a pageMap block to rewrite");
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end] ?? "";
    // The block runs to the next top-level key, or to the end of the front matter.
    if (line === "---" || /^[A-Za-z][A-Za-z0-9_-]*:/.test(line)) break;
    end += 1;
  }
  const spliced = replacement === null ? [] : replacement.split("\n");
  writeFileSync(
    receiptPath,
    [...lines.slice(0, start), ...spliced, ...lines.slice(end)].join("\n"),
  );
}

/** What the fixture receipt's front matter actually parses `pageMap` to. */
function receiptPageMap(tempRoot: string): unknown {
  const receiptPath = join(tempRoot, BROWNIAN_RECEIPT_REL);
  return parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath).frontMatter?.pageMap;
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
        // A human who is actually assigned in docs/OWNERS.md. This fixture said
        // "ed-albert", who is in no registry; the validator only checked spelling, so
        // the surrounding test could call that id "recognized" without anything
        // recognizing it.
        editors: ["jemanuel"],
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

      it("accepts a human editor who is assigned in docs/OWNERS.md (editionDeclaration.ts:77)", () => {
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw);
        assert.ok(!res.issues.some((i) => i.code === "unknown-editor"));
      });

      it("reports unknown-editor for a well-formed id that is in no registry", () => {
        // The historical fixture. It spells like an id and belongs to nobody.
        const raw = { ...createValidDeclaration(), editors: ["ed-albert"] };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "unknown-editor"));
        assert.ok(res.issues.some((i) => i.message.includes("docs/OWNERS.md")));
      });

      it("reports editor-not-assigned for an unfilled recruiting slot", () => {
        // Listed in OWNERS.md, and not a person: status "open: recruiting".
        const raw = {
          ...createValidDeclaration(),
          editors: ["open-german-source-brownian-motion"],
        };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "editor-not-assigned"));
        // Presence in the registry is not enough, and the message says which rule bit.
        assert.ok(!res.issues.some((i) => i.code === "unknown-editor"));
      });

      it("also reports model-only-editors when the list's only human is an unfilled slot", () => {
        // The second emit site of that code. The first says "this list is all models";
        // this one says "this list names no human the registry can vouch for", which an
        // unfilled recruiting slot is. Both are the section D rule that a declaration
        // carries at least one human editor, and a declaration that reported only the
        // per-editor issue would leave the list looking one repair away from valid.
        const raw = {
          ...createValidDeclaration(),
          editors: ["open-german-source-brownian-motion"],
        };
        const res = validateEditionDeclaration(raw);
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "model-only-editors"));
        assert.ok(res.issues.some((i) => i.code === "editor-not-assigned"));
      });

      it("reports owners-registry-unavailable rather than passing when OWNERS.md cannot be read", () => {
        // An unreadable registry must not restore the permissive behaviour: a check
        // that could not look has not looked.
        const raw = createValidDeclaration();
        const res = validateEditionDeclaration(raw, { repoRoot: "/nonexistent/repo/root" });
        assert.equal(res.ok, false);
        assert.ok(res.issues.some((i) => i.code === "owners-registry-unavailable"));
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
        writeFileSync(
          receiptPath,
          "sha256: 0000000000000000000000000000000000000000000000000000000000000000\n",
        );

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

    // 8. (brownianInventory.ts:301) ids-frozen-without-facsimile
    //
    // The premise moved under this test and it has been red since. When it was
    // written the guard was unconditional - `if (manifest.idsFrozenAt ||
    // snapshotIds.length > 0)` - so populating the snapshot alone refused,
    // whatever the facsimile's state, despite both the code name and the
    // message saying "without facsimile". 760407b7 narrowed it with
    // `&& !facsimilePinned`, in the same commit that froze the real manifest's
    // ids and filled the real id snapshot; it had to, because the unconditional
    // version would refuse the live inventory outright from that commit on. The
    // test kept the old expectation, and since the fixture copies the real
    // pinned PDF the second conjunct is false and the site is unreachable
    // from it.
    //
    // Repaired here rather than in brownianInventory.ts. The narrowing was
    // right and nothing below relaxes it: the fixture is driven to the state
    // the guard actually names, frozen ids meeting an unpinned facsimile.
    describe("Site (brownianInventory.ts:301): ids-frozen-without-facsimile", () => {
      /**
       * Breaks a fixture's facsimile pin by digest mismatch.
       *
       * The receipt keeps its pinned `scan.sha256` and the PDF's bytes change,
       * which the verifier reports as `digest-mismatch`. Nothing is removed: an
       * absent PDF is a different typed failure, and using it would leave which
       * one these tests drive in doubt.
       */
      const unpinFacsimile = (tempRoot: string): void => {
        writeFileSync(
          join(tempRoot, "public/papers/pdfs/ap-17-549.pdf"),
          "%PDF-1.4 not the pinned scan\n",
        );
        const verification = verifyBrownianFacsimilePin(tempRoot);
        assert.equal(verification.pinned, false);
        assert.equal(verification.failure?.kind, "digest-mismatch");
      };

      /** Empties the manifest's units, keeping `idsFrozenAt` as the fixture has it. */
      const emptyUnits = (tempRoot: string): void => {
        const manifestPath = join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml");
        const manifest = yaml.load(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
        assert.ok(
          manifest.idsFrozenAt,
          "the fixture manifest must be frozen, or there is nothing frozen to refuse",
        );
        writeFileSync(manifestPath, yaml.dump({ ...manifest, units: [] }));
      };

      it("throws ids-frozen-without-facsimile when frozen ids meet an unpinned facsimile (brownianInventory.ts:301)", () => {
        const tempRoot = createTempBrownianFixture();
        // The units must be empty, or `invented-source-units` - which sits
        // above this guard and shares the !facsimilePinned conjunct - answers
        // first and this arm would credit the wrong site.
        emptyUnits(tempRoot);
        unpinFacsimile(tempRoot);

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

      // The discriminator. Same frozen manifest, same emptied units, pin left
      // intact: a different site answers. So it is the missing pin that selects
      // this refusal and not the emptied units, and an implementation that
      // dropped the `!facsimilePinned` conjunct again would fail here.
      it("answers ids-frozen-without-units, not ids-frozen-without-facsimile, while the pin holds (brownianInventory.ts:301)", () => {
        const tempRoot = createTempBrownianFixture();
        emptyUnits(tempRoot);
        assert.equal(verifyBrownianFacsimilePin(tempRoot).pinned, true);

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "ids-frozen-without-units");
            return true;
          },
        );
      });

      // The accept arm, renamed to what it now demonstrates. Its old name said
      // "when IDs are not frozen", which stopped being true at 760407b7: the
      // fixture's ids ARE frozen and its snapshot IS populated today, and the
      // reason nothing is refused is that the facsimile is pinned. A green arm
      // whose stated premise is false proves nothing about the guard.
      it("admits frozen ids while the facsimile is pinned (brownianInventory.ts:301)", () => {
        const tempRoot = createTempBrownianFixture();
        const manifestPath = join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml");
        const manifest = yaml.load(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
        assert.ok(manifest.idsFrozenAt, "the fixture's ids must be frozen, or this admits nothing");
        const snapshot = readFileSync(
          join(tempRoot, "content/source-blocks/brownian-motion/manifest.ids.snapshot.txt"),
          "utf8",
        );
        assert.ok(snapshot.trim().length > 0, "the fixture's id snapshot must be populated");
        assert.equal(verifyBrownianFacsimilePin(tempRoot).pinned, true);

        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
        assert.equal(inv.facsimilePinned, true);
      });
    });

    // 9. (brownianInventory.ts) alias admission: a retirement is legitimate, or it is a defect
    //
    // History, because the premise moved twice. The site began as `aliases-not-empty`, which
    // refused ANY entry in the alias file. That was right when written: no alias had ever
    // legitimately existed, so an entry meant the file had been populated by accident, or by
    // a process that should have minted a new id instead. Under am-cm-id-scheme-8bn,
    // retiring a spurious unit by alias is now the PRESCRIBED repair, and with ids frozen and
    // RULE 1 forbidding deletion it is the only one available; pane30 and pane31 have done
    // exactly that, each entry carrying page-image evidence in its reason.
    //
    // A previous pass renamed this describe to aliases-before-freeze but left the assertion
    // demanding `aliases-not-empty`, a code the source can no longer emit, so the test failed
    // while reading as though it had been updated.
    //
    // The refusal is therefore re-expressed, not deleted. What it protected against survives
    // in two halves, both tested here: an alias file populated BEFORE the freeze, when no
    // retirement can be legitimate yet; and an entry lacking the provenance
    // am-cm-id-scheme-8bn requires - a reason, an ISO date, an editor. An entry carrying all
    // three and pointing at a live replacement is admitted.
    describe("Site (brownianInventory.ts): alias admission", () => {
      const legitimate = {
        retiredId: "s2-p6",
        kind: "merged",
        replacementIds: ["s2-p5"],
        reason:
          "Not a printed paragraph; the line is set flush to the margin and resumes s2-p5. Verified on the page image at 260 percent.",
        date: "2026-09-19",
        editor: "agent:pane30 (BrightIsland), am-edn-inventory-brownian-slg",
      };
      const frozen = { idsFrozenAt: "2026-09-19T04:30:00Z", liveIds: ["s2-p5", "s3-p2"] };

      it("admits a retirement carrying a reason, a date and an editor", () => {
        assert.doesNotThrow(() => admitAliasRecords([legitimate], frozen));
      });

      // THE NEGATIVE A NAIVE FIX WOULD FAIL. Deleting this site, or inverting it to accept
      // any alias list, admits an entry that names nobody and gives no reason - an
      // unattributed editorial judgement about which printed paragraphs exist, which is what
      // the original refusal was there to stop. Each field is dropped separately, so a fix
      // that restores only one of the three cannot pass.
      for (const missing of ["reason", "date", "editor"] as const) {
        it(`refuses a retirement with no ${missing}`, () => {
          const record: Record<string, unknown> = { ...legitimate };
          delete record[missing];
          assert.throws(
            () => admitAliasRecords([record], frozen),
            (err: unknown) => {
              assert.ok(err instanceof InventoryHonestyError);
              assert.equal(err.code, "alias-record-invalid");
              assert.ok(
                err.message.includes(missing),
                `the refusal must name the missing field, got: ${err.message}`,
              );
              return true;
            },
          );
        });
      }

      it("refuses a date that is not an ISO calendar date", () => {
        assert.throws(
          () => admitAliasRecords([{ ...legitimate, date: "19 September 2026" }], frozen),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "alias-record-invalid");
            return true;
          },
        );
      });

      // The surviving half of the original premise: before the freeze there is nothing to
      // retire, so an entry means an id was aliased where one should have been minted.
      it("refuses any entry while ids are not yet frozen", () => {
        assert.throws(
          () => admitAliasRecords([legitimate], { liveIds: ["s2-p5"] }),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "aliases-before-freeze");
            return true;
          },
        );
      });

      it("refuses retiring an id that is still live in the manifest", () => {
        assert.throws(
          () => admitAliasRecords([legitimate], { ...frozen, liveIds: ["s2-p5", "s2-p6"] }),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "alias-retired-id-still-live");
            return true;
          },
        );
      });

      it("refuses a replacement that is not a live manifest id", () => {
        assert.throws(
          () => admitAliasRecords([{ ...legitimate, replacementIds: ["s9-p9"] }], frozen),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "alias-replacement-missing");
            return true;
          },
        );
      });

      // End to end, so the wiring is covered and not only the helper. The fixture copies the
      // live alias file, which holds the real retirements, so this asserts that what is
      // actually on disk is admitted - not that an empty file is. The guard above the load
      // is there because the previous version of this test was named for an empty file while
      // silently running against a populated one.
      it("loads the inventory with the real alias file's retirements present", () => {
        const tempRoot = createTempBrownianFixture();
        const aliasRaw = yaml.load(
          readFileSync(join(tempRoot, "content/aliases/brownian-motion.yaml"), "utf8"),
        ) as { aliases?: unknown[] };
        assert.ok(
          (aliasRaw.aliases ?? []).length > 0,
          "this test is meaningless if the fixture's alias file is empty",
        );
        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
      });
    });

    // 10. (brownianInventory.ts:264) paper-overclaimed
    // (brownianInventory.ts:304) ids-frozen-without-units (am-muyh).
    // The last of the five sites ebe6529 added without a test; the refusal
    // ratchet caught all five as a regression against a baseline of 0.
    describe("Site (brownianInventory.ts:304): ids-frozen-without-units", () => {
      it("throws ids-frozen-without-units when the manifest freezes ids over an empty inventory (brownianInventory.ts:304)", () => {
        const tempRoot = createTempBrownianFixture();
        const manifestPath = join(tempRoot, "content/source-blocks/brownian-motion/manifest.yaml");
        const manifest = yaml.load(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
        assert.ok(manifest.idsFrozenAt, "the fixture manifest must already be frozen");
        assert.ok(
          Array.isArray(manifest.units) && manifest.units.length > 0,
          "the fixture manifest must start with units, or this drives nothing",
        );
        writeFileSync(manifestPath, yaml.dump({ ...manifest, units: [] }));

        assert.throws(
          () => loadBrownianInventory(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "ids-frozen-without-units");
            assert.ok(err.message.includes("until units are inventoried"));
            return true;
          },
        );
      });

      it("admits a frozen manifest that actually inventories its units (brownianInventory.ts:304)", () => {
        const tempRoot = createTempBrownianFixture();
        const inv = loadBrownianInventory(tempRoot);
        assert.equal(inv.paper, "brownian-motion");
      });
    });

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

    // 11. (brownianInventory.ts:583) receipt-pagemap-absent (am-h83f).
    // a92732ba added this site with no test and the am-muyh pawl caught it.
    // The receipt page map is the evidence `resolveEquationPage` reads, so a
    // receipt carrying none cannot be reconciled against its manifest at all.
    // An empty list is that same absence written a second way, and the guard
    // refuses both; the two reject arms below drive the two halves of its
    // disjunction and each asserts which half it reached, so the pair cannot
    // quietly collapse into one branch tested twice.
    describe("Site (brownianInventory.ts:583): receipt-pagemap-absent", () => {
      it("throws receipt-pagemap-absent when the receipt carries no pageMap key (brownianInventory.ts:583)", () => {
        const tempRoot = createTempBrownianFixture();
        assert.ok(
          Array.isArray(receiptPageMap(tempRoot)),
          "the fixture receipt must start with a pageMap, or removing it drives nothing",
        );
        rewriteReceiptPageMap(tempRoot, null);
        assert.equal(
          receiptPageMap(tempRoot),
          undefined,
          "this arm must reach the !Array.isArray half of the guard",
        );

        assert.throws(
          () => brownianPageMapMismatches(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "receipt-pagemap-absent");
            assert.ok(err.message.includes("no pageMap to reconcile"));
            return true;
          },
        );
      });

      it("throws receipt-pagemap-absent when the receipt's pageMap is an empty list (brownianInventory.ts:583)", () => {
        const tempRoot = createTempBrownianFixture();
        rewriteReceiptPageMap(tempRoot, "pageMap: []");
        const parsed = receiptPageMap(tempRoot);
        assert.ok(
          Array.isArray(parsed) && parsed.length === 0,
          "this arm must reach the length === 0 half of the guard, not !Array.isArray",
        );

        assert.throws(
          () => brownianPageMapMismatches(tempRoot),
          (err: unknown) => {
            assert.ok(err instanceof InventoryHonestyError);
            assert.equal(err.code, "receipt-pagemap-absent");
            return true;
          },
        );
      });

      // The accept arm. Not throwing is too weak on its own: a body that
      // returned [] after the guard would pass that. So the receipt is given a
      // page map that disagrees with the manifest on a known page, and the
      // disagreement has to come back. The restored fixture then has to stop
      // reporting it, which is the control that separates a plant from a story.
      it("reconciles a receipt whose pageMap is present, and reports a planted disagreement (brownianInventory.ts:583)", () => {
        const baselineRoot = createTempBrownianFixture();
        const baseline = brownianPageMapMismatches(baselineRoot);
        assert.ok(Array.isArray(baseline));
        const claimsS9 = (mismatches: readonly PageMapMismatch[]): boolean =>
          mismatches.some(
            (mismatch) =>
              mismatch.printedPage === 549 &&
              mismatch.field === "sectionIds" &&
              mismatch.receipt.length === 1 &&
              mismatch.receipt[0] === "s9",
          );
        assert.equal(claimsS9(baseline), false, "the unplanted receipt does not claim s9");

        const plantedRoot = createTempBrownianFixture();
        rewriteReceiptPageMap(
          plantedRoot,
          [
            "pageMap:",
            "  - pdfPageIndex: 1",
            "    printedPage: 549",
            "    sectionIds:",
            "      - s9",
            "    displayEquations:",
            "      numbered: []",
            "      unnumberedIds: []",
            "    footnoteMarks: []",
          ].join("\n"),
        );
        const planted = brownianPageMapMismatches(plantedRoot);
        const s9 = planted.find(
          (mismatch) => mismatch.printedPage === 549 && mismatch.field === "sectionIds",
        );
        assert.ok(s9, "the planted page 549 entry must be reconciled, not skipped");
        assert.deepEqual([...s9.receipt], ["s9"]);
        assert.ok(
          s9.manifest.length > 0,
          "the manifest side must carry the sections really printed on page 549",
        );
        assert.equal(s9.manifest.includes("s9"), false);

        // Restore: a fresh unmodified fixture stops reporting the plant.
        const restoredRoot = createTempBrownianFixture();
        assert.equal(claimsS9(brownianPageMapMismatches(restoredRoot)), false);
      });
    });
  });
});
