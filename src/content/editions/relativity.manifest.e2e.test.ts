/**
 * THE RELATIVITY INVENTORY'S END-TO-END GATE, which its bead specified and which did not exist.
 *
 * am-edn-inventory-relativity-0u9's Test Plan names this file and lists what it must assert. The
 * brownian and light-quanta siblings have had theirs since September and both pass; this paper, the
 * largest of the four at 31 pages and 436 units, had only its unit test. That is the gap this
 * closes, and it is the reason the bead could not be closed on 2026-10-03 even though its unit test
 * passes with 2849 assertions: the instrument its own plan designates was missing, so there was
 * nothing to run.
 *
 * WHAT MAKES THIS AN E2E TEST RATHER THAN A SECOND UNIT TEST. Every assertion here goes through a
 * real process or a real reader: the report CLI is spawned and judged by its exit code and stdout,
 * the receipt checker is spawned, and the compiler is driven over the corpus as loaded from disk.
 * Nothing is stubbed, and the manifest is read from `content/`, not from a fixture, so a check on
 * the inputs reads the inputs.
 *
 * WHY `spawnSync` AND NOT `Bun.spawn`, which the bead's plan names. This file matches
 * `**\/*.e2e.test.ts` in bunfig's `pathIgnorePatterns`, so `bun test` never runs it; the node lane
 * does, through `node --experimental-strip-types --test`. Bun's globals are therefore absent at run
 * time, and both sibling e2e files already use `node:child_process`. Following them is what keeps
 * this file runnable; the plan's wording predates the lane split.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import { compileReadingContent } from "../compiler/compile.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import type { SourceManifest } from "../manifest/types.ts";
import { validateManifest } from "../manifest/validator.ts";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { parseYaml } from "../provenance/yaml.ts";

const ROOT = process.cwd();
const PAPER = "special-relativity";
const BIB_KEY = "ap-17-891";
const BEAD = "am-edn-inventory-relativity-0u9";
/** The two results this paper exports, named in its manifest's `exportedResults`. */
const EXPORTED_S8 = "eq-s8-d4";
const EXPORTED_S10 = "eq-s10-d8";

const logRunId = newRunIdentity();
const logger = new TestLogger(`manifest-${PAPER}-e2e`, logRunId, join(ROOT, "artifacts/test-logs"));

const evidenceDir = join(ROOT, `artifacts/test-logs/manifest-${PAPER}`, logRunId, "evidence");

function retainEvidence(name: string, stdout: string, stderr: string, extra?: unknown): string {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, `${name}.stdout.log`), stdout);
  writeFileSync(join(evidenceDir, `${name}.stderr.log`), stderr);
  if (extra !== undefined) {
    writeFileSync(join(evidenceDir, `${name}.extra.json`), JSON.stringify(extra, null, 2));
  }
  return evidenceDir;
}

function manifestOnDisk(): SourceManifest {
  const path = join(ROOT, "content/source-blocks", PAPER, "manifest.yaml");
  return validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
}

describe(`special-relativity source-manifest report CLI (${BEAD})`, () => {
  it("source-manifest-report CLI runs cleanly with code 0, every unit assigned a destination, matching page counts, and no percentages", () => {
    const proc = spawnSync("bun", ["scripts/source-manifest-report.ts", PAPER], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const exitCode = proc.status ?? 1;
    const stdout = proc.stdout ?? "";
    const stderr = proc.stderr ?? "";
    if (exitCode !== 0) retainEvidence("source-manifest-report", stdout, stderr);

    assert.equal(exitCode, 0, `source-manifest-report failed with stderr: ${stderr}`);

    // AGENTS.md forbids "a single flattering completeness percentage" anywhere in this report.
    assert.ok(!/%/.test(stdout), "report stdout must not contain percentages");
    assert.ok(!/%/.test(stderr), "report stderr must not contain percentages");
    assert.ok(
      !stdout.toLowerCase().includes("are reviewed"),
      "the report must not claim a reviewed edition",
    );

    const manifest = manifestOnDisk();
    // A roster report, not an assertion: this paper gains units whenever a required class is
    // inventoried, so a frozen total here would break on correct work. The properties below hold at
    // any size. Non-vacuity is asserted on purpose, because an empty roster would satisfy every
    // `for` loop in this file while proving nothing.
    const sentences = manifest.units.filter((u) => u.kind === "sentence");
    const blockLevel = manifest.units.filter((u) => u.kind !== "sentence");
    console.log(
      `[relativity e2e] ${manifest.units.length} units: ${blockLevel.length} block-level, ${sentences.length} sentence`,
    );
    assert.ok(manifest.units.length > 0, "the manifest roster must not be empty");
    assert.ok(sentences.length > 0, "sentence units must be inventoried (owner ruling am-xz2d)");

    for (const unit of manifest.units) {
      assert.ok(unit.destination, `unit ${unit.id} must have a destination`);
      assert.ok(unit.locators.length >= 1, `unit ${unit.id} must have at least one locator`);
    }

    // Per-page reconciliation against the receipt's refined page map, which is the other half of
    // this bead's "counts reconcile with the receipt's page map" criterion.
    const receiptPath = join(ROOT, "docs/provenance", `${BIB_KEY}.md`);
    assert.ok(existsSync(receiptPath), `${receiptPath} must exist`);
    const parsed = parseReceipt(readFileSync(receiptPath, "utf8"), receiptPath);
    assert.ok(parsed.ok, "the receipt must parse");
    const sourceAsset = receiptToSourceAsset(parsed.frontMatter as never);
    assert.equal(sourceAsset.pageMapping.length, manifest.pageCount);
    assert.equal(manifest.pageCount, 31);

    // `printedPage` is `number | null`: a mapped PDF page need not carry a journal page number, and
    // such an entry cannot be asked to hold units. Those are skipped rather than cast away, and the
    // count of real printed pages is asserted below so skipping cannot empty the loop silently.
    const printedPages = sourceAsset.pageMapping
      .map((page) => page.printedPage)
      .filter((page): page is number => typeof page === "number");
    assert.equal(printedPages.length, 31, "all 31 journal pages must be mapped with a printed page");

    const unmappedPages: number[] = [];
    for (const printedPage of printedPages) {
      const onPage = manifest.units.filter((u) => u.locators.some((l) => l.page === printedPage));
      if (onPage.length === 0) unmappedPages.push(printedPage);
    }
    if (unmappedPages.length > 0) {
      retainEvidence("page-reconciliation", stdout, stderr, { unmappedPages });
    }
    assert.deepEqual(unmappedPages, [], "every printed page must carry at least one unit");

    // Every unit's page must be one the receipt knows: the reconciliation in the other direction,
    // which a presence test alone cannot catch.
    const knownPages = new Set(printedPages);
    const strayLocators = manifest.units.flatMap((u) =>
      u.locators.filter((l) => !knownPages.has(l.page)).map((l) => `${u.id}@${l.page}`),
    );
    assert.deepEqual(strayLocators, [], "no unit may sit on a page the receipt does not map");

    logger.log({
      testId: "e2e-source-manifest-report",
      beadId: BEAD,
      paper: PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `report CLI exit 0; ${manifest.units.length} units all with destinations; 31 pages reconciled; no percentages.`,
      extra: { check: "report-cli", units: manifest.units.length, sentences: sentences.length },
    });
  });

  it("the corpus content compiler produces no rejections for special-relativity", async () => {
    const files = await loadReadingFiles();
    const compiled = compileReadingContent(files);
    const errors = compiled.diagnostics.filter((d) => d.severity === "error");
    if (!compiled.ok) retainEvidence("content-compiler", "", "", errors);

    assert.equal(compiled.ok, true, "the content compiler must succeed");
    const rejections = errors.filter((d) => d.path?.includes(PAPER) || d.message?.includes(PAPER));
    assert.deepEqual(
      rejections.map((d) => `${d.path}: ${d.message}`),
      [],
      "no rejection may name special-relativity",
    );

    logger.log({
      testId: "e2e-content-compiler-clean",
      beadId: BEAD,
      paper: PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: "corpus content compiler has zero rejections for special-relativity.",
      extra: { check: "content-compiler" },
    });
  });

  it("an import naming a non-exported relativity id is REJECTED, and one naming the exported s8 id is ACCEPTED", () => {
    // The bead's criterion, driven from the mass-energy side as it specifies. Both directions are
    // asserted, because a validator that accepted everything and one that rejected everything would
    // each satisfy a single-direction test.
    const relativity = manifestOnDisk();
    const exported = (relativity.exportedResults ?? []).map((e) => e.id ?? e.resultId);
    assert.deepEqual(
      [...exported].sort(),
      [EXPORTED_S8, EXPORTED_S10].sort(),
      "this paper exports exactly the s8 light-energy display and the s10 kinetic-energy unit",
    );
    // Both exported ids must resolve to real units, or the export is a dangling promise.
    const unitIds = new Set(relativity.units.map((u) => u.id));
    for (const id of exported) assert.ok(unitIds.has(id as string), `export ${id} must resolve`);

    const importer = (resultId: string): SourceManifest => ({
      paper: "mass-energy",
      document: "ap-18-639",
      status: "in-preparation",
      pageCount: 3,
      pageRange: [639, 641],
      units: [{ id: "s0-p1", kind: "paragraph", locators: [{ page: 639 }] }],
      importedResults: [{ fromPaper: PAPER, resultId, use: "premise" }],
    });
    const context = {
      manifests: new Map<string, SourceManifest>([[PAPER, relativity]]),
      aliases: [],
    };

    const accepted = validateManifest(importer(EXPORTED_S8), context).filter(
      (d) => d.severity === "error" && d.rule === "import-unexported-result",
    );
    assert.deepEqual(accepted, [], `importing the exported ${EXPORTED_S8} must be accepted`);

    // A real relativity unit that is NOT exported: being a valid id is not being an export.
    const notExported = "eq-s3-d1";
    assert.ok(
      unitIds.has(notExported),
      `${notExported} must exist as a unit for this to be a plant`,
    );
    assert.ok(!exported.includes(notExported), `${notExported} must not be exported`);
    const rejected = validateManifest(importer(notExported), context).filter(
      (d) => d.severity === "error" && d.rule === "import-unexported-result",
    );
    assert.equal(rejected.length, 1, `importing the non-exported ${notExported} must be rejected`);

    logger.log({
      testId: "e2e-cross-paper-export-boundary",
      beadId: BEAD,
      paper: PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `import of ${EXPORTED_S8} accepted; import of ${notExported} rejected with import-unexported-result.`,
      extra: { check: "cross-paper-import", accepted: EXPORTED_S8, rejected: notExported },
    });
  });

  it("the receipt check passes cleanly with 0 errors for ap-17-891", () => {
    const proc = spawnSync("bun", ["scripts/check-receipts.ts", "--key", BIB_KEY], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const exitCode = proc.status ?? 1;
    const stdout = proc.stdout ?? "";
    const stderr = proc.stderr ?? "";
    if (exitCode !== 0) retainEvidence("check-receipts", stdout, stderr);

    assert.equal(exitCode, 0, `check-receipts failed with stderr: ${stderr}`);
    assert.ok(stdout.includes("0 errors"), "check-receipts must report 0 errors");

    logger.log({
      testId: "e2e-check-receipts",
      beadId: BEAD,
      paper: PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `check-receipts passed with 0 errors for ${BIB_KEY}.`,
      extra: { check: "check-receipts" },
    });
  });

  it("the evidence path works: a marked canary is written and readable", () => {
    // THE BEAD ASKS FOR THIS BY NAME, and the reason is this repository's own: the four retention
    // calls above only ever run when something has already failed, so on a green run they are never
    // executed and nothing shows that the directory is writable or that the path is right. A failure
    // handler that throws, or writes somewhere nobody looks, converts a real defect into a missing
    // report. The canary exercises the same function the failure paths use, on every run.
    const marker = `canary ${logRunId} ${BEAD}`;
    const dir = retainEvidence("evidence-path-canary", marker, marker, { canary: true, logRunId });
    const written = join(dir, "evidence-path-canary.stdout.log");
    assert.ok(existsSync(written), `the canary must exist at ${written}`);
    assert.equal(readFileSync(written, "utf8"), marker, "the canary must round-trip byte for byte");
    assert.ok(
      existsSync(join(dir, "evidence-path-canary.extra.json")),
      "the extra-JSON branch of the retention helper must also write",
    );

    logger.log({
      testId: "e2e-evidence-path-canary",
      beadId: BEAD,
      paper: PAPER,
      outcome: "passed",
      comparisonKind: "bitwise",
      message: `evidence retention verified at ${dir}.`,
      extra: { check: "evidence-canary", evidencePath: dir },
    });
  });
});
