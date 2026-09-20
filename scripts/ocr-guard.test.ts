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
  /**
   * The one violation the repository currently contains, pinned by file and pattern.
   *
   * THIS IS NOT AN APPROVAL AND IT IS NOT AN EXEMPTION MECHANISM. It is an open
   * question recorded where it cannot be missed, and it needs an owner ruling
   * (am-jb4c). Until am-jb4c fixed the launcher alternation, `spawnSync(...)` was
   * invisible to the guard, so this call has never been seen by it. Fixing the
   * matcher did not create the violation; it revealed one that was always there.
   *
   * The conflict, stated fairly on both sides:
   *  - scripts/verify-facsimile-pins.ts reads folio numerals out of a parent scan's
   *    EXISTING text layer to check which printed page a parent page is. Its own
   *    header says reading an existing layer is parsing, not recognition, and
   *    AGENTS.md does permit inspecting a pinned PDF. Its output is integers used
   *    for page identity; it never becomes ledger or edition text.
   *  - the denylist entry's own reason is narrower than its pattern: "pdftotext
   *    text-layer extraction is forbidden IN SOURCE-LAYER PIPELINES ... must not
   *    substitute for cloud OCR research drafts or editorial transcription." The
   *    pattern denies every call; the reason denies a use.
   *
   * Resolving it means either narrowing the denylist entry or removing pdftotext
   * from the pin gate, and both are the owner's call under AGENTS.md's hardest rule.
   * Nobody may widen this list to quiet a new finding: a second entry here is a
   * second decision, and it belongs to the owner too.
   */
  const KNOWN_UNRESOLVED_VIOLATIONS = [
    { file: "scripts/verify-facsimile-pins.ts", pattern: "pdftotext" },
  ] as const;

  it("the real codebase contains no forbidden OCR call except the one open question", {
    timeout: 30000,
  }, async () => {
    const result = await scanRepositoryForForbiddenOcr(ROOT);
    const seen = result.violations.map((v) => ({ file: v.file, pattern: v.pattern }));

    const unexpected = seen.filter(
      (v) => !KNOWN_UNRESOLVED_VIOLATIONS.some((k) => k.file === v.file && k.pattern === v.pattern),
    );
    assert.deepEqual(
      unexpected,
      [],
      "AGENTS.md: NEVER RUN OCR ON THIS MACHINE, with no convenience, deadline, fallback " +
        `or small-batch exception.\n${result.violations
          .map((v) => `${v.file}:${v.line}: [${v.pattern}] ${v.reason}`)
          .join("\n")}`,
    );

    // The pin must not outlive what it describes. If the call is removed or the
    // denylist entry changes, this fails and the entry above must be deleted -
    // otherwise a resolved question silently becomes standing permission.
    const stale = KNOWN_UNRESOLVED_VIOLATIONS.filter(
      (k) => !seen.some((v) => v.file === k.file && v.pattern === k.pattern),
    );
    assert.deepEqual(
      stale,
      [],
      "A pinned OCR violation no longer occurs. Delete it from KNOWN_UNRESOLVED_VIOLATIONS " +
        "in this same commit; a pin left behind is pre-authorised headroom.",
    );

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

  // am-jb4c criteria 5-7. The test below this one asks whether the denylist MENTIONS
  // an engine. These ask whether the guard REFUSES it, which is the claim the older
  // test's name makes, by calling the matcher the file already imports.
  //
  // The call forms are the ones this repository actually uses to launch binaries, not
  // a generic list: scripts/verify-facsimile-pins.ts reaches for spawnSync("tool", [...])
  // and this is a Bun repository, where Bun.spawnSync(["tool", ...]) is idiomatic. Three
  // of these forms were invisible to the guard until this bead - spawnSync, execFileSync
  // and Bun.spawnSync - so the form an author here would most naturally reach for to run
  // an OCR engine was precisely the form that was not refused.
  const NAMED_IN_POLICY = ["focr", "tesseract", "ocrmypdf"] as const;

  const SPAWN_FORMS: readonly { readonly label: string; readonly line: (t: string) => string }[] = [
    { label: "spawn", line: (t) => `spawn("${t}", ["in.pdf"]);` },
    { label: "spawnSync", line: (t) => `spawnSync("${t}", ["in.pdf"]);` },
    { label: "execFile", line: (t) => `execFile("${t}", ["in.pdf"]);` },
    { label: "execFileSync", line: (t) => `execFileSync("${t}", ["in.pdf"]);` },
    { label: "execSync", line: (t) => `execSync("${t} in.pdf out.txt");` },
    { label: "Bun.spawn array form", line: (t) => `Bun.spawn(["${t}", "in.pdf"]);` },
    { label: "Bun.spawnSync array form", line: (t) => `Bun.spawnSync(["${t}", "in.pdf"]);` },
  ];

  it("every engine AGENTS.md names is refused in every call form this repository uses", async () => {
    const { denylist } = await loadDenylist(ROOT);
    const unrefused: string[] = [];
    for (const tool of NAMED_IN_POLICY) {
      for (const form of SPAWN_FORMS) {
        const line = form.line(tool);
        const violations = scanContentForViolations("src/content/probe.ts", line, denylist);
        if (violations.length === 0) {
          unrefused.push(`${tool} via ${form.label}: ${line}`);
        }
      }
    }
    assert.deepEqual(
      unrefused,
      [],
      "AGENTS.md: NEVER RUN OCR ON THIS MACHINE, with no convenience, deadline, fallback " +
        "or small-batch exception. A call form the guard cannot see is a way to run one " +
        "of these engines locally without the guard noticing:\n" +
        unrefused.join("\n"),
    );
  });

  it("an import of a denylisted OCR package is refused as well as a spawn", async () => {
    const { denylist } = await loadDenylist(ROOT);
    const importForms = [
      'import Tesseract from "tesseract.js";',
      'const ocr = require("node-tesseract-ocr");',
    ];
    for (const line of importForms) {
      const violations = scanContentForViolations("src/content/probe.ts", line, denylist);
      assert.ok(violations.length > 0, `not refused: ${line}`);
    }
  });

  it("control: naming an engine without calling it is NOT refused", async () => {
    // Criterion 7, and the direction that matters most. The repair for a matcher that
    // misses real calls must not be a substring search over prose: this file, AGENTS.md,
    // the denylist's own reasons and every bead about OCR all contain these words. A
    // guard that refused them would be switched off within a day, and then nothing would
    // refuse the real calls either.
    const { denylist } = await loadDenylist(ROOT);
    const mentions = [
      'const engine = "tesseract";',
      "// we never run tesseract, ocrmypdf or focr locally",
      'const note = "focr is forbidden; use the cloud worker";',
      "const label: string = `ocrmypdf is not installed here`;",
    ];
    for (const line of mentions) {
      const violations = scanContentForViolations("src/content/probe.ts", line, denylist);
      assert.deepEqual(
        violations.map((v) => v.pattern),
        [],
        `a bare mention must not be refused, or the guard becomes a prose matcher: ${line}`,
      );
    }
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
