import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PORTRAIT } from "../../src/app/about/portrait.ts";
import { paperFacts } from "../../src/app/papers/paperFacts.ts";
import { checkedReceipts } from "../../src/app/sources/receiptPages.ts";
import { germanTextState } from "../../src/content/germanTextState.ts";
import { ROUTE_SLUGS, type RouteSlug } from "../../src/content/ids.ts";
import { missingReadingLayers } from "../../src/content/paperAvailability.ts";
import { translationState } from "../../src/content/translationState.ts";
import { buildNativeCatalog } from "./native-catalog.ts";
import { buildNativeLibrary } from "./native-library.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the native reading library", () => {
  it("carries the receipt's working title and printed extent into the exported paper rows", () => {
    const catalog = buildNativeCatalog(join(ROOT, "content"));
    const receipts = checkedReceipts({
      provenanceDir: join(ROOT, "docs/provenance"),
      rootDir: ROOT,
      requireLocal: false,
    });
    const facts = paperFacts(ROOT);
    assert.equal(catalog.papers.length, 4);
    for (const paper of catalog.papers) {
      const receipt = receipts.find(
        (entry) => entry.receipt?.frontMatter.slug === paper.slug,
      )?.receipt;
      const fact = facts.find((entry) => entry.slug === paper.slug);
      assert.ok(receipt && fact, `${paper.slug} has no bibliographic owner`);
      assert.equal(paper.workingTitle, receipt.frontMatter.paper.titleEnglishWorking);
      assert.equal(paper.locator, fact.locator);
      assert.equal(paper.firstPage, receipt.frontMatter.paper.journal.pages.first);
      assert.equal(paper.lastPage, receipt.frontMatter.paper.journal.pages.last);
      assert.equal(paper.pageCount, fact.printedPages);
      assert.ok(paper.lastPage !== undefined && paper.firstPage !== undefined);
      assert.equal(paper.pageCount, paper.lastPage - paper.firstPage + 1);
    }
  });

  it("uses the web library's availability wording without adding a review judgement", () => {
    const details = buildNativeLibrary(join(ROOT, "content"));
    const translations = new Map(translationState(ROOT).map((paper) => [paper.slug, paper]));
    for (const [slug, paper] of details.papers) {
      assert.ok(ROUTE_SLUGS.includes(slug as RouteSlug));
      const missing = missingReadingLayers(
        germanTextState(slug as RouteSlug, ROOT),
        translations.get(slug),
      );
      assert.equal(paper.availabilityNotice ?? null, missing);
      assert.doesNotMatch(paper.availabilityNotice ?? "", /review|verified|complete/i);
    }
    const translation = { slug: "mass-energy", units: 1, reviewed: 0, machineDrafts: 1 };
    assert.equal(missingReadingLayers("draft", translation), null);
    assert.equal(missingReadingLayers("reviewed", { ...translation, reviewed: 1 }), null);
    assert.equal(
      missingReadingLayers("not-started", undefined),
      "Not yet available: the German text and the English translation.",
    );
  });

  it("includes the canonical frontispiece and distinguishes the archive record from the attribution", () => {
    const portrait = buildNativeCatalog(join(ROOT, "content")).portrait;
    assert.ok(portrait);
    assert.equal(portrait.path, PORTRAIT.served[0].path);
    assert.equal(portrait.alt, PORTRAIT.alt);
    assert.equal(portrait.recordURL, `https://doi.org/${PORTRAIT.doi}`);
    assert.ok(portrait.credit.includes(`${PORTRAIT.archive}, ${PORTRAIT.identifier}`));
    assert.ok(
      portrait.credit.includes(`photographer as ${PORTRAIT.archivePhotographer.toLowerCase()}`),
    );
    assert.ok(portrait.credit.includes(`often attributed to ${PORTRAIT.attributedTo}`));
    assert.ok(portrait.credit.includes(PORTRAIT.rights));
  });

  it("does not invent bibliography or a portrait for an older, minimal content export", () => {
    const root = mkdtempSync(join(tmpdir(), "annus-native-library-"));
    const content = join(root, "content");
    mkdirSync(join(content, "papers"), { recursive: true });
    writeFileSync(join(content, "papers", "mass-energy.json"), "{}");
    const details = buildNativeLibrary(content);
    assert.deepEqual(
      [...details.papers],
      [
        [
          "mass-energy",
          {
            availabilityNotice: "Not yet available: the German text and the English translation.",
          },
        ],
      ],
    );
    assert.equal(details.portrait, undefined);
  });
});
