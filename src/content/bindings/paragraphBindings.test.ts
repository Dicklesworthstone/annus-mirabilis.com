/**
 * Every printed paragraph and display of mass-energy reaches its explanation
 * (am-bind-paragraphs-and-displays-me-u7bu). The real paper is checked with denominators from its
 * manifest; each refusal is proved on a copy of the real records with one binding changed.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BINDINGS_REQUIRED, checkParagraphBindings, reportLine } from "./paragraphBindings.ts";

const ROOT = process.cwd();
// Temporary copies under the OS temp directory, left for the OS to clear: this suite deletes nothing.
const scratch = mkdtempSync(join(tmpdir(), "paragraph-bindings-"));

/** A copy of mass-energy's manifest, passages, equations and bindings, with `edit` applied. */
function copyWith(name: string, edit: (yaml: string) => string): string {
  const root = join(scratch, name);
  for (const dir of ["source-blocks", "arguments", "equations"])
    cpSync(join(ROOT, "content", dir, "mass-energy"), join(root, "content", dir, "mass-energy"), {
      recursive: true,
    });
  const yaml = readFileSync(join(ROOT, "content/bindings/mass-energy.yaml"), "utf8");
  cpSync(join(ROOT, "content/bindings"), join(root, "content/bindings"), { recursive: true });
  writeFileSync(join(root, "content/bindings/mass-energy.yaml"), edit(yaml));
  return root;
}

describe("mass-energy's source is bound to its explanation", () => {
  test("every paragraph, display and obligation, with the manifest's denominators", () => {
    expect(BINDINGS_REQUIRED).toContain("mass-energy");
    const r = checkParagraphBindings(ROOT, "mass-energy");
    if (!r) throw new Error("mass-energy has no manifest");
    console.log(`[bindings] ${reportLine(r)}`);
    expect(r.problems).toEqual([]);
    // Not vacuous: the manifest has paragraphs, displays and obligations to bind.
    expect(r.paragraphs.of).toBeGreaterThan(0);
    expect(r.displays.of).toBeGreaterThan(0);
    expect(r.obligations.of).toBeGreaterThan(0);
    expect(r.paragraphs.bound).toBe(r.paragraphs.of);
    expect(r.displays.bound).toBe(r.displays.of);
    expect(r.obligations.resolved).toBe(r.obligations.of);
  });
});

describe("each gap is refused by name", () => {
  const problems = (name: string, edit: (yaml: string) => string) =>
    checkParagraphBindings(copyWith(name, edit), "mass-energy")?.problems ?? ["no report"];

  test("a paragraph with no binding", () => {
    const got = problems("unbound", (y) => y.replace(/ {2}- unit: s0-p5\n(?: {4}.*\n)+/, ""));
    expect(got).toContain("mass-energy s0-p5 is bound to no passage");
  });

  test("a binding to a passage that does not exist", () => {
    const got = problems("nonexistent", (y) =>
      y.replace("passages: [arg-me-small-speed]\n    r0:", "passages: [arg-me-no-such]\n    r0:"),
    );
    expect(got).toContain(
      "mass-energy s0-p11 names arg-me-no-such, which is not a mass-energy passage",
    );
  });

  test("a printed display with neither an equation record nor a declared status", () => {
    const got = problems("display", (y) =>
      y.replace(/ {2}- unit: eq-s0-d4\n {4}equations: .*\n/, ""),
    );
    expect(got).toContain(
      "mass-energy eq-s0-d4 has neither an equation record nor a declared status",
    );
  });

  test("an obligation that resolves to nothing", () => {
    const got = problems("obligation", (y) =>
      y.replace(/ {2}- obligation: low-speed-expansion\n {4}passages: .*\n/, ""),
    );
    expect(got).toContain("mass-energy obligation low-speed-expansion resolves to nothing");
  });

  test("a required paper with no bindings file", () => {
    const root = join(scratch, "missing");
    for (const dir of ["source-blocks", "arguments", "equations"])
      cpSync(join(ROOT, "content", dir, "mass-energy"), join(root, "content", dir, "mass-energy"), {
        recursive: true,
      });
    const r = checkParagraphBindings(root, "mass-energy");
    expect(r?.problems).toContain(
      "mass-energy has no content/bindings/mass-energy.yaml, and it is required",
    );
    expect(r?.paragraphs.bound).toBe(0);
  });
});
