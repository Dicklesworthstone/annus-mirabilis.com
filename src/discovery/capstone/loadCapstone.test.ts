/**
 * The capstone record resolved against the REAL corpus (am-disc-capstones-infra-3352).
 *
 * The fixture in capstoneSchema.test.ts proves the shape rules; this proves the ids. Every refusal
 * below is reached by breaking something that works today, either in a copy of the real record on
 * disk or in the loaded object, so each case differs from a passing one in exactly the thing it is
 * named for. Nothing here stubs a resolver: a stub agrees with whatever it is asked, and agreeing
 * is the failure this file exists to rule out.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { type Capstone, CapstoneSchemaError, checkCapstoneReferences } from "./capstoneSchema.ts";
import { capstoneExists, corpusResolvers, loadCapstone } from "./loadCapstone.ts";

const ROOT = process.cwd();
const RECORD = join(ROOT, "content", "arguments", "capstones", "mass-energy.yaml");

/**
 * A root that is the real corpus except for the capstone record, which is this test's to break. The
 * other content directories are symlinked rather than copied, so a plant is checked against the
 * same equations, bindings and instruments the site ships.
 */
function rootWithRecord(yaml: string): string {
  const root = mkdtempSync(join(tmpdir(), "capstone-"));
  mkdirSync(join(root, "content", "arguments", "capstones"), { recursive: true });
  for (const dir of ["equations", "bindings", "experiments", "scenarios"])
    symlinkSync(join(ROOT, "content", dir), join(root, "content", dir), "dir");
  writeFileSync(join(root, "content", "arguments", "capstones", "mass-energy.yaml"), yaml, "utf8");
  return root;
}

function refusalFrom(load: () => unknown): CapstoneSchemaError {
  try {
    load();
  } catch (error) {
    if (error instanceof CapstoneSchemaError) return error;
    throw error;
  }
  throw new Error("the record loaded when it should have been refused");
}

describe("the mass-energy capstone, against the corpus", () => {
  test("it loads, and every claim's anchor is a unit the paper actually prints", () => {
    const { capstone, equations } = loadCapstone("mass-energy");
    expect(capstone.id).toBe("capstone-mass-energy");
    expect(capstone.claims.length).toBeGreaterThan(0);

    // The population, read from the bindings independently of the loader's own resolver: a check
    // that asked the loader whether the loader was right would pass on any pair of wrong answers.
    const bindings = strictParse(
      readFileSync(join(ROOT, "content", "bindings", "mass-energy.yaml"), "utf8"),
      "yaml",
    ) as { paragraphs?: { unit: string }[]; displays?: { unit: string }[] };
    const printed = new Set([
      ...(bindings.paragraphs ?? []).map((p) => p.unit),
      ...(bindings.displays ?? []).map((d) => d.unit),
    ]);
    expect(printed.size).toBeGreaterThan(10);
    for (const claim of capstone.claims)
      expect([claim.id, printed.has(claim.anchor)]).toEqual([claim.id, true]);

    // Each annotated equation carries the words a reader hears and the display it is printed in.
    expect(equations.length).toBeGreaterThan(1);
    for (const equation of equations) {
      expect(equation.spoken.length).toBeGreaterThan(0);
      expect(printed.has(equation.displayUnit)).toBe(true);
    }
  });

  test("a paper with no capstone record is refused by name, not answered with an empty one", () => {
    // THE ABSENCE IS THIS TEST'S OWN, not the corpus's. It used to assert that light-quanta had no
    // capstone, with a comment saying three of the four were unwritten, which was true when it was
    // written and false the moment light-quanta's record landed. The test had borrowed a gap in the
    // corpus as its negative fixture, so it went red exactly when the project closed the gap, and
    // swapping in whichever paper is still unwritten would only move the same trap one paper along.
    //
    // The condition it creates instead: rootWithRecord writes the mass-energy record and no other
    // into a fresh root, so every other paper is absent THERE by construction. That holds at four
    // capstones, at five, and at none.
    const root = rootWithRecord(readFileSync(RECORD, "utf8"));

    // The positive control, in two parts. The root is a working corpus rather than an empty
    // directory, and the real corpus still has the record this file is about. Both are assertions
    // that something EXISTS, so content work can only make them more true.
    expect(capstoneExists("mass-energy", root)).toBe(true);
    expect(loadCapstone("mass-energy", root).capstone.id).toBe("capstone-mass-energy");
    expect(capstoneExists("mass-energy")).toBe(true);

    // And the refusal itself, for a real paper slug that this root does not carry.
    expect(capstoneExists("special-relativity", root)).toBe(false);
    const refusal = refusalFrom(() => loadCapstone("special-relativity", root));
    expect(refusal.code).toBe("capstone-record-missing");
    expect(refusal.message).toContain("special-relativity");
  });

  test("an equation the paper never prints is refused, with the id named", () => {
    // eq-model-me-mass-decrease is a real record with a real spoken form, so it passes every check
    // in checkCapstoneReferences. What it is not is bound to a printed display, which is the one
    // thing this refusal is about.
    const yaml = readFileSync(RECORD, "utf8").replace(
      "equationId: eq-model-me-symmetric-sum",
      "equationId: eq-model-me-mass-decrease",
    );
    expect(yaml).toContain("eq-model-me-mass-decrease");
    const root = rootWithRecord(yaml);
    const refusal = refusalFrom(() => loadCapstone("mass-energy", root));
    expect(refusal.code).toBe("capstone-equation-not-printed");
    expect(refusal.message).toContain("eq-model-me-mass-decrease");
  });

  test("a record whose paper field disagrees with its filename is refused", () => {
    // The mismatch is caught before any id is resolved, so the refusal names the disagreement
    // rather than the forty anchors that would fail against the wrong paper's bindings.
    const yaml = readFileSync(RECORD, "utf8").replace("paper: mass-energy", "paper: light-quanta");
    expect(yaml).toContain("paper: light-quanta");
    const refusal = refusalFrom(() => loadCapstone("mass-energy", rootWithRecord(yaml)));
    expect(refusal.code).toBe("capstone-paper-mismatch");
    expect(refusal.message).toContain("light-quanta");
  });

  test("the copied record is otherwise unchanged, so the plant above is the only difference", () => {
    // Without this, a plant that failed for an unrelated reason, a broken symlink or a truncated
    // copy, would read exactly like the refusal it was written to produce.
    const root = rootWithRecord(readFileSync(RECORD, "utf8"));
    expect(loadCapstone("mass-energy", root).capstone.id).toBe("capstone-mass-energy");
  });

  test("the resolvers refuse an anchor, an instrument, a tape and an equation that do not exist", () => {
    const { capstone } = loadCapstone("mass-energy");
    const resolvers = corpusResolvers();
    const broken = (change: (c: Capstone) => Capstone) =>
      refusalFrom(() => checkCapstoneReferences(change(capstone), resolvers)).code;

    expect(
      broken((c) => ({
        ...c,
        claims: c.claims.map((claim, index) =>
          index === 0 ? { ...claim, anchor: "s9-p99" } : claim,
        ),
      })),
    ).toBe("capstone-unresolved-anchor");
    expect(
      broken((c) => ({
        ...c,
        presets: c.presets.map((p, i) => (i === 0 ? { ...p, instrumentId: "me-99" } : p)),
      })),
    ).toBe("capstone-unresolved-instrument");
    expect(
      broken((c) => ({
        ...c,
        presets: c.presets.map((p, i) => (i === 0 ? { ...p, tapeId: "no-such-tape" } : p)),
      })),
    ).toBe("capstone-unresolved-tape");
    expect(
      broken((c) => ({
        ...c,
        equations: c.equations.map((e, i) =>
          i === 0 ? { ...e, equationId: "eq-model-me-nothing" } : e,
        ),
      })),
    ).toBe("capstone-unresolved-equation");

    // The positive control: the same resolvers on the untouched record raise nothing, so the four
    // refusals above are the plants rather than a resolver that refuses everything.
    expect(() => checkCapstoneReferences(capstone, resolvers)).not.toThrow();
  });

  test("the resolvers answer yes for things that do exist, so they are not refusing blind", () => {
    const resolvers = corpusResolvers();
    expect(resolvers.anchorExists("mass-energy", "s0-p7")).toBe(true);
    expect(resolvers.instrumentExists("me-01")).toBe(true);
    expect(resolvers.equationExists("eq-model-me-symmetric-sum")).toBe(true);
    expect(resolvers.equationHasSpokenForm("eq-model-me-symmetric-sum")).toBe(true);
    expect(resolvers.tapeExists?.("the-two-pulses")).toBe(true);
    expect(resolvers.presetExists?.("me-03", "me-03-sealed-lamp-and-mirror")).toBe(true);
    expect(resolvers.presetExists?.("me-03", "me-03-no-such-preset")).toBe(false);
  });
});
