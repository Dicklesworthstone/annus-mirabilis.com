/**
 * English displays byte-identical to their aligned German blocks (am-rc1001-bridge-plan-pcjk.10).
 * The structural check meant to enforce it examined 0 blocks on the real corpus; this is the
 * audit verify-content now runs, and its proof in the unit lane.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditEquationIdentity, EQUATION_IDENTITY_MINIMUM } from "./equationIdentity.ts";

const ROOT = process.cwd();

describe("the real edition", () => {
  test("every equation block is examined, and every English display is the German one", () => {
    const audit = auditEquationIdentity(ROOT);
    console.log(
      `[audit-equation-identity] examined ${audit.blocks} equation blocks, ${audit.units} aligned English units: ${audit.report.errorCount} errors`,
    );
    // Measured 2026-10-02: 200 blocks, 200 units.
    expect(audit.blocks).toBeGreaterThanOrEqual(EQUATION_IDENTITY_MINIMUM);
    expect(audit.units).toBeGreaterThanOrEqual(audit.blocks);
    expect(audit.report.findings).toEqual([]);
    expect(audit.report.ok).toBe(true);
  });
});

describe("a planted difference is caught", () => {
  /** mass-energy's records in a scratch tree; the repository's are never touched. */
  function scratch(): string {
    const root = mkdtempSync(join(tmpdir(), "am-equation-identity-"));
    for (const dir of ["source-blocks", "translation-units"])
      cpSync(join(ROOT, "content", dir, "mass-energy"), join(root, "content", dir, "mass-energy"), {
        recursive: true,
      });
    mkdirSync(join(root, "content", "alignments"), { recursive: true });
    cpSync(
      join(ROOT, "content/alignments/mass-energy.yaml"),
      join(root, "content/alignments/mass-energy.yaml"),
    );
    return root;
  }
  const unitFile = (root: string, id: string) => {
    const dir = join(root, "content/translation-units/mass-energy");
    const name = readdirSync(dir).find((f) =>
      readFileSync(join(dir, f), "utf8").includes(`\nid: "${id}"\n`),
    );
    if (!name) throw new Error(`no translation unit ${id}`);
    return join(dir, name);
  };

  test("the scratch copy passes before anything is planted", () => {
    const audit = auditEquationIdentity(scratch(), ["mass-energy"], 7);
    expect(audit).toMatchObject({ blocks: 7, units: 7 });
    expect(audit.report.ok).toBe(true);
  });

  test("an English display one character different is refused, naming the block", () => {
    const root = scratch();
    const path = unitFile(root, "eq-s0-d2");
    const text = readFileSync(path, "utf8");
    const planted = text.replace("\\\\frac{L}{2} \\\\right]", "\\\\frac{L}{3} \\\\right]");
    expect(planted).not.toBe(text);
    writeFileSync(path, planted);
    const audit = auditEquationIdentity(root, ["mass-energy"], 7);
    expect(audit.report.ok).toBe(false);
    expect(audit.report.findings.map((f) => `${f.check}:${f.recordId}`)).toEqual([
      "equation-not-identical:eq-s0-d2",
    ]);
  });

  test("an equation block with no edge to an English unit is refused", () => {
    const root = scratch();
    const path = join(root, "content/alignments/mass-energy.yaml");
    const text = readFileSync(path, "utf8");
    const edge =
      / {2}- source:\n {6}paper: "mass-energy"\n {6}blockId: "eq-s0-d7"\n {4}target:\n {6}translationUnitId: "eq-s0-d7"\n/;
    expect(text.match(new RegExp(edge.source, "g"))?.length).toBe(1);
    writeFileSync(path, text.replace(edge, ""));
    const audit = auditEquationIdentity(root, ["mass-energy"], 7);
    expect(audit.report.findings.map((f) => `${f.check}:${f.recordId}`)).toEqual([
      "equation-unaligned:eq-s0-d7",
    ]);
  });

  test("a population under the minimum fails, so an empty corpus cannot pass", () => {
    const audit = auditEquationIdentity(ROOT, []);
    expect(audit.blocks).toBe(0);
    expect(audit.report.ok).toBe(false);
    expect(audit.report.findings.map((f) => f.check)).toEqual(["equation-identity-population"]);
  });
});
