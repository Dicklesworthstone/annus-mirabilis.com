/**
 * A TYPED REFUSAL FLATTENED INTO A STRING, COUNTED AND HELD DOWN (am-ig23).
 *
 * `String(r.refusal.details?.requirements ?? r.refusal.message)` is one expression written out by hand in
 * twenty-six places. The sentence it produces is correct and a reader sees it. What it throws away is the
 * refusal's CODE, its RANKED REPAIRS and the staleness marking - three of the four things AGENTS.md's refusal
 * contract asks for: "freeze the illegal step, show the reason, and keep the last legal state", with an
 * admissible boundary offered.
 *
 * Measured on bm-08 before its repair, after a reader entered an exposure of 0.3 s: the notice read the right
 * sentence, no element carried `data-refusal-code` so the code `off-replay-grid` was nowhere, no element
 * carried `data-currency-state` so the accepted readouts were not marked stale, and the repair the parameter
 * schema supplies was never offered.
 *
 * WORSE IN A `throw` THAN IN A `setState`, which is why the controls modules are in the list beside the
 * components. Five `controls.ts` modules validate a draft and throw the sentence, so nothing downstream can
 * tell a refusal from an ordinary programming error. bm-08's now throws `ParameterRefusalError`, which carries
 * the whole refusal.
 *
 * THIS LIST ONLY EVER COMES DOWN. The assertion is an equality, so converting a site means deleting its line,
 * and a new one fails outright. src/experiments/results/applyFailure.ts and refusalSentence.ts are the shared
 * half the remaining sites can adopt.
 *
 * IN THE NODE LANE, because it reads `git ls-files` and bun's test runner cannot posix_spawn git on this host
 * (bunfig.toml's own header records the EBADF). The tracked list is the right population: an untracked scratch
 * file is not a site anyone has to convert, and a filesystem walk would count one.
 *
 * COMMENTS ARE BLANKED FIRST, and that is not pedantry here: the three files already converted carry docblocks
 * QUOTING the expression to record what was wrong with it. A scan over raw text counts those explanations as
 * defects, which is AGENTS.md's "a gate that forbids a construct must read code, not text" with the gate's own
 * repair notes as the victim.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { blankComments } from "../source/comments.ts";

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/**
 * The one module where this expression BELONGS: `refusalSentence` is the canonical implementation every other
 * site should call instead of re-deriving. Excluded by name, and asserted below to still contain it, so the
 * exclusion cannot quietly cover a change.
 */
const CANONICAL = "src/experiments/results/refusalSentence.ts";

/**
 * THE RECORDED DEBT, measured 2026-10-06 with comments blanked: 10 sites in 9 files.
 *
 * It opened at 26 in 25. Eight came off the same day, in two passes - bm05, bm07, WalkLab, InferenceLab, then
 * sr03, sr06, RodSimultaneityLab and VelocityCompositionLab - and the ratchet went RED each time, which is the
 * mechanism working: a baseline entry that no longer holds is a failure, so the conversions and this list land
 * in one commit rather than leaving HEAD red in between.
 *
 * Each is a place that flattens a typed refusal to its sentence. Converting one means pointing it at
 * `applyFailure`/`refusalSentence` and keeping the refusal, which is a per-lab change with a reader-facing
 * surface to get right, not a rename. Filed on am-ig23.
 *
 * THAT ONE SHAPE WAS BLOCKED ON A DESIGN DECISION AND THE DECISION IS TAKEN, 2026-10-09. The note here
 * used to say lq08/PhotoelectricLab.tsx could not be converted because it calls `setError` for a model
 * refusal AND for client-side field validation ("Thermal: enter a number.", lq08RangeSentence), and that
 * an ApplyFailure cannot honestly carry the second: `unexplained` means a RESULT that explained nothing,
 * while a field a reader left blank produced no result at all. That diagnosis was right, and the answer
 * is the one it points at: the component keeps TWO pieces of state. `failure` is the typed refusal and
 * owns the code, the ranked repairs and the staleness marking; `error` stays an ordinary string for the
 * form's own hint about text that is not a number. Setting either clears the other, so one notice is
 * live at a time and a mistyped digit is never recorded as an engine fault.
 *
 * Five components were converted that way: lq06, lq08, lq09, sr07 and BrownianInvestigation.tsx,
 * whose own two strings are a full notebook and a refused download rather than field validation.
 *
 * THE REMAINING FOUR ARE A DIFFERENT PROBLEM, and it is not effort either. None is a component:
 * each flattens into a sink that takes a STRING, so the refusal is lost at the boundary rather than
 * in a setState, and converting one means changing that sink's contract and every caller.
 *
 *   discovery/lightQuanta/investigation.ts   `fail(reason: string)` from a pure validator
 *   experiments/bm07/kitchen/analyze.ts      `reason<T>(r): string`, whose JOB is to make a sentence
 *   experiments/compare/controlledComparison.ts  a `failure(message, active)` callback
 *
 * reasoning/infer/browser.ts WAS the fourth and is converted, and it is the one that shows the shape
 * of the remaining three. Its string was not a mistake: `announce` writes a live region, which
 * genuinely takes text. So the sentence stayed a sentence and the CODE moved to an attribute on the
 * case element, beside the identities that module already publishes. It also keeps its own
 * discrimination rather than adopting `applyFailure`, because its session has a fourth kind,
 * `no-value`, whose `reason` applyFailure would replace with generic text.
 *
 * Expect the same two questions for each of the three left: what does this sink's consumer actually
 * need, and does the result union have a kind applyFailure does not know.
 */
const FLATTENING_SITES: Readonly<Record<string, number>> = {
  "src/discovery/lightQuanta/investigation.ts": 1,
  "src/experiments/bm07/kitchen/analyze.ts": 1,
  "src/experiments/compare/controlledComparison.ts": 1,
};

/**
 * TWO REGEXES FOR ONE PATTERN, and the reason is a real bug this file hit.
 *
 * `assert.match` calls `regexp.test(string)`, and `test` on a GLOBAL regex advances its `lastIndex` and keeps
 * it. Sharing one `/g` object across assertions therefore makes the second one start reading part-way into its
 * string: the "still mentions it in prose" case passed for the first file and failed for the second, on a file
 * that plainly contains the text. `matchAll` does not have that problem, so the global form is kept for
 * counting and a stateless form is used for asking.
 */
const PATTERN_ALL = /refusal\.details\?\.requirements/g;
const PATTERN = /refusal\.details\?\.requirements/;

/** Count the expression in CODE, per file, over the tracked non-test sources. */
export function countFlatteningSites(root: string): {
  perFile: Record<string, number>;
  filesScanned: number;
  total: number;
} {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
  const perFile: Record<string, number> = {};
  let total = 0;
  for (const file of files) {
    if (file === CANONICAL) continue;
    const code = blankComments(readFileSync(join(root, file), "utf8"));
    const hits = [...code.matchAll(PATTERN_ALL)].length;
    if (hits > 0) {
      perFile[file] = hits;
      total += hits;
    }
  }
  return { perFile, filesScanned: files.length, total };
}

const report = countFlatteningSites(ROOT);

test("the scan is over a real population, printed beside the verdict", () => {
  // A `git ls-files` that returned nothing, or a filter that excluded everything, would report zero sites and
  // read as a converged codebase.
  assert.ok(report.filesScanned > 1000, `only ${report.filesScanned} files scanned`);
  assert.ok(
    report.total > 0,
    "no flattening site found at all, which would mean the pattern stopped matching",
  );
  console.log(
    `[flattened refusals] ${report.filesScanned} tracked non-test sources scanned; ` +
      `${report.total} flattening site(s) in ${Object.keys(report.perFile).length} file(s), comments blanked`,
  );
});

test("no file flattens a refusal except the ones recorded, with the recorded count", () => {
  assert.deepEqual(report.perFile, FLATTENING_SITES);
});

test("the canonical implementation is excluded BY NAME and still contains the expression", () => {
  // Without the second half, the exclusion could hide the canonical helper being deleted or rewritten, and the
  // whole list would then point at nothing to adopt.
  const canonical = readFileSync(join(ROOT, CANONICAL), "utf8");
  assert.match(blankComments(canonical), PATTERN);
  assert.ok(!Object.keys(report.perFile).includes(CANONICAL));
});

test("the converted paths are NOT in the list, which is what conversion looks like", () => {
  // bm-08's component and its controls module were converted on 2026-10-06, and both still carry docblocks
  // QUOTING the expression to record what was wrong with it. A scan over raw text would count those
  // explanations as defects; with comments blanked they are absent, which is the conversion and the blanker
  // proving itself at once.
  const converted = [
    "src/components/lab/CameraLab.tsx",
    "src/experiments/bm08/controls.ts",
    "src/components/lab/WalkLab.tsx",
    "src/components/lab/InferenceLab.tsx",
    "src/experiments/bm05/controls.ts",
    "src/experiments/bm07/controls.ts",
    "src/components/lab/RodSimultaneityLab.tsx",
    "src/components/lab/sr06/VelocityCompositionLab.tsx",
    "src/experiments/sr03/controls.ts",
    "src/experiments/sr06/controls.ts",
    "src/components/lab/TracerLab.tsx",
    "src/components/lab/BrownianLab.tsx",
    "src/components/lab/lq03/SpectrumLab.tsx",
    "src/components/lab/sr04/LorentzMapLab.tsx",
    "src/components/lab/WaveDescriptionLab.tsx",
    "src/components/lab/lq04/EntropyWorkbenchLab.tsx",
    "src/components/lab/bm03/ConfigurationLab.tsx",
    "src/components/lab/DriftDiffusionLab.tsx",
    "src/components/lab/lq06/CoefficientMatchLab.tsx",
    "src/components/lab/lq08/PhotoelectricLab.tsx",
    "src/components/lab/lq09/IonizationLab.tsx",
    "src/components/lab/sr07/FieldEquationsLab.tsx",
    "src/components/discover/BrownianInvestigation.tsx",
    "src/reasoning/infer/browser.ts",
  ];
  for (const file of converted) assert.ok(!Object.keys(report.perFile).includes(file), file);
  /*
   * AND THE CONTROL, narrowed to what is actually true. The first version asserted that EVERY converted file
   * still mentions the expression in prose, which is a property of how each conversion happened to be
   * commented rather than a requirement, and it failed on InferenceLab - correctly. What the control is for is
   * showing that the blanker is what excludes these files, not their no longer containing the words at all.
   * Two of them carry a docblock quoting the old expression, so they make that point; the PLANTED case below
   * makes it directly on the blanker.
   */
  for (const documented of ["src/components/lab/CameraLab.tsx", "src/experiments/bm08/controls.ts"])
    assert.match(
      readFileSync(join(ROOT, documented), "utf8"),
      PATTERN,
      `${documented} documents the old expression, so raw text would count it`,
    );
});

test("the recorded debt names only real files, and no duplicates", () => {
  const names = Object.keys(FLATTENING_SITES);
  assert.equal(new Set(names).size, names.length);
  // The ceiling, lowered with each payment: 26 at 2026-10-06, 10 after the first thirteen
  // conversions, then 5, 4 and 3 after lq06/lq08/lq09/sr07, BrownianInvestigation and
  // reasoning/infer/browser.ts, all on 2026-10-09. It never rises without a reason written beside
  // it, because a baseline that only goes up is a budget.
  assert.equal(
    Object.values(FLATTENING_SITES).reduce((a, b) => a + b, 0),
    3,
  );
  for (const name of names) assert.doesNotThrow(() => readFileSync(join(ROOT, name), "utf8"));
});

test("PLANTED: the expression in code is counted, and in a comment is not", () => {
  // Both directions through the real blanker, since the whole measurement rests on it.
  const inCode = "const t = String(r.refusal.details?.requirements ?? r.refusal.message);";
  const inComment = "// was String(r.refusal.details?.requirements ?? r.refusal.message)";
  assert.equal([...blankComments(inCode).matchAll(PATTERN_ALL)].length, 1);
  assert.equal([...blankComments(inComment).matchAll(PATTERN_ALL)].length, 0);
  const inBlock =
    "/**\n * This was String(r.refusal.details?.requirements ?? r.refusal.message).\n */";
  assert.equal([...blankComments(inBlock).matchAll(PATTERN_ALL)].length, 0);
});
