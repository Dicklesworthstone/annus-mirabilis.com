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
 * THE RECEIPT IS AUTHORED, NOT REAL, and says so in its own front matter. Its structure is
 * copied from docs/provenance/ap-18-639.md so the parser sees a well-formed record; its scan
 * digest is a zero placeholder because the scan does not exist here, its ledger digest is of
 * the fixture ledger, and its page map declares exactly what the fixture page holds: no
 * display equations, no footnote marks, no refining inventory bead. Checks 2 and 4 passing
 * against it means the ledger validates and the manifest agrees with the receipt - it means
 * nothing about Annalen der Physik.
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
const RECEIPT = "docs/provenance/ap-18-639.md";
const DECLARATION = "content/source-blocks/mass-energy/edition.yaml";

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

  test("check 2 passes: the authored fixture ledger validates clean", () => {
    const c = outcomeOf(FIXTURE, 2);
    expect(c?.outcome).toBe("passed");
    expect(c?.message).toContain("clean");
  });

  test("MUTATION: a receipt whose ledger-source digest disagrees with its scan fails check 2", () => {
    const root = mutatedFixture(RECEIPT, (t) =>
      t.replace(
        'ledgerSourcePdfSha256: "0000000000000000000000000000000000000000000000000000000000000000"',
        'ledgerSourcePdfSha256: "1111111111111111111111111111111111111111111111111111111111111111"',
      ),
    );
    // The mutation reaches the state it tests: the two digests now differ.
    const text = readFileSync(join(root, RECEIPT), "utf8");
    expect(text).toContain("1111111111111111111111111111111111111111111111111111111111111111");
    const c = outcomeOf(root, 2);
    expect(c?.outcome, "check 2 must fail when the receipt's digest chain disagrees").toBe(
      "failed",
    );
    expect(c?.message).toContain("receipt-source-digest-mismatch");
  });

  test("check 4 passes: the manifest's pages and the receipt's pageMap agree", () => {
    const c = outcomeOf(FIXTURE, 4);
    expect(c?.outcome).toBe("passed");
    expect(c?.message).toContain("every reconciled page");
  });

  test("MUTATION: a receipt page claiming a footnote mark the manifest lacks fails check 4", () => {
    const root = mutatedFixture(RECEIPT, (t) =>
      t.replace("    footnoteMarks: []\n", '    footnoteMarks:\n      - "1)"\n'),
    );
    // The mutation reaches the state it tests: the receipt now claims a mark on page 639,
    // and the manifest has no footnote unit at all.
    expect(readFileSync(join(root, RECEIPT), "utf8")).toContain('- "1)"');
    const c = outcomeOf(root, 4);
    expect(c?.outcome, "check 4 must fail when the receipt claims what the manifest lacks").toBe(
      "failed",
    );
  });

  test("check 1 passes AND NAMES ITS INPUT, so it cannot be mistaken for a pass over real bytes", () => {
    const c = outcomeOf(FIXTURE, 1);
    expect(c?.outcome).toBe("passed");
    // The requirement is not that the chain verified; it is that the message says WHAT it
    // verified. "Digest chain verified." over an unnamed input is how a pass over a fixture
    // becomes indistinguishable from a pass over the real facsimile.
    expect(c?.message).toContain("edition.yaml");
    expect(c?.message).toContain("mini-paper");
    expect(c?.message).toContain("ap-18-639-reviewed.txt");
    expect(c?.message).toContain("ap-18-639.pdf");
    expect(c?.message).toMatch(/sha256 [0-9a-f]{12}/);
  });

  test("MUTATION: a declared facsimile digest that does not match the bytes fails check 1", () => {
    const root = mutatedFixture(DECLARATION, (t) =>
      t.replace(/facsimileDigest: "[0-9a-f]{64}"/, `facsimileDigest: "${"a".repeat(64)}"`),
    );
    // The mutation reaches the state it tests.
    expect(readFileSync(join(root, DECLARATION), "utf8")).toContain("a".repeat(64));
    const c = outcomeOf(root, 1);
    expect(c?.outcome, "a broken chain is a FAILURE, not a decline").toBe("failed");
    expect(c?.code).toBe("digest-mismatch");
    // A failure names both sides, so the reader knows which one to fix.
    expect(c?.message).toContain("hashes to");
    expect(c?.message).toContain("declares");
  });

  test("a malformed declaration is NOT-AVAILABLE, because a broken file is not a verdict", () => {
    const root = mutatedFixture(DECLARATION, () => "paper: [mass-energy\n  bibliographicKey: :\n");
    const c = outcomeOf(root, 1);
    expect(c?.outcome, "a YAML error says nothing about the edition").toBe("not-available");
    expect(c?.code).toBe("edition-declaration-malformed");
    expect(c?.message).toContain("not a verdict about the edition");
  });

  test("with no declaration at all, check 1 declines naming the path it looked for", () => {
    // Asserted against the REAL repository, which has no edition.yaml for any paper. Before
    // the harness read the file this reported `ledger-absent` - somebody else's missing
    // input - so authoring a declaration would have changed nothing.
    const r = assertEditionContract("brownian-motion", {});
    const c = r.checks.find((x) => x.checkNumber === 1);
    expect(c?.outcome).toBe("not-available");
    expect(c?.code).toBe("edition-declaration-absent");
    expect(c?.message).toContain("content/source-blocks/brownian-motion/edition.yaml");
  });

  test("check 3 declines here, because this corpus gives it nothing to compare", () => {
    // Recorded as an assertion rather than a footnote: both reported a PASS over nothing
    // until this commit. Check 1 said "Digest chain verified." with no declared digest of
    // either kind, and check 3 said "Edition text reconstructs from the ledger" with no
    // edition text - while check 7 declined that same missing input. Pinning the decline
    // means a change that restores either unconditional pass fails here.
    // Check 1 no longer belongs here: the fixture now carries an edition declaration, so
    // it reaches a verdict. Its decline paths are asserted above, per disk condition.
    const c3 = outcomeOf(FIXTURE, 3);
    expect(c3?.outcome).toBe("not-available");
    expect(c3?.message).toContain("nothing to reconstruct");
  });

  // Check 8 is the only check that reaches a VERDICT on this fixture without being pinned
  // anywhere. It reaches "failed", and that is correct rather than a defect to repair: the
  // fixture has a ledger that segments into German alignable units and no translation at
  // all, so its alignment coverage genuinely fails. Leaving it unpinned meant the suite was
  // green over a failing check nobody had read.
  test("check 8 FAILS on this fixture, because German units exist and no edge does", () => {
    const c = outcomeOf(FIXTURE, 8);
    expect(c?.outcome).toBe("failed");
    expect(c?.code).toBe("empty-alignment");
    // Pin the reason, not just the code: what must keep being said is that paragraph
    // counts are not an alignment.
    expect(c?.message).toContain("paragraph counts are not an alignment");

    // And the denominator proves the failure is about missing EDGES rather than missing
    // German text, which is the distinction the empty-population decline turns on.
    const d = assertEditionContract("mass-energy", { root: FIXTURE }).denominator;
    expect(d.germanUnitsGiven).toBeGreaterThan(0);
    expect(d.edgesGiven).toBe(0);
    expect(d.englishUnitsGiven).toBe(0);
  });

  test("check 8 DECLINES rather than fails when there is no German text either", () => {
    // The other side of the same branch, and the one that would silently bless an empty
    // set if it were ever removed: nothing German, nothing English, no edges is "could not
    // run", not "failed". Reached by emptying the ledger the German ids are segmented from.
    const root = mutatedFixture(
      "public/papers/transcripts/ap-18-639-reviewed.txt",
      () => "--- REVIEWED TRANSCRIPTION PAGE 1 OF 1 ---\n",
    );
    const c = outcomeOf(root, 8);
    expect(c?.outcome).toBe("not-available");
    expect(c?.code).toBe("alignment-population-empty");
    expect(c?.message).toContain("Nothing was examined, so nothing is verified.");
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
    ).toBe(5);
    for (const entry of d.declined) expect(entry.reason.length).toBeGreaterThan(20);
  });
});
