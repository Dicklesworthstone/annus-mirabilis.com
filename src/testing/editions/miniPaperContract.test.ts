/**
 * The mini-paper fixture, pinned: which checks pass, what their denominators are, and a
 * mutation that makes each one fail (am-edn-alignment-tooling-do1, Unit 1).
 *
 * WHAT THIS CORPUS IS PINNED TO, asked directly and answered directly: NOTHING REAL. Every
 * byte of src/testing/fixtures/editions/mini-paper/ was authored for this test - the ledger,
 * the manifest, the id snapshot, the alias file. There is no pinned facsimile behind it and
 * no reviewed ledger for any paper anywhere in the repository, so no pass here is evidence
 * about Einstein's text. What these passes establish is that the checks EXECUTE and can
 * FAIL, which is the thing fifteen declared checks had never demonstrated.
 *
 * WHY THE MUTATIONS ARE IN THE SUITE RATHER THAN IN A COMMIT MESSAGE. A green with no
 * demonstrated way to fail is exactly the state the eight vacuous checks were in: they had
 * been "passing" since they were written. A mutation that only ever ran once, by hand, on
 * the day the fixture landed, would leave the next green in the same position. These run
 * every time.
 *
 * Block-level units only, so nothing here anticipates the am-xz2d sentence-unit ruling.
 */

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertEditionContract } from "../../content/editions/editionContract.ts";

const FIXTURE = join(process.cwd(), "src/testing/fixtures/editions/mini-paper");
const MANIFEST = "content/source-blocks/mass-energy/manifest.yaml";
const SNAPSHOT = "content/source-blocks/mass-energy/manifest.ids.snapshot.txt";

/** A throwaway copy of the fixture, so a mutation never touches the committed corpus. */
function mutatedFixture(relativePath: string, mutate: (text: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), "mini-paper-"));
  cpSync(FIXTURE, dir, { recursive: true });
  const target = join(dir, relativePath);
  writeFileSync(target, mutate(readFileSync(target, "utf8")), "utf8");
  return dir;
}

const outcomeOf = (root: string, n: number) =>
  assertEditionContract("mass-energy", { root }).checks.find((c) => c.checkNumber === n);

describe("mini-paper fixture contract (am-edn-alignment-tooling-do1)", () => {
  test("check 5 passes over the manifest, and says how many units it validated", () => {
    const c = outcomeOf(FIXTURE, 5);
    expect(c?.outcome).toBe("passed");
    // The denominator on the passing side: a pass over six units says six.
    expect(c?.message).toContain("6 unit(s) validated");
  });

  test("MUTATION: a unit locating itself outside the paper's pages fails check 5", () => {
    // Chosen by trying four mutations and keeping the one that reaches a check-5 FAILURE.
    // Two of the others - a duplicated id, a unit with no locators - make the manifest
    // unloadable, so check 5 declines rather than fails: honest, but it would have pinned
    // the wrong thing. A fourth, an unknown `kind`, left check 5 passing, which is worth
    // someone's attention and is recorded on the bead rather than asserted here.
    const root = mutatedFixture(MANIFEST, (t) =>
      t.replace(
        "  - id: closing-ack\n    kind: closing\n    locators:\n      - page: 639",
        "  - id: closing-ack\n    kind: closing\n    locators:\n      - page: 999",
      ),
    );
    // The mutation reaches the state it tests.
    expect(readFileSync(join(root, MANIFEST), "utf8")).toContain("page: 999");
    const c = outcomeOf(root, 5);
    expect(c?.outcome, "check 5 must fail when a unit is located outside the paper").toBe("failed");
    expect(c?.message).toContain("page-out-of-range");
  });

  test("check 6 passes over the id snapshot, and says how many ids were added", () => {
    const c = outcomeOf(FIXTURE, 6);
    expect(c?.outcome).toBe("passed");
    expect(c?.message).toContain("0 id(s) added");
  });

  test("MUTATION: an id removed from the manifest without an alias fails check 6", () => {
    const root = mutatedFixture(MANIFEST, (t) =>
      t.replace(
        / {2}- id: closing-received\n {4}kind: closing\n(?:.*\n)*? {8}- "Journal receipt line as printed"\n/,
        "",
      ),
    );
    // The mutation reaches the state it tests: the unit is gone from the manifest while the
    // snapshot still lists it, which is precisely an uncovered retirement.
    expect(readFileSync(join(root, MANIFEST), "utf8")).not.toContain("id: closing-received");
    expect(readFileSync(join(root, SNAPSHOT), "utf8")).toContain("closing-received");
    const c = outcomeOf(root, 6);
    expect(c?.outcome, "check 6 must fail when a retired id has no alias").toBe("failed");
  });

  test("checks 1 and 3 decline here, because this corpus gives them nothing to compare", () => {
    // Recorded as an assertion rather than a footnote: both reported a PASS over nothing
    // until this commit. Check 1 said "Digest chain verified." with no declared digest of
    // either kind, and check 3 said "Edition text reconstructs from the ledger" with no
    // edition text - while check 7 declined that same missing input. Pinning the decline
    // means a change that restores either unconditional pass fails here.
    const c1 = outcomeOf(FIXTURE, 1);
    expect(c1?.outcome).toBe("not-available");
    expect(c1?.message).not.toContain("Digest chain verified.");
    const c3 = outcomeOf(FIXTURE, 3);
    expect(c3?.outcome).toBe("not-available");
    expect(c3?.message).toContain("nothing to reconstruct");
  });

  test("the run accounts for all fifteen checks and names every decline", () => {
    const r = assertEditionContract("mass-energy", { root: FIXTURE });
    const d = r.denominator;
    expect(d.checksSpecified).toBe(15);
    expect(d.checksJudged + d.checksDeclined).toBe(
      r.checks.filter((c) => c.checkNumber !== undefined).length,
    );
    // Two genuine passes today. If this number rises, the test that raised it should say
    // what the new pass is pinned to.
    // Numbered checks only: `ledger-presence` and `id-stability` are unnumbered legacy
    // aliases and are not among the fifteen. Counting them would have overstated this by
    // two, which is the kind of denominator error this whole field exists to prevent.
    expect(
      r.checks.filter((c) => c.checkNumber !== undefined && c.outcome === "passed").length,
    ).toBe(2);
    for (const entry of d.declined) expect(entry.reason.length).toBeGreaterThan(20);
  });
});
