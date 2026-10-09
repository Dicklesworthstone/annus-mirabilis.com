/**
 * THE REQUIRED HISTORIAN'S-MARGIN ENTRIES HAVE A DENOMINATOR NOW, AND IT IS 26, NOT 16.
 *
 * The master plan's section 3.9 enumerates the margin entries each paper must carry, and says "a
 * paper is not done until its list is present". That list lived only in the plan's prose, so the
 * definition-of-done report declared this item unmeasured for want of a denominator. The four
 * records in content/editorial/required-margin-entries/ are that list, transcribed.
 *
 * COUNTING `kind: historian-margin` RECORDS IS THE WRONG POPULATION, which is the whole reason
 * this file exists. It gives 16 across the four papers and reads as substantial coverage. Only SIX
 * are section 3.9 entries, all of them mass-energy's; the other ten are notation-concordance notes
 * (beta is the modern gamma, k is viscosity, tau is not proper time) that carry the same `kind`
 * because they are margin notes in the layout sense. A number that counts them answers a question
 * nobody asked, and it reads higher than the truth.
 *
 * WHAT THIS FILE REFUSES, and it is the only thing that makes the record trustworthy: a
 * `satisfiedBy` that names a record which does not exist. Without that check this directory would
 * be 26 self-assigned grades. The plant at the bottom drives the real predicate.
 *
 * A PARTIAL IS NOT A PASS. Two entries have a record covering half the plan's clause: light-quanta
 * (e) has the Ehrenfest dating but not the independence from Jeans's 1905 correction, and
 * special-relativity (e) has the force convention but not Planck 1906. Both are recorded as
 * `partial` with the missing half written down, and both count as absent.
 *
 * This file does NOT author the 20 absent entries. Each needs a primary source and is editorial
 * work; naming what is missing is a different act from writing it.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = join(ROOT, "content/editorial/required-margin-entries");

/** The letters section 3.9 actually prints, per paper. A new letter here is a plan change. */
const PLAN_LETTERS: Readonly<Record<string, string>> = {
  "light-quanta": "abcde",
  "brownian-motion": "abcdefg",
  "special-relativity": "abcdefgh",
  "mass-energy": "abcdef",
};

type Entry = {
  letter?: unknown;
  proposition?: unknown;
  satisfiedBy?: unknown;
  requiresCitations?: unknown;
  planDescriptionDisputed?: {
    reportedOn?: unknown;
    evidence?: unknown;
    candidates?: unknown;
    finding?: unknown;
  };
  partial?: { satisfiedBy?: unknown; covers?: unknown; missing?: unknown };
};

type Extra = { name?: unknown; proposition?: unknown; satisfiedBy?: unknown; enumerated?: unknown };
type PaperEntries = { paper: string; entries: Entry[]; extras?: Extra[] };

function records(): PaperEntries[] {
  return readdirSync(DIR)
    .filter((n) => n.endsWith(".yaml"))
    .sort()
    .map((n) => {
      const parsed = loadYaml(readFileSync(join(DIR, n), "utf8")) as {
        paper?: unknown;
        entries?: unknown;
        additionalRequired?: unknown;
      };
      return {
        paper: String(parsed.paper ?? ""),
        entries: Array.isArray(parsed.entries) ? (parsed.entries as Entry[]) : [],
        extras: Array.isArray(parsed.additionalRequired)
          ? (parsed.additionalRequired as Extra[])
          : [],
      };
    });
}

/** Every editorial-note id on disk, which is the only thing a credit may point at. */
function noteIds(): Set<string> {
  const ids = new Set<string>();
  const base = join(ROOT, "content/editorial-notes");
  for (const paper of readdirSync(base)) {
    for (const file of readdirSync(join(base, paper))) {
      if (!file.endsWith(".json")) continue;
      const parsed = JSON.parse(readFileSync(join(base, paper, file), "utf8")) as { id?: unknown };
      if (typeof parsed.id === "string") ids.add(parsed.id);
    }
  }
  return ids;
}

/**
 * Exported so the plant drives the real predicate rather than a copy of it: a credit is honoured
 * only when the record it names is on disk.
 */
export function unresolvedCredits(
  papers: readonly PaperEntries[],
  ids: ReadonlySet<string>,
): readonly string[] {
  const bad: string[] = [];
  for (const { paper, entries, extras } of papers) {
    for (const entry of entries) {
      for (const credit of [entry.satisfiedBy, entry.partial?.satisfiedBy]) {
        if (typeof credit === "string" && !ids.has(credit)) {
          bad.push(`${paper} (${String(entry.letter)}) names ${credit}, which is not on disk`);
        }
      }
    }
    // The bead-added records are credited by the same rule: a boundary note that does not exist
    // may not be counted because the bead asked for one.
    for (const extra of extras ?? []) {
      const credit = extra.satisfiedBy;
      if (typeof credit === "string" && !ids.has(credit)) {
        bad.push(`${paper} [${String(extra.name)}] names ${credit}, which is not on disk`);
      }
    }
  }
  return bad;
}

describe("the required margin entries are a real denominator", () => {
  const papers = records();
  const ids = noteIds();

  test("all four papers, and the letters are the ones section 3.9 prints", () => {
    expect(papers.map((p) => p.paper).sort()).toEqual(Object.keys(PLAN_LETTERS).sort());
    for (const { paper, entries } of papers) {
      // An identity, not a count: these are permanent members of the plan's list, so a
      // renumbering shows up here rather than as an arithmetic coincidence.
      expect(entries.map((e) => String(e.letter)).join("")).toBe(PLAN_LETTERS[paper]);
    }
  });

  test("every entry states a proposition, by words rather than by length", () => {
    // A CHARACTER FLOOR WAS WRONG HERE AND WENT RED ON CORRECT TRANSCRIPTION. The plan's own
    // clause (e) for special-relativity is "The transverse mass and Planck 1906." at 36
    // characters, and (h) is "The notation V and beta." at 24. Padding them to clear a threshold
    // would mean writing text the plan does not say, which is the opposite of transcribing it. So
    // the check counts words, which catches a blank or a placeholder without demanding prose the
    // source does not have.
    for (const { paper, entries } of papers) {
      for (const entry of entries) {
        const words = String(entry.proposition ?? "")
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        expect(words.length, `${paper} (${String(entry.letter)})`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test("EVERY CREDIT RESOLVES to an editorial-note record that exists", () => {
    // The assertion that keeps this directory from being self-assigned grades.
    expect(unresolvedCredits(papers, ids)).toEqual([]);
    // Non-vacuity: a file with no credits at all would satisfy the line above while proving
    // nothing, so assert that credits were actually examined.
    const credited = papers.flatMap((p) =>
      p.entries.filter((e) => typeof e.satisfiedBy === "string"),
    );
    expect(credited.length).toBeGreaterThan(0);
    expect(ids.size).toBeGreaterThanOrEqual(16);
  });

  test("a partial is recorded as absent, with the missing half written down", () => {
    const partials = papers.flatMap(({ paper, entries }) =>
      entries.filter((e) => e.partial !== undefined).map((e) => ({ paper, entry: e })),
    );
    expect(partials.length).toBeGreaterThan(0);
    for (const { paper, entry } of partials) {
      // Never both: a partial that also claimed satisfaction would be counted as done.
      expect(entry.satisfiedBy, `${paper} (${String(entry.letter)})`).toBeUndefined();
      expect(String(entry.partial?.missing ?? "").length).toBeGreaterThan(40);
      expect(String(entry.partial?.covers ?? "").length).toBeGreaterThan(20);
    }
  });

  test("the census, with its denominator named", () => {
    // Enumerated requirements only. special-relativity's bead also requires "the reception and
    // confirmation records" without listing them, and that addition carries `enumerated: false`,
    // so it is excluded from the denominator rather than counted as one item. Counting it as one
    // would understate the work and counting it as zero would hide it; it is reported separately.
    const enumeratedExtras = (p: PaperEntries): Extra[] =>
      (p.extras ?? []).filter((e) => e.enumerated !== false);
    const required = papers.reduce((n, p) => n + p.entries.length + enumeratedExtras(p).length, 0);
    const satisfied = papers.reduce(
      (n, p) =>
        n +
        p.entries.filter((e) => typeof e.satisfiedBy === "string").length +
        enumeratedExtras(p).filter((e) => typeof e.satisfiedBy === "string").length,
      0,
    );
    const partial = papers.reduce(
      (n, p) => n + p.entries.filter((e) => e.partial !== undefined).length,
      0,
    );
    const unenumerated = papers.reduce(
      (n, p) => n + (p.extras ?? []).filter((e) => e.enumerated === false).length,
      0,
    );
    console.log(
      `[census] required-margin-entries examined ${required} enumerated requirements ` +
        `(minimum 26); ${satisfied} satisfied, ${partial} partial, ${required - satisfied} absent, ` +
        `${unenumerated} further requirement(s) the owning bead did not enumerate`,
    );
    for (const p of papers) {
      const total = p.entries.length + enumeratedExtras(p).length;
      const s =
        p.entries.filter((e) => typeof e.satisfiedBy === "string").length +
        enumeratedExtras(p).filter((e) => typeof e.satisfiedBy === "string").length;
      console.log(`[census]   ${p.paper}: ${s} of ${total}`);
    }
    expect(required).toBe(29);
    expect(unenumerated).toBe(1);
    // A floor on what is NOT done, so this cannot quietly go green by the record shrinking. It
    // comes down as entries are authored, which is the point of recording it.
    expect(required - satisfied).toBeGreaterThan(0);
  });

  test("mass-energy's list is COMPLETE, and that is a finding rather than an accident", () => {
    // The one paper that is done, asserted by identity so it cannot regress unnoticed: its six
    // section 3.9 letters plus the two records its bead adds. If an id is renamed without the
    // record moving, this is what goes red.
    const me = papers.find((p) => p.paper === "mass-energy");
    expect(me).toBeDefined();
    const credited = [
      ...(me?.entries ?? []).map((e) => e.satisfiedBy),
      ...(me?.extras ?? []).map((e) => e.satisfiedBy),
    ].map(String);
    expect(credited.sort()).toEqual([
      "note-me-a-formula-absent",
      "note-me-b-additive-constant",
      "note-me-boundary-later-derivations",
      "note-me-c-1906-poincare",
      "note-me-d-hasenoehrl",
      "note-me-e-radium-and-checks",
      "note-me-f-two-pulses",
      "note-me-g-argument-comparison",
    ]);
  });
});

/** Every bibliography id on disk. A prerequisite is outstanding when it is not among these. */
function citationIds(): Set<string> {
  const ids = new Set<string>();
  const base = join(ROOT, "content/bibliography");
  for (const file of readdirSync(base)) {
    if (!file.endsWith(".json") && !file.endsWith(".yaml")) continue;
    const parsed = loadYaml(readFileSync(join(base, file), "utf8")) as
      | { id?: unknown }
      | { id?: unknown }[]
      | null;
    for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
      const id = (entry as { id?: unknown } | null)?.id;
      if (typeof id === "string") ids.add(id);
    }
  }
  return ids;
}

describe("THE ABSENT ENTRIES ARE BLOCKED ON BIBLIOGRAPHY, AND THAT REORDERS THE WORK", () => {
  const papers = records();
  const have = citationIds();

  test("the one COMPLETE paper is the one whose citations were built", () => {
    // This is the finding, and it is a correlation with a direction. mass-energy's margin list is
    // the only complete one, and the bibliography is heavily its own: Bainbridge, Cockcroft and
    // Walton, Hasenoehrl 1904 and 1905, Ives 1952, Stachel and Torretti 1982, Poincare 1900,
    // Einstein 1906, 1907 and 1935. Every one of its six letters cites records that already exist,
    // so it needs no prerequisite at all, while the other three need records nobody has written.
    const me = papers.find((p) => p.paper === "mass-energy");
    const outstanding = (me?.entries ?? []).flatMap((e) =>
      (Array.isArray(e.requiresCitations) ? e.requiresCitations : []).map(String),
    );
    expect(outstanding).toEqual([]);
    // Non-vacuity: the other three must actually declare prerequisites, or the line above would
    // pass against a corpus where nobody had recorded any.
    const others = papers
      .filter((p) => p.paper !== "mass-energy")
      .flatMap((p) => p.entries)
      .filter((e) => Array.isArray(e.requiresCitations));
    expect(others.length).toBe(20);
  });

  test("the outstanding citation records, named rather than counted", () => {
    const outstanding = new Map<string, string[]>();
    for (const { paper, entries } of papers) {
      for (const entry of entries) {
        for (const raw of Array.isArray(entry.requiresCitations) ? entry.requiresCitations : []) {
          const id = String(raw);
          if (have.has(id)) continue;
          const at = `${paper} (${String(entry.letter)})`;
          outstanding.set(id, [...(outstanding.get(id) ?? []), at]);
        }
      }
    }
    console.log(
      `[census] margin-entry citations: ${have.size} bibliography record(s) on disk; ` +
        `${outstanding.size} further record(s) must exist before the 21 absent entries can be authored`,
    );
    for (const [id, where] of [...outstanding].sort()) {
      console.log(`[census]   MISSING ${id.padEnd(34)} needed by ${where.join(", ")}`);
    }
    // THE SPLIT THAT MAKES THIS ACTIONABLE, and the reason no blocking dependency was added
    // between the margin beads and the bibliography bead: some absent entries cite records that
    // already exist, so they can be authored today. A hard `br dep add` would have removed real
    // work from the ready pool.
    const authorable: string[] = [];
    let waiting = 0;
    for (const { paper, entries } of papers) {
      for (const entry of entries) {
        if (typeof entry.satisfiedBy === "string") continue;
        const need = (Array.isArray(entry.requiresCitations) ? entry.requiresCitations : []).map(
          String,
        );
        if (need.length > 0 && need.every((id) => have.has(id))) {
          authorable.push(`${paper} (${String(entry.letter)})`);
        } else {
          waiting += 1;
        }
      }
    }
    console.log(
      `[census] of the absent entries, ${authorable.length} are authorable today ` +
        `(${authorable.join(", ")}) and ${waiting} wait on a bibliography record`,
    );
    // Both sides non-empty on purpose. If everything were blocked this would read as a hard
    // dependency and the beads should be marked so; if nothing were, this bead would not exist.
    expect(authorable.length).toBeGreaterThan(0);
    expect(waiting).toBeGreaterThan(0);

    // A floor rather than an equality, so writing one of them does not turn this red. It is a
    // REPORT, and the thing it reports is a blocker, so it must not be asserted away.
    expect(outstanding.size).toBeGreaterThan(0);
    // And the ones that DO resolve really resolve: relativity (a), (g) and (h) cite the paper
    // itself, which is on disk, so a prerequisite list that was simply all-missing would fail here.
    expect(have.has("ap-17-891")).toBe(true);
    const resolved = papers
      .flatMap((p) => p.entries)
      .flatMap((e) => (Array.isArray(e.requiresCitations) ? e.requiresCitations : []))
      .map(String)
      .filter((id) => have.has(id));
    expect(resolved.length).toBeGreaterThan(0);
  });
});

describe("an entry whose plan description the plates contradict is surfaced, not silently authored", () => {
  const papers = records();

  test("a disputed entry carries its evidence, and is never also credited as satisfied", () => {
    const disputed = papers.flatMap(({ paper, entries }) =>
      entries
        .filter((e) => e.planDescriptionDisputed !== undefined)
        .map((e) => ({ paper, letter: String(e.letter), entry: e })),
    );
    for (const { paper, letter, entry } of disputed) {
      const d = entry.planDescriptionDisputed;
      console.log(`[census] DISPUTED ${paper} (${letter}): ${String(d?.finding ?? "")}`);
      // Evidence is required, because "the plan is wrong" without a source is just an opinion and
      // this repository's whole method is that a claim names what was read.
      expect(String(d?.evidence ?? "").length, `${paper} (${letter})`).toBeGreaterThan(20);
      expect(String(d?.finding ?? "").length).toBeGreaterThan(40);
      expect(Array.isArray(d?.candidates) && d.candidates.length > 0).toBe(true);
      // A disputed entry describes something that may not exist, so it must not ALSO claim to be
      // present. That combination would mean a record was written against a description the
      // plates contradict, which is the thing this check exists to prevent.
      expect(entry.satisfiedBy, `${paper} (${letter}) is disputed AND credited`).toBeUndefined();
    }
    // Non-vacuity: there is one today (relativity (g)), so an empty loop means the record lost it.
    expect(disputed.length).toBeGreaterThan(0);
  });
});

describe("THE PLANT: a credit naming a record that is not on disk must fail", () => {
  test("a bogus satisfiedBy is reported, and a real one is not", () => {
    const ids = noteIds();
    // This id does not exist: brownian-motion's three notes are the notation and qualification
    // ones. Asserting its absence first, because a plant that failed to land reads as a pass.
    expect(ids.has("note-bm-sutherland-1904")).toBe(false);
    const found = unresolvedCredits(
      [
        {
          paper: "brownian-motion",
          entries: [
            { letter: "a", proposition: "x".repeat(50), satisfiedBy: "note-bm-sutherland-1904" },
          ],
        },
      ],
      ids,
    );
    expect(found.length).toBe(1);
    expect(found[0]).toContain("note-bm-sutherland-1904");

    // The other direction, so the predicate is not simply always-red: mass-energy's (c) names a
    // record that really is on disk.
    expect(ids.has("note-me-c-1906-poincare")).toBe(true);
    expect(
      unresolvedCredits(
        [
          {
            paper: "mass-energy",
            entries: [
              { letter: "c", proposition: "y".repeat(50), satisfiedBy: "note-me-c-1906-poincare" },
            ],
          },
        ],
        ids,
      ),
    ).toEqual([]);
  });
});
