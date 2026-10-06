/**
 * THE TWO EXTRACTORS MUST AGREE WHERE A PIN IS COMPARED (am-f3e4, 2026-10-06).
 *
 * `verify.ts` writes a pin with `extractTypeScriptExport`, which keeps a function's overload
 * signatures, and then verifies that pin against git HEAD with `extractTypeScriptFromText`, whose
 * documented default DROPS them. Comparing one rule against the other is not a comparison: for any
 * overloaded export the spans differed, the hashes could never match, and the audit refused for ever
 * with "Pin was written against uncommitted source" pointing at a file `git status` reports clean.
 * `classifySimultaneity` in events.ts was unpinnable for that reason alone, and the misleading message
 * cost a session ten minutes hunting a peer's edit that did not exist.
 *
 * The repair is one opt-in flag, `includeOverloadSignatures`, which verify.ts passes and nothing else
 * does. The default had to stay as it was: `scripts/snapshotFunctionHash.mjs` feeds hashes that are
 * already stored in generated worked examples, and `extract-kernel-source.ts` reports implementations
 * to its own callers.
 *
 * SO THIS FILE PINS BOTH HALVES, because a fix that only widened the default would have been silently
 * wrong in the other direction. The flag must make the two agree on an overloaded export, the default
 * must still drop the signatures, and a plain export must be unaffected by either.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractTypeScriptExport, extractTypeScriptFromText } from "./extractTypeScript.ts";

const ROOT = process.cwd();

/** The real overloaded specimens, named because the historical fact is which ones they were. */
const OVERLOADED = [
  { module: "src/physics/reference/events.ts", exportName: "classifySimultaneity" },
  { module: "src/physics/reference/events.ts", exportName: "redescribe" },
] as const;

/** A plain single-signature export, as the control. */
const PLAIN = {
  module: "src/physics/reference/kinematics.ts",
  exportName: "boostMatrixXT",
} as const;

function three(module: string, exportName: string) {
  const text = readFileSync(join(ROOT, module), "utf8");
  return {
    viaPath: extractTypeScriptExport({ root: ROOT, modulePath: module, exportName, revision: "t" }),
    fromTextDefault: extractTypeScriptFromText({ fileName: module, sourceText: text, exportName }),
    fromTextWithSignatures: extractTypeScriptFromText({
      fileName: module,
      sourceText: text,
      exportName,
      includeOverloadSignatures: true,
    }),
  };
}

describe("extractTypeScriptExport and extractTypeScriptFromText, where a pin is compared", () => {
  test("the specimens really are overloaded, so neither case below is vacuous", () => {
    // If events.ts ever loses its overload signatures these tests would pass while proving nothing,
    // because every extraction would agree for a reason unrelated to the flag. The spans are asserted
    // to DIFFER under the default first, which is the condition the rest of the file is about.
    for (const { module, exportName } of OVERLOADED) {
      const { viaPath, fromTextDefault } = three(module, exportName);
      expect(fromTextDefault.lineStart).toBeGreaterThan(viaPath.lineStart);
      expect(fromTextDefault.sourceHash).not.toBe(viaPath.sourceHash);
      expect(fromTextDefault.source.length).toBeLessThan(viaPath.source.length);
    }
  });

  test("with the flag, the in-memory extractor agrees with the path extractor exactly", () => {
    // This is the property verify.ts depends on. Without it a pin on an overloaded export can never
    // equal its HEAD hash, whatever the source says.
    for (const { module, exportName } of OVERLOADED) {
      const { viaPath, fromTextWithSignatures } = three(module, exportName);
      expect(fromTextWithSignatures.sourceHash).toBe(viaPath.sourceHash);
      expect(fromTextWithSignatures.lineStart).toBe(viaPath.lineStart);
      expect(fromTextWithSignatures.lineEnd).toBe(viaPath.lineEnd);
      expect(fromTextWithSignatures.source).toBe(viaPath.source);
    }
  });

  test("without the flag the default still drops the signatures, which other callers rely on", () => {
    // The other direction, and the reason the default was not simply changed. snapshotFunctionHash.mjs
    // has already written hashes into generated worked examples under this rule, so widening it would
    // move numbers in committed artifacts that have nothing to do with pins.
    for (const { module, exportName } of OVERLOADED) {
      const { fromTextDefault, fromTextWithSignatures } = three(module, exportName);
      expect(fromTextDefault.sourceHash).not.toBe(fromTextWithSignatures.sourceHash);
      expect(fromTextDefault.lineStart).toBeGreaterThan(fromTextWithSignatures.lineStart);
    }
  });

  test("a single-signature export is identical under all three, so the flag changes nothing it should not", () => {
    const { viaPath, fromTextDefault, fromTextWithSignatures } = three(
      PLAIN.module,
      PLAIN.exportName,
    );
    expect(fromTextDefault.sourceHash).toBe(viaPath.sourceHash);
    expect(fromTextWithSignatures.sourceHash).toBe(viaPath.sourceHash);
    expect(fromTextDefault.lineStart).toBe(fromTextWithSignatures.lineStart);
  });
});
