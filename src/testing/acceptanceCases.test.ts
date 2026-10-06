/**
 * The acceptance-case resolver (am-nxbq, dispatch 304): that it examines the real population, that
 * every way of failing to resolve is refused by name, and that it cannot report a clean sweep over
 * nothing.
 *
 * THE PLANTS GO THROUGH OPTIONS, not through the tree. Several agents edit this checkout at once, so
 * a test that renamed content/scenarios/<id>.yaml to see the gate go red could be swept into a
 * peer's commit between the rename and the restore. The baseline and the fixture declarations are
 * both injectable for that reason, and each plant below lives for one assertion.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAcceptanceCases, loadAcceptanceBaseline } from "./acceptanceCases.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";

const report = checkAcceptanceCases();
const codes = (r: ReturnType<typeof checkAcceptanceCases>) => r.problems.map((p) => p.code);

describe("the instruments' acceptance cases", () => {
  test("the census counts the real population, and says how much of it resolved", () => {
    // The denominator is every ref in every manifest, and the instruments are all of them.
    expect(report.census.instruments).toBeGreaterThanOrEqual(33);
    expect(report.census.refs).toBeGreaterThan(100);
    expect(report.census.refs).toBe(report.census.resolved + report.census.dangling);
    // The scenarios are the ones the repository's own loader finds, so this gate and the scenario
    // tests cannot disagree about what exists.
    expect(report.census.scenarios).toBe(loadScenarios(defaultScenarioDirs()).length);
  });

  test("the tree is at its recorded debt, neither more nor less", () => {
    expect(report.problems.map((p) => `${p.code}: ${p.message}`)).toEqual([]);
    // The debt is real and this test is not vacuous about it: there IS dangling debt recorded, and
    // the day it reaches zero this assertion is what tells the next author to delete the baseline.
    expect(loadAcceptanceBaseline().length).toBeGreaterThan(0);
    expect(report.census.dangling).toBeGreaterThan(0);
  });

  test("something resolves, so the resolver is not simply failing to find anything", () => {
    expect(report.census.resolved).toBeGreaterThan(0);
    expect(report.census.viaScenario).toBeGreaterThan(0);
  });

  describe("each way of failing to resolve is refused by name", () => {
    test("the planted rename: a scenario file renamed, and the gate names the ref", () => {
      // The bead's own plant, done for real in a root of this test's own making, because renaming a
      // file in a checkout several agents are editing is not a thing a test may do.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-rename-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-02.yaml"),
        'id: "zz-02"\nacceptanceCases:\n  - "zz-02-golden"\n',
      );
      const scenario = [
        'id: "zz-02-golden"',
        'kind: "modern-golden"',
        'title: "x"',
        'description: "A scenario that exists, until it is renamed."',
        'constantSetId: "modern-si-2019"',
        'owner: "selfTest.timesTwoClosed"',
        "inputs:",
        "  x:",
        "    value: 1",
        '    unit: "1"',
        "expected:",
        "  outputs:",
        '    - outputId: "value"',
        "      value: 2",
        '      comparisonKind: "tolerance"',
        "      tolerance:",
        "        relative: 1.0e-9",
        '        rationale: "exact"',
        "modelVersion: 1",
        "schemaVersion: 1",
        "",
      ].join("\n");
      const before = join(root, "content", "scenarios", "zz-02-golden.yaml");
      writeFileSync(before, scenario);
      const found = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(found.census.resolved).toBe(1);
      expect(codes(found)).not.toContain("acceptance-ref-dangling");

      // RENAMING THE FILE ALONE DOES NOT BREAK THE REF, and that is the right behaviour: the
      // loader keys on the id inside the file, so a scenario keeps its identity when its file
      // moves. The bead's plant assumed a filename resolver; this pins what the resolver does
      // instead, so that nobody later "fixes" it into matching paths.
      const moved = join(root, "content", "scenarios", "zz-02-golden-renamed.yaml");
      renameSync(before, moved);
      const stillThere = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(stillThere.census.resolved).toBe(1);

      // THE PLANT: the scenario the ref names no longer exists, because its id changed. Nothing
      // else about the file changes.
      writeFileSync(moved, scenario.replace('id: "zz-02-golden"', 'id: "zz-02-golden-renamed"'));
      const after = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(after.census.resolved).toBe(0);
      expect(codes(after)).toContain("acceptance-ref-dangling");
      expect(after.problems.some((p) => p.message.includes("zz-02-golden"))).toBe(true);
    });

    test("a ref recorded as dangling that now resolves, so the baseline cannot go slack", () => {
      const planted = checkAcceptanceCases({
        baseline: [...loadAcceptanceBaseline(), "a-ref-no-manifest-names"],
      });
      expect(codes(planted)).toContain("acceptance-baseline-slack");
    });

    test("an in-code fixture declared in a file that does not exist", () => {
      const dangling = report.refs.find((r) => r.resolution === "dangling");
      expect(dangling).toBeDefined();
      const planted = checkAcceptanceCases({
        declarations: { [dangling?.ref ?? ""]: "src/testing/no-such-file.test.ts" },
      });
      expect(codes(planted)).toContain("acceptance-fixture-missing-file");
    });

    test("an in-code fixture declared in a file that does not contain it", () => {
      const dangling = report.refs.find((r) => r.resolution === "dangling");
      const planted = checkAcceptanceCases({
        // This very file exists and does not contain that id, so the declaration is a claim the
        // gate checks rather than believes.
        declarations: { [dangling?.ref ?? ""]: "src/testing/acceptanceCases.ts" },
      });
      expect(codes(planted)).toContain("acceptance-fixture-absent-from-file");
    });

    /**
     * EVERY INSTRUMENT NOW HAS A REFUSAL CASE, SO THE PLANT IS THE REMOVAL (am-nxbq, items 2 and 4).
     *
     * This test used to assert that `acceptance-instrument-without-refusal` was PRESENT, which was
     * true of a tree where 0 of 33 instruments had a resolvable refusal case and is no longer. An
     * assertion that the debt exists stops being a gate the moment the debt is paid: it would have
     * turned red on correct work and told the next author to put the hole back.
     *
     * So it is inverted, and the bead's own fourth item is what replaces it: delete one refusal case
     * and the gate goes red NAMING that instrument. The plant lives in a root this test makes, because
     * several agents edit this checkout at once and stripping a ref from a real manifest could be swept
     * into a peer's commit between the strip and the restore.
     *
     * THE NON-NUMERIC HALF IS NOW PAID TOO, and this docblock predicted its own next failure. It
     * used to end "The non-numeric half is still real debt, 32 of 33 instruments, and is asserted as
     * such below" - and the assertion below was `toContain("acceptance-instrument-without-non-numeric")`,
     * which is exactly the shape the paragraphs above call out. On 2026-10-06 bm-05, the last
     * unexcused instrument, got its case (content/scenarios/bm-05-cauchy-step-has-no-diffusivity.yaml)
     * and this test went RED ON CORRECT WORK, telling whoever read it to put the hole back. The same
     * repair is applied: the assertion is inverted and a plant replaces it, below the refusal one.
     *
     * Measured at that point: 33 instruments, 33 with a resolvable refusal case, 32 with a resolvable
     * non-numeric case, and ZERO problems carrying either code - the 33rd is lq-05, whose
     * `acceptanceCoverage.noNonNumericCase` is the criterion's own second branch.
     */
    test("THE REAL TREE: every instrument has a resolvable refusal case", () => {
      const strict = checkAcceptanceCases({ strict: true });
      const withRefusal = strict.census.instrumentsWithRefusal;
      const withNonNumeric = strict.census.instrumentsWithNonNumeric;
      console.log(
        `[acceptance] ${withRefusal} of ${strict.census.instruments} instrument(s) have a resolvable ` +
          `refusal case; ${strict.census.instrumentsWithNonNumeric} a non-numeric one`,
      );
      // Non-vacuity: there are instruments to judge, so "none is missing one" is a result.
      expect(strict.census.instruments).toBeGreaterThanOrEqual(33);
      expect(withRefusal).toBe(strict.census.instruments);
      expect(codes(strict)).not.toContain("acceptance-instrument-without-refusal");
      // BOTH halves are now paid, so both are asserted the same way. An instrument may satisfy the
      // non-numeric half with a resolvable case OR with a written declaration, which is the
      // criterion's own wording, and the code below fires when it has neither.
      expect(codes(strict)).not.toContain("acceptance-instrument-without-non-numeric");
      // NON-VACUITY IN THE OTHER DIRECTION, which the refusal half does not need and this one does:
      // a tree where EVERY instrument was excused by declaration would also carry no such code and
      // would mean nothing. This floor says most are covered by a real scenario. It was 32 of 33
      // when written; raise it as the last declaration is retired, never lower it.
      expect(withNonNumeric).toBeGreaterThanOrEqual(32);
    });

    test("PLANTED: an instrument whose refusal case is deleted is named under strict", () => {
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-no-refusal-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      // A scenario that expects a refusal, written here rather than copied, so the plant does not
      // depend on which real file happens to exist.
      writeFileSync(
        join(root, "content", "scenarios", "zz-01-refused.yaml"),
        [
          'id: "zz-01-refused"',
          'kind: "adversarial"',
          'title: "ZZ-01 refuses a setting outside its declared range"',
          'description: "A planted scenario whose only job is to expect a refusal."',
          'plausibleMistake: "That the value is close enough to compute."',
          'intendedFailure: "The gate refuses before a number is formed."',
          'constantSetId: "modern-si-2019"',
          'owner: "declaredDomain.sr-03"',
          "inputs:",
          "  v:",
          "    value: 0.96",
          '    unit: "c"',
          "expected:",
          "  status:",
          '    outputId: "v"',
          '    status: "outside-model-domain"',
          '    reasonCode: "above-max"',
          "modelVersion: 1",
          "schemaVersion: 1",
          "",
        ].join("\n"),
      );
      const manifest = join(root, "content", "experiments", "zz-01.yaml");
      const withCase = 'id: "zz-01"\nacceptanceCases:\n  - "zz-01-refused"\n';
      const withoutCase = 'id: "zz-01"\nacceptanceCases:\n  - "zz-01-refused-DELETED"\n';

      // THE CONTROL FIRST, so a gate that named every instrument would not satisfy the plant.
      writeFileSync(manifest, withCase);
      const before = checkAcceptanceCases({ root, strict: true, baseline: [], declarations: {} });
      expect(before.census.instrumentsWithRefusal).toBe(1);
      expect(codes(before)).not.toContain("acceptance-instrument-without-refusal");

      // THE PLANT: the ref is deleted, and the gate names the instrument that lost it.
      writeFileSync(manifest, withoutCase);
      const after = checkAcceptanceCases({ root, strict: true, baseline: [], declarations: {} });
      expect(after.census.instrumentsWithRefusal).toBe(0);
      expect(codes(after)).toContain("acceptance-instrument-without-refusal");
      expect(
        after.problems.find((p) => p.code === "acceptance-instrument-without-refusal")?.message,
      ).toContain("zz-01");
    });

    test("PLANTED: an instrument whose non-numeric case is deleted is named under strict", () => {
      // The non-numeric twin of the plant above, added when the assertion it replaces was inverted.
      // `not-applicable` is in NON_NUMERIC_STATUSES and is NOT a key of refusalCodeRegistry, which
      // the classifier consults FIRST - so this scenario counts as non-numeric and not as a refusal.
      // Checked rather than assumed: a status in both sets would classify as a refusal and this plant
      // would then be testing the other half while appearing to test this one.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-no-non-numeric-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "scenarios", "zz-02-no-value.yaml"),
        [
          'id: "zz-02-no-value"',
          'kind: "adversarial"',
          'title: "ZZ-02 reports no value where its model defines none"',
          'description: "A planted scenario whose only job is to expect a non-numeric result."',
          'plausibleMistake: "That a number can stand in for a quantity the model does not define."',
          'intendedFailure: "The evaluator reports the quantity as not applicable to these conditions."',
          'constantSetId: "modern-si-2019"',
          'owner: "declaredDomain.sr-03"',
          "inputs:",
          "  v:",
          "    value: 0.5",
          '    unit: "c"',
          "expected:",
          "  status:",
          '    outputId: "v"',
          '    status: "not-applicable"',
          '    reasonCode: "not-applicable"',
          "modelVersion: 1",
          "schemaVersion: 1",
          "",
        ].join("\n"),
      );
      const manifest = join(root, "content", "experiments", "zz-02.yaml");
      const withCase = 'id: "zz-02"\nacceptanceCases:\n  - "zz-02-no-value"\n';
      const withoutCase = 'id: "zz-02"\nacceptanceCases:\n  - "zz-02-no-value-DELETED"\n';

      // THE CONTROL FIRST, so a gate that named every instrument would not satisfy the plant.
      writeFileSync(manifest, withCase);
      const before = checkAcceptanceCases({ root, strict: true, baseline: [], declarations: {} });
      expect(before.census.instrumentsWithNonNumeric).toBe(1);
      expect(codes(before)).not.toContain("acceptance-instrument-without-non-numeric");

      // THE PLANT: the ref is deleted, and the gate names the instrument that lost it.
      writeFileSync(manifest, withoutCase);
      const after = checkAcceptanceCases({ root, strict: true, baseline: [], declarations: {} });
      expect(after.census.instrumentsWithNonNumeric).toBe(0);
      expect(codes(after)).toContain("acceptance-instrument-without-non-numeric");
      expect(
        after.problems.find((p) => p.code === "acceptance-instrument-without-non-numeric")?.message,
      ).toContain("zz-02");
    });

    test("PLANTED: a scenario that no longer expects a refusal stops counting as one", () => {
      // The subtler direction, and the one a spelling-based census would miss: the ref resolves, the
      // file exists, and the instrument still has no refusal case because the scenario expects a
      // number. The kind is read from `expected.status`, never from the id.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-kind-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-01.yaml"),
        'id: "zz-01"\nacceptanceCases:\n  - "zz-01-looks-refused"\n',
      );
      writeFileSync(
        join(root, "content", "scenarios", "zz-01-looks-refused.yaml"),
        [
          'id: "zz-01-looks-refused"',
          'kind: "modern-golden"',
          'title: "ZZ-01, named as a refusal and expecting a number"',
          'description: "The id says refused and the expectation does not."',
          'constantSetId: "modern-si-2019"',
          'owner: "selfTest.timesTwoClosed"',
          "inputs:",
          "  x:",
          "    value: 2",
          '    unit: "1"',
          "expected:",
          "  outputs:",
          '    - outputId: "value"',
          "      value: 4",
          '      unit: "1"',
          '      comparisonKind: "tolerance"',
          "      tolerance:",
          "        relative: 1.0e-9",
          '        rationale: "Planted; the expectation is a number so the kind is not a refusal."',
          "modelVersion: 1",
          "schemaVersion: 1",
          "",
        ].join("\n"),
      );
      const planted = checkAcceptanceCases({ root, strict: true, baseline: [], declarations: {} });
      // It resolved, so this is not a dangling-ref finding.
      expect(planted.census.resolved).toBe(1);
      expect(codes(planted)).not.toContain("acceptance-ref-dangling");
      // And it is still not a refusal case, because the expectation is a number.
      expect(planted.census.instrumentsWithRefusal).toBe(0);
      expect(codes(planted)).toContain("acceptance-instrument-without-refusal");
    });

    test("a run that resolves nothing fails, whatever the baseline holds", () => {
      // A REAL PLANT, not a faked count. A root with manifests and no scenarios at all is exactly
      // the shape the guard exists for: every ref dangling, every one of them excused by the
      // baseline, and a report that would otherwise read as clean. The directory is left where it
      // is when the test ends, because this repository does not delete.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-01.yaml"),
        'id: "zz-01"\nacceptanceCases:\n  - "zz-01-nothing-points-here"\n',
      );
      const planted = checkAcceptanceCases({
        root,
        baseline: ["zz-01-nothing-points-here"],
        declarations: {},
      });
      expect(planted.census.refs).toBe(1);
      expect(planted.census.resolved).toBe(0);
      expect(codes(planted)).toContain("acceptance-nothing-resolved");
      // And the baseline did excuse the dangling ref, so the only thing failing it is the guard.
      expect(codes(planted)).not.toContain("acceptance-ref-dangling");
    });
  });

  /**
   * A REF THAT IS THE INSTRUMENT'S OWN PRESET IS A DIFFERENT DEBT (am-nxbq, 2026-10-05).
   *
   * 67 of the tree's 106 dangling refs are a preset the same manifest declares, and a preset is
   * `{ label, parameterValues }` with no expectation, so such a ref asserts nothing about a result.
   * The three tests below pin the distinction in both directions, because a diagnosis that fires on
   * everything is no more useful than one that fires on nothing: the second test is the control where
   * the ref is NOT a preset and must get the plain dangling code instead.
   */
  describe("the split between a dangling ref and a ref that is its own preset", () => {
    const manifest = (cases: readonly string[], presets: readonly string[]) =>
      [
        'id: "zz-04"',
        "acceptanceCases:",
        ...cases.map((c) => `  - ${JSON.stringify(c)}`),
        "presets:",
        ...presets.flatMap((p) => [`  - presetId: ${JSON.stringify(p)}`, `    label: "A preset"`]),
        "",
      ].join("\n");

    test("PLANTED: a case naming this manifest's own preset is named as a preset, not as missing", () => {
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-own-preset-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-04.yaml"),
        manifest(["zz-04-slow"], ["zz-04-slow"]),
      );
      const planted = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(planted.census.refs).toBe(1);
      expect(planted.census.presetsDeclared).toBe(1);
      expect(planted.census.danglingOwnPreset).toBe(1);
      expect(planted.census.danglingOther).toBe(0);
      expect(codes(planted)).toContain("acceptance-ref-is-a-preset");
      // The accurate diagnosis REPLACES the vague one rather than joining it, so the author is not
      // told to write a file named after the preset.
      expect(codes(planted)).not.toContain("acceptance-ref-dangling");
      expect(
        planted.problems.find((p) => p.code === "acceptance-ref-is-a-preset")?.message,
      ).toContain("zz-04-slow");
      // It is NOT a second kind of resolution. The ref still resolves to nothing.
      expect(planted.census.resolved).toBe(0);
      expect(planted.census.dangling).toBe(1);
    });

    test("THE CONTROL: a case that is not a preset still gets the plain dangling code", () => {
      // Without this, a preset code that fired on every dangling ref would pass the test above.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-not-preset-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-04.yaml"),
        manifest(["zz-04-no-such-case"], ["zz-04-slow"]),
      );
      const planted = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(planted.census.presetsDeclared).toBe(1);
      expect(planted.census.danglingOwnPreset).toBe(0);
      expect(planted.census.danglingOther).toBe(1);
      expect(codes(planted)).toContain("acceptance-ref-dangling");
      expect(codes(planted)).not.toContain("acceptance-ref-is-a-preset");
    });

    test("a preset that ALSO has a real scenario resolves, and is diagnosed as neither", () => {
      // The ordering that matters: the preset mark is reached only after both resolutions have been
      // tried. A manifest is allowed to name a preset AND have a scenario stating what those
      // parameters produce, which is exactly the repair the 67 need, so that repair must not keep
      // reading as the defect it fixes.
      const root = mkdtempSync(join(tmpdir(), "am-acceptance-preset-with-scenario-"));
      mkdirSync(join(root, "content", "experiments"), { recursive: true });
      mkdirSync(join(root, "content", "scenarios"), { recursive: true });
      writeFileSync(
        join(root, "content", "experiments", "zz-04.yaml"),
        manifest(["zz-04-slow"], ["zz-04-slow"]),
      );
      writeFileSync(
        join(root, "content", "scenarios", "zz-04-slow.yaml"),
        [
          'id: "zz-04-slow"',
          'kind: "modern-golden"',
          'title: "ZZ-04 at the slow preset"',
          'description: "What the slow preset\'s parameters should produce."',
          'constantSetId: "modern-si-2019"',
          'owner: "selfTest.timesTwoClosed"',
          "inputs:",
          "  x:",
          "    value: 3",
          '    unit: "1"',
          "expected:",
          "  outputs:",
          '    - outputId: "value"',
          "      value: 6",
          '      unit: "1"',
          '      comparisonKind: "tolerance"',
          "      tolerance:",
          "        relative: 1.0e-9",
          '        rationale: "Exact in this evaluator."',
          "modelVersion: 1",
          "schemaVersion: 1",
          "",
        ].join("\n"),
      );
      const resolved = checkAcceptanceCases({ root, baseline: [], declarations: {} });
      expect(resolved.census.resolved).toBe(1);
      expect(resolved.census.viaScenario).toBe(1);
      expect(resolved.census.danglingOwnPreset).toBe(0);
      expect(codes(resolved)).not.toContain("acceptance-ref-is-a-preset");
      expect(codes(resolved)).not.toContain("acceptance-ref-dangling");
      expect(resolved.refs[0]?.ownPreset).toBeUndefined();
    });

    test("THE REAL TREE: the split is exhaustive, and both sides are occupied", () => {
      const c = report.census;
      console.log(
        `[acceptance] ${c.dangling} dangling of ${c.refs} refs: ${c.danglingOwnPreset} a preset of ` +
          `the instrument that names it, ${c.danglingOther} neither; ${c.presetsDeclared} presets ` +
          `declared across ${c.instruments} manifests`,
      );
      // Exhaustive: every dangling ref is in exactly one of the two buckets.
      expect(c.danglingOwnPreset + c.danglingOther).toBe(c.dangling);
      // Non-vacuity, deliberately, both ways: a split with one empty side would make either half of
      // the diagnosis untested by the real tree while reading as a clean result.
      expect(c.danglingOwnPreset).toBeGreaterThan(0);
      expect(c.danglingOther).toBeGreaterThan(0);
      expect(c.presetsDeclared).toBeGreaterThan(0);
    });
  });
});
