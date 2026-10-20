/**
 * THE CLAIM THAT LICENSES THE CIRCULARITY CENSUS'S ZERO, PLANTED OVER THE REAL RECORDS.
 *
 * `run.ts` prints "[epistemic-circularity] 0 proof record(s) and 0 proof-graph node(s) examined,
 * so the cycle and oracle loops ran ZERO times", and its docblock accepts that zero on one
 * ground: "cycles among arguments ARE checked, by a different and working check" --
 * `prerequisite-cycle`, in the compiler, over the arguments' typed `prerequisites` edges.
 *
 * That sentence is load-bearing. It is the reason a gate AGENTS.md calls non-negotiable ("No
 * circular explanations ... Each derivation has an explicit, acyclic dependency graph") is allowed
 * to report nothing. And the only thing standing behind it was a TWO-RECORD FIXTURE in
 * `readingCompiler.test.mjs`: `f("a", ["b"])` and `f("b", ["a"])`. A fixture shows the detector
 * works on a fixture. It cannot show the detector reaches the 48 argument records on disk with
 * their 42 typed prerequisite edges, which is what the claim is about.
 *
 * So this plants into the REAL corpus, in memory, and asserts the compiler catches it. Nothing in
 * the checkout is touched: the records are read, two of them are given prerequisites pointing at
 * each other, and the modified texts are passed to the compiler.
 *
 * WHY IT LIVES HERE rather than beside the compiler. The gate is the compiler's; the CLAIM is this
 * directory's, and a proof kept only in the lane whose gate it describes disappears at the moment
 * that gate fails open. If `prerequisite-cycle` ever stops reaching the real arguments, this test
 * goes red next to the census that depends on it.
 */

import { describe, expect, test } from "bun:test";
import { loadReadingFiles } from "../../../../scripts/build-content.ts";
import { compileContent } from "../../compiler/compiler.ts";

const ROOT = process.cwd();
const ARGUMENT_FILE = /arguments\/[^/]+\/arg-[^/]+\.json$/;
const files = await loadReadingFiles(ROOT);
const argumentFiles = files.filter((f) => ARGUMENT_FILE.test(f.path));

/** `id` off a record's JSON, so the plant points at the id the compiler will index. */
function idOf(text: string): string {
  return String((JSON.parse(text) as { id?: unknown }).id);
}

/** The record with one more prerequisite, typed as a premise edge, which is the real vocabulary. */
function withPrerequisite(text: string, target: string): string {
  const record = JSON.parse(text) as Record<string, unknown>;
  const existing = Array.isArray(record.prerequisites) ? record.prerequisites : [];
  record.prerequisites = [...existing, { id: target, edge: "premise" }];
  return JSON.stringify(record, null, 2);
}

const cycleFindings = (diagnostics: readonly { code: string }[]) =>
  diagnostics.filter((d) => d.code === "prerequisite-cycle");

describe("argument prerequisite cycles are caught over the records on disk", () => {
  test("the corpus supplies a real population of arguments to plant into", () => {
    // The denominator, named. A plant into two records proves nothing about a corpus of two.
    console.log(
      `[census] argument-cycle plant: ${argumentFiles.length} argument record(s) loaded from ${files.length} content file(s)`,
    );
    expect(argumentFiles.length).toBeGreaterThan(20);
  });

  test("the unplanted corpus has NO cycle finding, so the plant below means something", async () => {
    const baseline = await compileContent(files);
    expect(cycleFindings(baseline.diagnostics)).toEqual([]);
    // And the compiler reached a verdict rather than refusing early.
    expect(baseline.ok).toBe(true);
  });

  test("a two-cycle planted between two real arguments is caught, as an error", async () => {
    const a = argumentFiles[0];
    const b = argumentFiles[1];
    expect(a, "two argument records are needed").toBeDefined();
    expect(b).toBeDefined();
    if (a === undefined || b === undefined) return;
    const aId = idOf(a.text);
    const bId = idOf(b.text);
    expect(aId).not.toBe(bId);

    const planted = files.map((f) => {
      if (f.path === a.path) return { ...f, text: withPrerequisite(f.text, bId) };
      if (f.path === b.path) return { ...f, text: withPrerequisite(f.text, aId) };
      return f;
    });

    // WHAT LANDED, asserted before the verdict is read: a plant that did not apply produces a
    // green that means nothing.
    const plantedA = planted.find((f) => f.path === a.path);
    const prerequisites = (JSON.parse(plantedA?.text ?? "{}") as { prerequisites?: unknown[] })
      .prerequisites;
    expect(JSON.stringify(prerequisites)).toContain(bId);

    const after = await compileContent(planted);
    const found = cycleFindings(after.diagnostics);
    expect(
      found.length,
      `codes: ${after.diagnostics.map((d) => d.code).join(", ")}`,
    ).toBeGreaterThan(0);
    expect(after.ok).toBe(false);
    for (const finding of found) {
      expect((finding as { severity?: string }).severity).toBe("error");
    }
    // The message names the cycle rather than only reporting one, so an author can find it.
    expect(after.diagnostics.find((d) => d.code === "prerequisite-cycle")?.message).toContain(aId);
  });

  test("an edge to a nonexistent id is a dangling reference, NOT a cycle", async () => {
    // The control, and it is deterministic. The planted record above gains an edge; a record that
    // gains an edge which cannot close a cycle must produce no cycle finding, or the rule is
    // firing on "this record has a new prerequisite" rather than on circularity.
    const a = argumentFiles[0];
    if (a === undefined) return;
    const planted = files.map((f) =>
      f.path === a.path
        ? { ...f, text: withPrerequisite(f.text, "arg-this-id-exists-nowhere") }
        : f,
    );
    const after = await compileContent(planted);
    expect(cycleFindings(after.diagnostics)).toEqual([]);
    // And it IS noticed, by the rule that owns unresolvable references: a control that produced
    // nothing at all would say the plant never reached the compiler.
    const codes = after.diagnostics.map((d) => d.code);
    expect(
      codes.some((c) => /dangling|unknown|missing|unresolved/i.test(c)),
      codes.join(", "),
    ).toBe(true);
  });

  test("ONE added edge is enough, so the detector walks the existing graph", async () => {
    /*
     * Found by a control failing, and the lesson is narrower than my first guess. I expected an
     * edge from the first argument to the third to close no loop; ten cycle findings came back.
     * So the detector does not merely spot a mutual pair -- a SINGLE new edge is enough, because
     * the target already reaches the source through edges that were there before.
     *
     * That is a different fact from the plant above, which added both directions and so could
     * have been caught by a rule that only looked one step. This one cannot.
     *
     * The target is DERIVED rather than written down, because the records' order is the loader's
     * and a hardcoded index would break the day an argument is added. The test asserts that some
     * target closes a loop from one edge, and names the one it found.
     */
    const a = argumentFiles[0];
    if (a === undefined) return;
    const aId = idOf(a.text);
    const directPrerequisites = new Set(
      ((JSON.parse(a.text) as { prerequisites?: readonly unknown[] }).prerequisites ?? []).map(
        (prerequisite) =>
          typeof prerequisite === "object" && prerequisite !== null
            ? String((prerequisite as { id?: unknown }).id)
            : String(prerequisite),
      ),
    );
    let transitive: string | undefined;
    for (const candidate of argumentFiles.slice(1, 12)) {
      const candidateId = idOf(candidate.text);
      // Skip a DIRECT prerequisite of a: adding a -> that is a two-cycle, which the test above
      // already covers. What is wanted is a record a does not name.
      if (directPrerequisites.has(candidateId)) continue;
      const planted = files.map((f) =>
        f.path === a.path ? { ...f, text: withPrerequisite(f.text, candidateId) } : f,
      );
      const after = await compileContent(planted);
      if (cycleFindings(after.diagnostics).length > 0) {
        transitive = candidateId;
        break;
      }
    }
    console.log(
      `[census] one-edge cycle plant: ${aId} -> ${transitive ?? "(none found among 11 candidates)"}`,
    );
    expect(
      transitive,
      "no single added edge closed a loop; the graph-walk claim is unproven on this corpus",
    ).toBeDefined();
  });
});
