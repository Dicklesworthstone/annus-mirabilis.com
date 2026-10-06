/**
 * WHAT EVERY acceptanceCases REF RESOLVES TO, BY KIND (am-nxbq).
 *
 * am-nxbq's first acceptance item asks for a gate that resolves every ref and fails on one that
 * resolves to nothing, printing the number examined and the number resolved. The answer it produced is
 * worse than a dangling id, and that is the finding:
 *
 *   119 refs over 33 manifests
 *    13  a scenario with expected outputs (content/scenarios/<ref>.yaml)
 *    62  a REGISTERED PRESET (REGISTERED_PRESET_IDS in the experiment schema)
 *     6  a declared string constant and nothing else (a component's PRESET_ORDER; MIXED_DIFFUSION_SCENARIO)
 *    38  nothing at all
 *
 * A PRESET IS NOT AN ACCEPTANCE CASE. It is a starting parameter set with no expected output, no
 * tolerance and no refusal. AGENTS.md requires acceptance cases "including refusals and non-numeric
 * results", so 106 of 119 refs name something that cannot satisfy the field they sit in whether or not
 * the name resolves. Of the 11 refs that name a refusal, ONE is a scenario.
 *
 * The baseline below records that, per laboratory and per kind, so the shape cannot drift unnoticed and
 * cannot be read as satisfied. It is a record of a debt: the slack test fails if a ref improves without
 * the record following it.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REGISTERED_PRESET_IDS } from "../../content/schemas/experiment.ts";
import {
  type AcceptanceRef,
  acceptanceCaseRefs,
  type RefResolution,
  type ResolveInputs,
  resolveAcceptanceCases,
  stringLiteralsOf,
  summarizeAcceptanceCases,
} from "./acceptanceCases.ts";

const ROOT = process.cwd();
const DECLARED = JSON.parse(
  readFileSync(join(ROOT, "src/testing/scenarios/acceptanceCaseDeclaredConstants.json"), "utf8"),
) as Record<string, string>;
const INPUTS: ResolveInputs = { declaredConstants: DECLARED };

/**
 * Measured 2026-10-05. A ceiling on what is NOT a scenario, and a floor on what is.
 *
 * The preset ceiling rose from 62 and the declared-constant ceiling fell from 6 in the same change,
 * and the pair has to be read together or it looks like a ceiling being raised to pass. Five refs
 * moved between the two buckets and none entered or left the debt: `sr-05-circle-0.6c`,
 * `sr-05-inertial-0.6c`, `sr-05-light-clock-0.6c`, `sr-05-low-speed-1e-4` and
 * `sr-05-out-and-back-0.6c` were classified here as declared constants - string literals in
 * MovingClocksLab.tsx's own preset ordering - only because REGISTERED_PRESET_IDS was missing all six
 * of sr-05's presets. With the registry completed against the manifests they classify as what they
 * are, and `diffusion-einstein-1905-modern-kb` is the one genuine declared constant left.
 *
 * NOT-A-SCENARIO IS UNCHANGED AT 106 ACROSS THE MOVE, which is the fact that makes it safe, and
 * `notAScenarioAtMost` below is asserted so that a future pair of edits cannot let a real regression
 * in one bucket hide behind a reduction in another.
 */
const EXPECTED = {
  scenarioAtLeast: 13,
  registeredPresetAtMost: 67,
  declaredConstantAtMost: 1,
  unresolvedAtMost: 38,
  notAScenarioAtMost: 106,
} as const;

const KINDS: readonly RefResolution[] = [
  "scenario",
  "registered-preset",
  "declared-constant",
  "unresolved",
];

describe("the acceptance-case refs of every manifest", () => {
  const resolved = resolveAcceptanceCases(ROOT, INPUTS, REGISTERED_PRESET_IDS);
  const count = (k: RefResolution) => resolved.filter((r) => r.resolution === k).length;

  it("prints the counts beside the verdict, over a real population", () => {
    console.log(`[acceptance cases] ${summarizeAcceptanceCases(resolved)}`);
    const refs = acceptanceCaseRefs(ROOT);
    expect(refs.length).toBeGreaterThanOrEqual(110);
    expect(new Set(refs.map((r) => r.lab)).size).toBeGreaterThanOrEqual(30);
    // A resolved count of 0 fails, as the acceptance requires.
    expect(count("scenario")).toBeGreaterThan(0);
  });

  it("THE TAXONOMY IS EXHAUSTIVE: every ref is exactly one kind, and there is no fifth", () => {
    // A ref that fell out of the classification is how this bead started, so the classes are checked
    // to cover the population rather than assumed to.
    expect(KINDS.map(count).reduce((a, b) => a + b, 0)).toBe(resolved.length);
    expect(resolved.filter((r) => !KINDS.includes(r.resolution))).toEqual([]);
    for (const row of resolved) expect(row.detail.length).toBeGreaterThan(10);
  });

  it("the kinds stay within their recorded figures, and scenarios do not fall", () => {
    expect(count("scenario")).toBeGreaterThanOrEqual(EXPECTED.scenarioAtLeast);
    expect(count("registered-preset")).toBeLessThanOrEqual(EXPECTED.registeredPresetAtMost);
    expect(count("declared-constant")).toBeLessThanOrEqual(EXPECTED.declaredConstantAtMost);
    // The number resolving to nothing may fall and must not rise.
    expect(count("unresolved")).toBeLessThanOrEqual(EXPECTED.unresolvedAtMost);
    // AND THE SUM, because the four ceilings above can each hold while refs move from a weaker class
    // into a stronger-sounding one. What may not rise is the total that is not a scenario: that is
    // the debt, and the per-bucket figures only say where it sits.
    const notAScenario = resolved.length - count("scenario");
    expect(notAScenario).toBeLessThanOrEqual(EXPECTED.notAScenarioAtMost);
  });

  it("every declared constant is still a string literal in the module that declares it", () => {
    const byFile = new Map<string, string[]>();
    for (const [ref, file] of Object.entries(DECLARED))
      byFile.set(file, [...(byFile.get(file) ?? []), ref]);
    const missing: string[] = [];
    for (const [file, refs] of byFile) {
      const literals = stringLiteralsOf(join(ROOT, file));
      for (const ref of refs) if (!literals.has(ref)) missing.push(`${file} lacks "${ref}"`);
    }
    expect(byFile.size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("the refusal refs are reported, and only one of eleven is a scenario", () => {
    // AGENTS.md requires acceptance cases including refusals. Reported with its denominator rather
    // than asserted met, because it is not met.
    const refusals = resolved.filter((r) => /refus/i.test(r.ref));
    const asScenario = refusals.filter((r) => r.resolution === "scenario");
    console.log(
      `[acceptance cases] ${refusals.length} ref(s) name a refusal: ${asScenario.length} is a scenario, ` +
        `${refusals.filter((r) => r.resolution === "unresolved").length} resolve to nothing`,
    );
    expect(refusals.length).toBeGreaterThan(0);
    expect(asScenario.length).toBeGreaterThanOrEqual(1);
  });
});

describe("the planted negatives am-nxbq asks for", () => {
  function tree(opts: { scenario?: string; literal?: string }): string {
    const root = mkdtempSync(join(tmpdir(), "acceptance-"));
    mkdirSync(join(root, "content/experiments"), { recursive: true });
    mkdirSync(join(root, "content/scenarios"), { recursive: true });
    mkdirSync(join(root, "src/fixtures"), { recursive: true });
    writeFileSync(
      join(root, "content/experiments/xx-01.yaml"),
      "id: xx-01\nacceptanceCases:\n  - one-golden\n  - two-refused\n",
    );
    if (opts.scenario !== undefined)
      writeFileSync(join(root, `content/scenarios/${opts.scenario}.yaml`), "id: x\n");
    writeFileSync(
      join(root, "src/fixtures/cases.ts"),
      opts.literal !== undefined
        ? `export const CASES = ["${opts.literal}"];\n`
        : '// "two-refused" is named here in a comment only\nexport const CASES: string[] = [];\n',
    );
    return root;
  }
  const none: ReadonlySet<string> = new Set();
  const find = (rows: readonly AcceptanceRef[], ref: string) => rows.find((r) => r.ref === ref);

  it("renaming a scenario file turns its ref unresolved, naming the ref", () => {
    const inputs: ResolveInputs = { declaredConstants: { "two-refused": "src/fixtures/cases.ts" } };
    const before = resolveAcceptanceCases(
      tree({ scenario: "one-golden", literal: "two-refused" }),
      inputs,
      none,
    );
    expect(find(before, "one-golden")?.resolution).toBe("scenario");
    const after = resolveAcceptanceCases(
      tree({ scenario: "one-golden-RENAMED", literal: "two-refused" }),
      inputs,
      none,
    );
    expect(find(after, "one-golden")?.resolution).toBe("unresolved");
    expect(find(after, "one-golden")?.detail).toContain("no scenario file");
  });

  it("a ref named only in a COMMENT is unresolved: this is the 38, and a grep called them resolved", () => {
    const inputs: ResolveInputs = { declaredConstants: { "two-refused": "src/fixtures/cases.ts" } };
    const rows = resolveAcceptanceCases(tree({ scenario: "one-golden" }), inputs, none);
    expect(find(rows, "two-refused")?.resolution).toBe("unresolved");
    expect(find(rows, "two-refused")?.detail).toContain("no longer holds");
  });

  it("a registered preset resolves as a preset, never as a scenario", () => {
    // The distinction the whole file turns on: the name resolves and the field is still unsatisfied.
    const rows = resolveAcceptanceCases(
      tree({ scenario: "one-golden" }),
      { declaredConstants: {} },
      new Set(["two-refused"]),
    );
    const row = find(rows, "two-refused");
    expect(row?.resolution).toBe("registered-preset");
    expect(row?.detail).toContain("no expected output and no refusal");
  });

  it("a declared module that does not exist is unresolved, naming the file", () => {
    const rows = resolveAcceptanceCases(
      tree({ scenario: "one-golden" }),
      { declaredConstants: { "two-refused": "src/fixtures/gone.ts" } },
      none,
    );
    expect(find(rows, "two-refused")?.detail).toContain("src/fixtures/gone.ts");
  });

  it("the literal reader tells a literal from a comment", () => {
    const root = mkdtempSync(join(tmpdir(), "literals-"));
    const path = join(root, "probe.ts");
    writeFileSync(
      path,
      '// "in-a-comment"\nexport const a = "a-literal";\nconst b = `a-template`;\n',
    );
    const found = stringLiteralsOf(path);
    expect(found.has("a-literal")).toBe(true);
    expect(found.has("a-template")).toBe(true);
    expect(found.has("in-a-comment")).toBe(false);
  });
});
