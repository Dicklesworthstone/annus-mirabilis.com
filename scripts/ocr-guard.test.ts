import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  loadDenylist,
  scanContentForViolations,
  scanRepositoryForForbiddenOcr,
} from "./sources/ocrGuard.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("OCR Guard (Hard Resource Policy)", () => {
  it("passes on the real codebase with zero forbidden OCR violations", {
    timeout: 30000,
  }, async () => {
    const result = await scanRepositoryForForbiddenOcr(ROOT);
    assert.equal(
      result.ok,
      true,
      `OCR Guard failed on real tree with violations:\n${result.violations.map((v) => `${v.file}:${v.line}: [${v.pattern}] ${v.reason}`).join("\n")}`,
    );
    assert.equal(result.violations.length, 0);
    assert.ok(result.scannedFileCount > 10, "Expected multiple files scanned in real tree");
  });

  it("fails and cites denylist reason when spawn('tesseract') fixture is scanned", async () => {
    const denylistConfig = await loadDenylist(ROOT);
    const fixturePath = "src/testing/fixtures/ocr-guard/spawn-tesseract.ts";
    const content = await readFile(resolve(ROOT, fixturePath), "utf-8");
    const violations = scanContentForViolations(fixturePath, content, denylistConfig.denylist);

    assert.ok(violations.length > 0, "Expected violations for tesseract spawn");
    const tesseractViolation = violations.find((v) => v.pattern === "tesseract");
    assert.ok(tesseractViolation, "Should find tesseract violation");
    assert.ok(
      tesseractViolation.reason.includes(
        "Tesseract CLI / C++ library is a local OCR engine forbidden",
      ),
      `Expected denylist reason, got: ${tesseractViolation.reason}`,
    );
  });

  it("fails and cites denylist reason when import 'tesseract.js' fixture is scanned", async () => {
    const denylistConfig = await loadDenylist(ROOT);
    const fixturePath = "src/testing/fixtures/ocr-guard/import-tesseract-js.ts";
    const content = await readFile(resolve(ROOT, fixturePath), "utf-8");
    const violations = scanContentForViolations(fixturePath, content, denylistConfig.denylist);

    assert.ok(violations.length > 0, "Expected violations for tesseract.js import");
    const violation = violations.find((v) => v.pattern === "tesseract.js");
    assert.ok(violation, "Should find tesseract.js violation");
    assert.ok(
      violation.reason.includes("tesseract.js is a local WebAssembly/JS OCR engine forbidden"),
      `Expected denylist reason, got: ${violation.reason}`,
    );
  });

  it("fails and cites denylist reason when pdftotext execution fixture is scanned", async () => {
    const denylistConfig = await loadDenylist(ROOT);
    const fixturePath = "src/testing/fixtures/ocr-guard/pdftotext-call.ts";
    const content = await readFile(resolve(ROOT, fixturePath), "utf-8");
    const violations = scanContentForViolations(fixturePath, content, denylistConfig.denylist);

    assert.ok(violations.length > 0, "Expected violations for pdftotext execution");
    const violation = violations.find((v) => v.pattern === "pdftotext");
    assert.ok(violation, "Should find pdftotext violation");
    assert.ok(
      violation.reason.includes("pdftotext text-layer extraction is forbidden"),
      `Expected denylist reason, got: ${violation.reason}`,
    );
  });

  it("fails and cites denylist reason when a package.json declares tesseract.js", async () => {
    const denylistConfig = await loadDenylist(ROOT);
    const fixturePath = "src/testing/fixtures/ocr-guard/fixture-package.json";
    const content = await readFile(resolve(ROOT, fixturePath), "utf-8");
    const violations = scanContentForViolations(fixturePath, content, denylistConfig.denylist);

    assert.ok(violations.length > 0, "Expected violations for tesseract.js in package.json");
    const violation = violations.find((v) => v.pattern === "tesseract.js");
    assert.ok(violation, "Should find tesseract.js dependency violation");
    assert.ok(
      violation.reason.includes("tesseract.js is a local WebAssembly/JS OCR engine forbidden"),
      `Expected denylist reason, got: ${violation.reason}`,
    );
  });

  it("does NOT flag a file that spawns pdftoppm (rendering is allowed)", async () => {
    const denylistConfig = await loadDenylist(ROOT);
    const fixturePath = "src/testing/fixtures/ocr-guard/allowed-pdftoppm.ts";
    const content = await readFile(resolve(ROOT, fixturePath), "utf-8");
    const violations = scanContentForViolations(fixturePath, content, denylistConfig.denylist);

    assert.equal(violations.length, 0, "pdftoppm should be allowed without violations");
  });
});

/**
 * The denylist is a register, and a register rots (am-src-ocr-orchestrator-u1e0).
 *
 * The bead's criterion 3 reads "the guard test enforces it against source and
 * dependencies, AND EVERY DENYLIST ENTRY HAS A REASON". The scan half was enforced; the
 * reason half was true of the data and required of nothing, so an entry added without a
 * reason would have passed. The same for coverage: AGENTS.md names focr, Tesseract and
 * OCRmyPDF explicitly, and all three are on the list today because someone put them
 * there, not because anything would fail if they were dropped.
 *
 * Both are asserted here from the policy's own words rather than from the list itself,
 * so the list cannot satisfy the test by being whatever it is.
 */
describe("OCR denylist register integrity", () => {
  it("every entry carries a pattern, a category, and a reason that says why", async () => {
    const { denylist } = await loadDenylist(ROOT);
    assert.ok(denylist.length > 0, "An empty denylist forbids nothing");

    const defective = denylist.filter(
      (entry) =>
        !entry.pattern?.trim() ||
        !entry.category?.trim() ||
        // A reason has to be a reason. "no" and "forbidden" are not one, and a reader
        // hitting this guard needs to know what the tool is and which rule it breaks.
        (entry.reason ?? "").trim().length < 25,
    );
    assert.deepEqual(
      defective.map((e) => e.pattern ?? "(no pattern)"),
      [],
      "Every denylist entry needs a pattern, a category, and a reason of real length",
    );
  });

  it("the three engines AGENTS.md names by name are all covered", async () => {
    // Quoted from the policy: "This includes `focr`, Tesseract, OCRmyPDF, vision
    // transcription loops, and any other process whose purpose is to recognize text
    // from page pixels." The first three are named, so they are checkable.
    const namedInPolicy = ["focr", "tesseract", "ocrmypdf"];
    const { denylist } = await loadDenylist(ROOT);
    const patterns = denylist.map((entry) => entry.pattern.toLowerCase());

    const uncovered = namedInPolicy.filter((tool) => !patterns.some((p) => p.includes(tool)));
    assert.deepEqual(uncovered, [], "AGENTS.md names these OCR engines and the denylist must too");
  });
});
