import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_FORMATTERS,
  blankSwiftComments,
  type SwiftPhysicsFinding,
  swiftPhysicsFindings,
} from "./swiftPhysicsBoundary.ts";

/**
 * THE GATE am-tny4 FOUND MISSING: Swift computes, caches and formats no displayed physical quantity.
 *
 * am-tny4: "the rule 'Swift never computes, caches or formats a displayed physical quantity, and
 * never authors reader-facing scientific text' has NO GATE among the 16 apple-* steps, though a
 * scan found 0 substantive violations." This is that gate, and it lives in the BUN lane rather than
 * in the apple family on purpose: AGENTS.md requires a gate's proof to sit outside the lane it
 * controls, the apple family does not run in the website's CI, and this is a source-level property
 * that needs no Xcode. It therefore runs on every commit.
 *
 * ADDED WHILE THE FAMILY IS CLEAN, which is the only honest moment to set a floor of zero: the scan
 * reports 0 findings over the app's Swift sources today, so there is no debt to baseline and no
 * exemption to write.
 *
 * WHICH HALF OF THE RULE IT ANSWERS. It answers COMPUTES, CACHES and FORMATS. It does NOT answer
 * "never authors reader-facing scientific text": a Swift literal holding scientific prose is a
 * judgement rather than a pattern, and prose is judged by the voice lint over compiled records. The
 * census says so in its own line, so a green here is not read as the whole rule.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The app's own sources. Test targets are excluded and the census names them. */
const APP = join(ROOT, "ios/AnnusMirabilis");

function swiftFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) swiftFiles(p, out);
    else if (entry.endsWith(".swift")) out.push(p);
  }
  return out;
}

describe("Swift computes, caches and formats no displayed physical quantity (am-tny4)", () => {
  test("the app's Swift sources carry no finding, and the scan says what it examined", () => {
    const files = swiftFiles(APP);
    const findings: SwiftPhysicsFinding[] = [];
    for (const file of files)
      findings.push(
        ...swiftPhysicsFindings(file.slice(ROOT.length + 1), readFileSync(file, "utf8")),
      );
    console.log(
      `[swift physics boundary] examined ${files.length} Swift file(s) under ios/AnnusMirabilis ` +
        `(the test targets are excluded, and a test may assert a number the app received); ` +
        `${findings.length} finding(s)${findings.length ? `: ${findings.map((f) => `${f.file}:${f.line} ${f.kind}`).join("; ")}` : ""}. ` +
        `Allowed by name: ${Object.keys(ALLOWED_FORMATTERS).join(", ")}.`,
    );
    console.log(
      "[swift physics boundary] HALF ANSWERED: computes, caches, formats. NOT answered: " +
        '"never authors reader-facing scientific text", which needs a reading rather than a pattern.',
    );
    // THE DENOMINATOR, MEASURED AND THEN WRITTEN DOWN, not guessed. A scan over zero files reports
    // zero findings and reads as a clean app. 23 files under ios/AnnusMirabilis on 2026-10-10, of 54
    // Swift files in ios/ -- the other 31 are the AnnusMirabilisTests and AnnusMirabilisUITests
    // targets, excluded because a test may legitimately assert a number the app received. My first
    // draft of this floor said 30, from the 54 total, and failed: counts belong after the run.
    expect(files.length).toBeGreaterThanOrEqual(20);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.kind}`)).toEqual([]);
  });

  /**
   * The four positives are the deliverable. A gate whose only evidence is a clean tree cannot be
   * told from a gate that matches nothing, and this one was written against a population where
   * every pattern's count is already zero.
   */
  test("each forbidden construct is found, with its line", () => {
    const cases: readonly [string, SwiftPhysicsFinding["kind"]][] = [
      ['let label = "0.8 μm"', "unit-literal"],
      // And the anchored form still finds a real unit beside a word boundary, which is the other
      // direction of the same repair: without it the anchoring could satisfy itself by matching none.
      ['let label = "1.5 eV threshold"', "unit-literal"],
      ['let text = String(format: "%.2f", value)', "float-format"],
      ["let f = MeasurementFormatter()", "quantity-formatter"],
      ["let rms = sqrt(2 * diffusion * interval)", "physics-arithmetic"],
    ];
    for (const [source, kind] of cases) {
      const found = swiftPhysicsFindings("Probe.swift", source);
      expect(found.map((f) => f.kind)).toContain(kind);
      expect(found[0]?.line).toBe(1);
    }
  });

  test("the allowed formatters and ordinary presentation code are not findings", () => {
    const clean = [
      // The two real uses in the app today, which is why they are allowed by name.
      "ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)",
      "controller.printFormatter = webView.viewPrintFormatter()",
      // Presentation settings carry a Double and compute nothing physical.
      "let scale: Double = settings.typeScale / 100.0",
      // A bridge payload carries a value it does not compute.
      "struct Payload: Codable { let value: Double }",
      // A unit-looking token outside a string literal is not a displayed unit.
      "let micrometres = 1",
      // THE THREE REAL FALSE POSITIVES THIS GATE PRODUCED BEFORE IT SHIPPED, kept as cases. A bare
      // `includes("eV")` matched the letters inside camel case and reported the app's clean sources
      // as carrying three unit literals -- the same shape as AGENTS.md's `grep -ciE "MIT"` matching
      // `Emit`. An unanchored token fails toward whatever text is commonest near the thing being
      // measured, and in Swift that is camel case.
      'let build = info?["CFBundleVersion"] as? String ?? "?"',
      'return ["status": "ok", "value": ["bridgeVersion": BridgeProtocol.version]]',
      'ContentUnavailableView("This build keeps no copy", systemImage: "tray")',
    ];
    for (const source of clean)
      expect(swiftPhysicsFindings("Probe.swift", source).map((f) => f.kind)).toEqual([]);
  });

  /**
   * THE BLANKER IS PROVED IN BOTH DIRECTIONS, because one that blanked everything would report a
   * clean app forever. The four cases AGENTS.md names, plus the two Swift-specific ones: a nesting
   * block comment, and a `//` inside a string literal.
   */
  describe("blankSwiftComments", () => {
    test("a forbidden construct inside a comment is not a finding, and in code it is", () => {
      expect(
        swiftPhysicsFindings("Probe.swift", "// let f = MeasurementFormatter()").map((f) => f.kind),
      ).toEqual([]);
      expect(
        swiftPhysicsFindings("Probe.swift", "/* MeasurementFormatter */").map((f) => f.kind),
      ).toEqual([]);
      expect(
        swiftPhysicsFindings("Probe.swift", "let f = MeasurementFormatter()").map((f) => f.kind),
      ).toHaveLength(1);
    });

    test("a trailing comment does not swallow the code before it", () => {
      const found = swiftPhysicsFindings(
        "Probe.swift",
        "let f = MeasurementFormatter() // explains why",
      );
      expect(found.map((f) => f.kind)).toEqual(["quantity-formatter"]);
    });

    test("a block comment does not swallow the code after it", () => {
      const found = swiftPhysicsFindings(
        "Probe.swift",
        "/* a note */ let f = MeasurementFormatter()",
      );
      expect(found.map((f) => f.kind)).toEqual(["quantity-formatter"]);
    });

    test("Swift block comments NEST, so an inner close does not end the outer one", () => {
      // In C this would leave `MeasurementFormatter()` in code. In Swift it is still commented.
      const found = swiftPhysicsFindings(
        "Probe.swift",
        "/* outer /* inner */ MeasurementFormatter() */ let x = 1",
      );
      expect(found.map((f) => f.kind)).toEqual([]);
    });

    test("a double slash inside a string literal is not a comment opener", () => {
      // The defect the shared TypeScript blanker was repaired for, met in Swift.
      const source = 'let url = "https://example.test/a"\nlet f = MeasurementFormatter()';
      expect(swiftPhysicsFindings("Probe.swift", source).map((f) => f.line)).toEqual([2]);
    });

    test("a multiline literal does not blank the rest of the file", () => {
      const source = 'let s = """\n// not a comment\n"""\nlet f = MeasurementFormatter()';
      expect(swiftPhysicsFindings("Probe.swift", source).map((f) => f.line)).toEqual([4]);
    });

    test("line numbers and length survive blanking, so every citation still reports", () => {
      const source = "let a = 1 // one\n/* two */\nlet b = 2\n";
      const blanked = blankSwiftComments(source);
      expect(blanked.length).toBe(source.length);
      expect(blanked.split("\n").length).toBe(source.split("\n").length);
      expect(blanked.split("\n")[2]).toBe("let b = 2");
    });
  });
});
