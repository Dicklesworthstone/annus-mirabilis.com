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

describe("every paper on the required list is fully bound or declared", () => {
  for (const paper of BINDINGS_REQUIRED)
    test(paper, () => {
      const r = checkParagraphBindings(ROOT, paper);
      if (!r) throw new Error(`${paper} is required and has no manifest`);
      console.log(`[bindings] ${reportLine(r)}`);
      expect(r.problems).toEqual([]);
      expect(r.paragraphs.of).toBeGreaterThan(0);
      expect(r.paragraphs.bound + r.paragraphs.declared).toBe(r.paragraphs.of);
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

  describe("a paragraph no passage explains is declared unexplained, with its reason and its r0", () => {
    const P15 = "  - unit: s0-p15\n    passages: [arg-me-scope]\n";
    const declare = (lines: string) => (y: string) => {
      if (!y.includes(P15))
        throw new Error("the s0-p15 binding moved; this fixture needs updating");
      return y.replace(P15, `  - unit: s0-p15\n${lines}`);
    };
    const REASON = '    reason: "No passage explains it yet."\n';

    test("accepted: counted as declared, not as bound, and named in the report", () => {
      const root = copyWith("declared", declare(`    status: unexplained\n${REASON}`));
      const r = checkParagraphBindings(root, "mass-energy");
      if (!r) throw new Error("no report");
      expect(r.problems).toEqual([]);
      expect(r.paragraphs.declared).toBe(1);
      expect(r.paragraphs.bound + r.paragraphs.declared).toBe(r.paragraphs.of);
      expect(reportLine(r)).toContain(", 1 declared unexplained,");
    });

    test("refused: declared without a reason", () => {
      expect(problems("no-reason", declare("    status: unexplained\n"))).toContain(
        "mass-energy s0-p15 is declared unexplained without a reason",
      );
    });

    test("refused: declared and bound to passages at once", () => {
      expect(
        problems(
          "both",
          declare(`    status: unexplained\n${REASON}    passages: [arg-me-scope]\n`),
        ),
      ).toContain(
        "mass-energy s0-p15 names passages and is declared unexplained; it is one or the other",
      );
    });

    test("refused: any status other than unexplained", () => {
      expect(problems("other", declare(`    status: printed-only\n${REASON}`))).toContain(
        "mass-energy s0-p15 declares printed-only; a paragraph may only be declared unexplained",
      );
    });

    test("refused: declared without its r0", () => {
      const got = problems("no-r0", (y) =>
        declare(`    status: unexplained\n${REASON}`)(y).replace(
          /( {2}- unit: s0-p15\n(?: {4}(?!r0).*\n)*) {4}r0: .*\n/,
          "$1",
        ),
      );
      expect(got).toContain("mass-energy s0-p15 has no r0 overview");
    });
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
