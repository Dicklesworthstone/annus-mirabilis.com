/**
 * `sectionAnchorOf` answers "which section is this id in" from the id alone, for a caller that has
 * nothing else -- a client island holding a fragment and the DOM. That is a claim about the whole
 * corpus, so it is checked against the whole corpus rather than against a handful of ids an author
 * chose, because an author choosing the examples will choose the ones the function handles.
 *
 * THE AUTHORITY IS EACH BLOCK'S OWN `section:` FIELD, read from the YAML on disk. Not a loader's
 * output: a loader between this check and the records can drop a block it cannot resolve, and then
 * the check only ever sees ids that already work (AGENTS.md, "A Check Inherits The Silence Of
 * Whatever It Reads"). Reading the files means a block whose id and declared section disagree is
 * visible here, which is the only way this test can find anything.
 *
 * The population is printed beside the verdict, and the floor is deliberate: a glob that matched
 * nothing, or a parse that produced no `section` field, would otherwise pass this file in silence.
 *
 * WHAT THE FIRST RUN FOUND, which is why this file is shaped as two claims rather than one: AN ID
 * DOES NOT ALWAYS ENCODE ITS SECTION. 955 of 961 declared pairs agree. The six that do not are not
 * defects:
 *
 *   eq-2            declared s3   -- a bare printed equation number; the section-qualified form
 *                                    `eq-s<n>-<printed>` is used only where a number repeats
 *   eq-A            declared s10  -- a lettered equation
 *   masthead-title  declared s0   -- the masthead carries no section segment, and the records
 *   masthead-author declared s0      place it in s0 (each appears twice: two papers declare them)
 *
 * So the contract is "the section THE ID ENCODES, or null", and a caller needing the other six must
 * read the record. Returning s0 for a masthead id would put content knowledge inside a grammar
 * function and would read as a successful lookup; null tells the caller to ask someone else. The
 * second test pins that list by identity, so an id kind that stops encoding its section shows up
 * here instead of silently becoming unanswerable.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { sectionAnchorOf } from "./anchors.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

interface Block {
  id?: unknown;
  section?: unknown;
  sentenceSpans?: unknown;
}

/** Every (id, declared section) pair in the source records: blocks and their sentence spans. */
function declaredSections(): { pairs: [string, string][]; files: number; papers: number } {
  const pairs: [string, string][] = [];
  let files = 0;
  let papers = 0;
  for (const paper of PAPERS) {
    const dir = join(ROOT, "content/source-blocks", paper);
    let names: string[];
    try {
      names = readdirSync(dir).filter((n) => n.endsWith(".yaml"));
    } catch {
      continue;
    }
    papers += 1;
    for (const name of names) {
      // manifest.yaml and ledger-allowlist.yaml are not source blocks; they carry no `section`,
      // so the `typeof` guards below skip them without needing a name list to keep in step.
      const parsed = loadYaml(readFileSync(join(dir, name), "utf8")) as Block | null;
      if (parsed === null || typeof parsed !== "object") continue;
      const { id, section, sentenceSpans } = parsed;
      if (typeof id !== "string" || typeof section !== "string") continue;
      files += 1;
      pairs.push([id, section]);
      if (Array.isArray(sentenceSpans)) {
        for (const span of sentenceSpans) {
          const spanId = (span as { id?: unknown })?.id;
          // A span inherits its block's section: it is a sentence OF that paragraph.
          if (typeof spanId === "string") pairs.push([spanId, section]);
        }
      }
    }
  }
  return { pairs, files, papers };
}

describe("sectionAnchorOf agrees with every section the source records declare", () => {
  const { pairs, files, papers } = declaredSections();

  test("the population is real, and large", () => {
    console.log(
      `[census] sectionAnchorOf checked against ${pairs.length} declared (id, section) pairs ` +
        `from ${files} source blocks across ${papers} papers`,
    );
    expect(papers).toBe(4);
    // Floors, not equalities: these grow as sentences are inventoried, and a frozen count would go
    // red on correct work (AGENTS.md, "A Count Is For Reporting, Not For Asserting").
    expect(files).toBeGreaterThanOrEqual(400);
    expect(pairs.length).toBeGreaterThanOrEqual(900);
  });

  test("where the id encodes a section, it is the section the record declares", () => {
    const answered = pairs.filter(([id]) => sectionAnchorOf(id) !== null);
    const disagreements = answered
      .filter(([id, section]) => sectionAnchorOf(id) !== section)
      .map(([id, section]) => `${id}: declared ${section}, derived ${String(sectionAnchorOf(id))}`);
    expect(disagreements).toEqual([]);
    // Non-vacuity on purpose: a function that returned null for everything would leave `answered`
    // empty and the assertion above would pass while proving nothing.
    expect(answered.length).toBeGreaterThanOrEqual(900);
    console.log(`[census] ${answered.length} of ${pairs.length} pairs answered from the id alone`);
  });

  test("the ids it CANNOT answer are exactly these, named rather than counted", () => {
    // An identity list, not a count: these four are permanent members of the corpus, so naming them
    // records that their section is content rather than grammar. A fifth id kind losing its section
    // segment lands here and turns this red.
    const unanswered = [
      ...new Set(pairs.filter(([id]) => sectionAnchorOf(id) === null).map(([id]) => id)),
    ].sort();
    expect(unanswered).toEqual(["eq-2", "eq-A", "masthead-author", "masthead-title"]);
  });
});

describe("the cases the corpus cannot exercise, and the ones it must not", () => {
  test("an anchor whose id carries no section segment is null, not a guess", () => {
    // The masthead ids are in this list although their RECORDS declare s0 (measured above). The
    // grammar cannot see that, and inventing it here would read as a successful lookup; null tells
    // a caller to read the record instead. The closing blocks and paper 3's part headings have no
    // declared section at all.
    for (const id of [
      "masthead-title",
      "masthead-author",
      "closing-dateline",
      "closing-ack",
      "part-1",
      "part-2",
    ]) {
      expect(sectionAnchorOf(id)).toBeNull();
    }
  });

  test("s0 IS a section: paper 4 has none and writes s0, and papers 1-3 use it for the preamble", () => {
    expect(sectionAnchorOf("s0")).toBe("s0");
    expect(sectionAnchorOf("s0-p1-s1")).toBe("s0");
  });

  test("a split half resolves to the same section as its source sentence", () => {
    expect(sectionAnchorOf("s3-p2-s1a")).toBe("s3");
    expect(sectionAnchorOf("s3-p2-s1b")).toBe("s3");
    expect(sectionAnchorOf("s3-p2-s1")).toBe("s3");
  });

  test("a two-digit section is not truncated to its first digit", () => {
    // The obvious off-by-one in a leading-segment match. Relativity has s10.
    expect(sectionAnchorOf("s10-p1-s1")).toBe("s10");
    expect(sectionAnchorOf("s10")).toBe("s10");
  });

  test("ids that are not content anchors at all are null", () => {
    for (const id of ["", "acceleratingPotential", "_R_", "reader-root", "main", "s", "sx-p1-s1"]) {
      expect(sectionAnchorOf(id)).toBeNull();
    }
  });
});
