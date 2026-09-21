import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { PAPER_BIB_KEYS } from "../../content/editions/ledgerPresence.ts";

/**
 * am-dl4n, the filesystem half. GreenAnchor holds the artefact half against out/; the seam was
 * agreed by mail (thread am-dl4n, 2026-09-21) and neither half asserts the other's fact.
 *
 * THE GAP. Two German transcripts exist on disk and no module that feeds a route reads either. The
 * ledger beads' acceptance criteria are about a ledger being correct and reviewed; none is about it
 * being visible, so a paper can be fully transcribed with every bead closed and render nowhere.
 *
 * WHAT THIS CHECK IS NOT. It does not require a route to render a draft. Whether a machine draft may
 * be shown to a reader at all, and under what label, is an owner decision (am-dl4n criterion 2,
 * am-wisq), and this check must not force it. It fails when a ledger appears that is neither read
 * nor recorded here - so the NEXT transcript cannot repeat this silently, which is the bead's own
 * stated purpose.
 *
 * READING THE PATH IS NOT READING THE LEDGER. src/content/editions/ledgerPresence.ts names the path
 * and calls existsSync, which answers "is there a file" and never opens it. Its three consumers are
 * scripts - align-editions, segment-ledger, e2e-edition-pipeline - none of which is a route. A
 * module counts here only if it both names the transcripts path AND reads a file.
 */
const ROOT = process.cwd();
const TRANSCRIPTS = join(ROOT, "public", "papers", "transcripts");

/**
 * Ledgers on disk that nothing reads, each with why and when the entry goes.
 *
 * An entry is a recorded state, not a suppression: the test fails if a listed ledger becomes
 * reachable, so wiring one in forces its reason to be deleted rather than left as stale prose.
 */
const LEDGERS_NOT_YET_REACHABLE: ReadonlyMap<string, string> = new Map([
  [
    "ap-18-639-machine-draft.txt",
    "Mass-energy machine draft with hand correction (docs/provenance/ap-18-639.md: ledgerStatus in-progress, role machine-draft-with-hand-correction). The /papers/mass-energy/view/german route already ships and renders 'not yet available' because nothing emits a bilingual-edition payload. Delete this entry when a content module reads the ledger, which waits on the owner ruling of am-dl4n criterion 2 and am-wisq.",
  ],
  [
    "ap-17-132-machine-draft.txt",
    "Light-quanta machine draft with hand correction, in progress: 2 of 17 pages transcribed at the time of this entry (docs/provenance/ap-17-132.md: ledgerStatus in-progress, role machine-draft-with-hand-correction). Same state and same owner ruling as the other two. It is the sharpest instance of am-dl4n criterion 1 - a ledger whose coverage is a tenth of the paper - and inspectLedgerPresence now classifies it 'partial' rather than 'present' for exactly that reason. Delete this entry when a content module reads the ledger.",
  ],
  [
    "ap-17-549-machine-draft.txt",
    "Brownian machine draft with hand correction, same state and same owner ruling as the mass-energy ledger. Longer and still partial, so it is also the case am-dl4n criterion 1 asks about: what a reader is shown for a paper whose ledger covers only some pages. Delete this entry when a content module reads the ledger.",
  ],
]);

function ledgersOnDisk(): string[] {
  if (!existsSync(TRANSCRIPTS)) return [];
  return readdirSync(TRANSCRIPTS)
    .filter((f) => f.endsWith(".txt"))
    .sort();
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) out.push(full);
  }
  return out;
}

/** Modules under src/ that name the transcripts path AND read a file, excluding fixtures. */
export function ledgerContentReaders(): string[] {
  const found: string[] = [];
  for (const file of walk(join(ROOT, "src"))) {
    const rel = relative(ROOT, file);
    if (rel.includes("/fixtures/") || rel.startsWith("src/testing/")) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes("papers/transcripts")) continue;
    if (!/\breadFile(Sync)?\s*\(/.test(source)) continue;
    // ledgerPresence reads the ledger from 2026-09-21, to classify coverage as absent,
    // partial or complete. It is STILL not a reader in the sense this census means, and the
    // exclusion matters more now than when it was implicit: it names every paper's
    // transcript path AND reads the file, so without this line it would be detected for
    // every ledger, and "every ledger is read by something" would be permanently satisfied
    // by a helper that surfaces not one word of the text to any reader. That is precisely
    // the vacuity this test exists to prevent.
    if (rel === "src/content/editions/ledgerPresence.ts") continue;
    found.push(rel);
  }
  return found.sort();
}

describe("a ledger on disk is read by something, or recorded as not yet reachable (am-dl4n)", () => {
  test("the census finds the ledgers it is meant to inspect", () => {
    const ledgers = ledgersOnDisk();
    // The vacuity guard. "every ledger is reachable" over an empty directory is true and
    // establishes nothing, and this directory did not exist before 2026-09-20.
    expect(ledgers.length).toBeGreaterThan(0);
    expect(PAPER_BIB_KEYS).toBeDefined();
  });

  test("every ledger on disk is read by a content module or recorded here with a reason", () => {
    const readers = ledgerContentReaders();
    const unrecorded = ledgersOnDisk().filter(
      (f) => readers.length === 0 && !LEDGERS_NOT_YET_REACHABLE.has(f),
    );
    expect(
      unrecorded.map(
        (f) =>
          `${f} exists on disk and no module under src/ reads it; add a reader, or record it in LEDGERS_NOT_YET_REACHABLE with why and when the entry goes`,
      ),
    ).toEqual([]);
  });

  test("a recorded entry names a ledger that exists, so the list cannot outlive its subject", () => {
    const onDisk = new Set(ledgersOnDisk());
    const stale = [...LEDGERS_NOT_YET_REACHABLE.keys()].filter((f) => !onDisk.has(f));
    expect(stale.map((f) => `${f} is recorded as not yet reachable but is not on disk`)).toEqual(
      [],
    );
  });

  test("every recorded reason says when the entry goes, so it is a state and not a suppression", () => {
    // the entry is named in the failure, so a red run says WHICH reason is thin rather than only
    // that one is
    const thin = [...LEDGERS_NOT_YET_REACHABLE].filter(([, reason]) => reason.length <= 80);
    expect(thin.map(([file]) => `${file}: its reason is too short to say anything`)).toEqual([]);
    const openEnded = [...LEDGERS_NOT_YET_REACHABLE].filter(
      ([, reason]) => !reason.includes("Delete this entry when"),
    );
    expect(
      openEnded.map(([file]) => `${file}: no deletion condition, so the entry outlives its reason`),
    ).toEqual([]);
  });

  test("reading the PATH is not reading the ledger: ledgerPresence does not count as a reader", () => {
    const readers = ledgerContentReaders();
    expect(readers).not.toContain("src/content/editions/ledgerPresence.ts");
    // The exclusion must be doing work rather than being trivially true. It used to be shown
    // by asserting the file contains no readFileSync; that proxy died on 2026-09-21 when
    // ledgerPresence began reading the ledger to classify coverage, and a proxy that is
    // false is worse than none. The replacement asserts the stronger thing directly: this
    // file matches BOTH detection criteria and is excluded anyway, so the exclusion is what
    // keeps the census honest rather than an accident of how the file is written.
    const presence = readFileSync(join(ROOT, "src/content/editions/ledgerPresence.ts"), "utf8");
    expect(presence).toContain("papers/transcripts");
    expect(
      /\breadFile(Sync)?\s*\(/.test(presence),
      "ledgerPresence no longer reads the ledger, so the explicit exclusion above is now trivially true and should be removed with this assertion",
    ).toBe(true);
  });
});
