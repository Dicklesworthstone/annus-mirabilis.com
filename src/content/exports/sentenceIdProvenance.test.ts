/**
 * NO EXPORTED SENTENCE ID IS MINTED, AND NONE COLLIDES ACROSS THE CORPUS (am-49lz).
 *
 * The defect: `emitter.ts` fell back to `${b.id}-s1` for every block of a section with no cut
 * sentence units, minting ids into the frozen `s<n>-p<m>-s<k>` grammar. Two different units became
 * addressable by one id, so any consumer keyed on id would silently merge them.
 *
 * Why no existing gate saw it, in the bead's words and confirmed here: the determinism arm asserts
 * two runs agree, and two runs agree on a collision too; the golden files pin each format against
 * its own past self; `exportStability.test.ts` asserts JSON and Markdown carry the same unit set,
 * and they would carry the same colliding set. Nothing compared an emitted id against a manifest.
 * Removing the fallback left all 34 pre-existing export tests green, which is the same finding from
 * the other side: none of them reached it.
 *
 * This file runs the REAL emitter over inputs built from the FOUR REAL MANIFESTS, not a fixture of
 * them, because the question is what the corpus would publish. The ids a manifest freezes are its
 * `units` entries; measured 2026-10-05, the four manifests declare 178, 263, 53 and 436 units and
 * none of their units carries `sentenceSpans`, so every section would have taken the fallback.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { load as parseYaml } from "js-yaml";
import { validateSourceManifest } from "../manifest/schema.ts";
import { emitMachineReadableExports } from "./emitter.ts";
import { ExportValidationError } from "./schemas.ts";
import { checkSentenceIdProvenance, type EmittedSentenceIds } from "./sentenceIdProvenance.ts";

const ROOT = process.cwd();
const PAPERS = ["brownian-motion", "light-quanta", "mass-energy", "special-relativity"] as const;

interface ManifestUnit {
  readonly id: string;
  readonly kind?: string;
  readonly section?: string;
  readonly sentenceSpans?: readonly { readonly id: string }[];
}

function manifestUnits(slug: string): readonly ManifestUnit[] {
  const path = resolve(ROOT, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(path)) return [];
  const manifest = validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path) as {
    units?: readonly ManifestUnit[];
  };
  return manifest.units ?? [];
}

/** Every id a paper's manifest declares. This is the frozen set an emitted id must come from. */
const declaredByPaper = new Map<string, ReadonlySet<string>>(
  PAPERS.map((slug) => [slug, new Set(manifestUnits(slug).map((u) => u.id))]),
);

/**
 * Emitter inputs built from a manifest.
 *
 * `withSpans` decides which of the two real situations is modelled, and BOTH are needed:
 *
 *   - `true`: a block declares as its spans the sentence units the manifest freezes under it, which
 *     is `${block.id}-s<k>`. No manifest carries a `sentenceSpans` key yet, so this is derived from
 *     the unit ids rather than read -- and those ids ARE the frozen sentence ids, which is the whole
 *     point: it gives the provenance check a real population instead of an empty one. A gate run
 *     over zero ids reads exactly like a clean gate.
 *   - `false`: blocks with no spans at all, which is the corpus as it stands and the path the minting
 *     fallback used to take.
 */
function inputsFor(slug: string, withSpans: boolean) {
  const units = manifestUnits(slug);
  const sentenceIdsByBlock = new Map<string, { id: string }[]>();
  if (withSpans) {
    const ids = new Set(units.map((u) => u.id));
    for (const unit of units) {
      const cut = /^(.*)-s\d+[a-z]?$/.exec(unit.id);
      const parent = cut?.[1];
      // Only a sentence id whose own parent block is also declared, so nothing is invented here.
      if (parent === undefined || !ids.has(parent)) continue;
      sentenceIdsByBlock.set(parent, [...(sentenceIdsByBlock.get(parent) ?? []), { id: unit.id }]);
    }
  }
  const blocks = units.map((unit, index) => ({
    id: unit.id,
    // The paper discriminator. Without it the emitter refuses a multi-paper emit, which is the
    // repair for a merge this very test found: four papers sharing the `s0` section grammar were
    // each given all four papers' blocks.
    paper: slug,
    section: unit.section ?? "s0",
    kind: unit.kind ?? "paragraph",
    order: index,
    diplomaticText: `Text of ${unit.id}.`,
    ...(sentenceIdsByBlock.has(unit.id)
      ? { sentenceSpans: sentenceIdsByBlock.get(unit.id) }
      : unit.sentenceSpans
        ? { sentenceSpans: unit.sentenceSpans }
        : {}),
  }));
  return {
    paper: {
      id: slug,
      slug,
      title: slug,
      sections: [...new Set(blocks.map((b) => b.section))].map((id) => ({ id, title: id })),
    },
    blocks,
  };
}

/** Sentence ids the emitter actually wrote, read back out of the emitted section files. */
async function emitAndCollect(
  slugs: readonly string[],
  withSpans: boolean,
): Promise<EmittedSentenceIds[]> {
  const dir = mkdtempSync(join(tmpdir(), "sentence-id-provenance-"));
  const built = slugs.map((slug) => inputsFor(slug, withSpans));
  const index = await emitMachineReadableExports({
    rootDir: dir,
    contentRevision: "test",
    releaseProfile: "preview",
    papers: built.map((b) => b.paper),
    sourceBlocks: built.flatMap((b) => b.blocks),
  });
  // READ THE EMITTER'S OWN INDEX, not a guessed path. A first version of this read
  // `papers/<slug>.json`, which carries section METADATA and links; the sentences are in the
  // per-section files `papers/<slug>/<sectionId>.json`. It therefore collected nothing and the
  // check passed over an empty population, which is the exact failure this gate exists to refuse.
  const out: EmittedSentenceIds[] = [];
  for (const { paper } of built) {
    const sentenceIds: string[] = [];
    const prefix = `papers/${paper.slug}/`;
    for (const entry of index.files) {
      if (!entry.path.startsWith(prefix) || !entry.path.endsWith(".json")) continue;
      const parsed = JSON.parse(readFileSync(resolve(dir, "exports/v1", entry.path), "utf8")) as {
        sentences?: readonly { id: string }[];
      };
      for (const sentence of parsed.sentences ?? []) sentenceIds.push(sentence.id);
    }
    out.push({ paper: paper.slug, sentenceIds });
  }
  return out;
}

describe("the manifests this gate reads are real, which is the denominator for everything below", () => {
  test("all four manifests load and declare ids", () => {
    const report: string[] = [];
    for (const slug of PAPERS) {
      const ids = declaredByPaper.get(slug);
      // Non-vacuity before any verdict: with an empty set every "is declared" check below would
      // fail, and with a missing file every emitted id would read as undeclared.
      expect(ids?.size ?? 0).toBeGreaterThan(40);
      report.push(`${slug}: ${ids?.size ?? 0} declared`);
    }
    console.log(`[sentence id provenance] ${report.join(" | ")}`);
  });
});

describe("the real emitter over the real manifests", () => {
  test("emits no sentence id that no manifest declares, and none twice within a paper", async () => {
    const emitted = await emitAndCollect(PAPERS, true);
    const result = checkSentenceIdProvenance(emitted, declaredByPaper);
    console.log(
      `[sentence id provenance] ${result.examined} emitted sentence id(s) across ${result.papers} paper(s), against ${result.declared} declared id(s); ${result.findings.length} finding(s); ${result.sharedDeclaredIds.length} id(s) shared between papers and declared by each`,
    );
    expect(result.declared).toBeGreaterThan(500);
    // NON-VACUITY, ASSERTED RATHER THAN HOPED. The first version of this test ran over the corpus
    // as it stands, where no block carries spans, so it examined 0 ids and passed -- which reads
    // exactly like a clean gate and establishes nothing. The spans are now derived from the frozen
    // sentence ids, so the population is real.
    expect(result.examined).toBeGreaterThan(300);
    expect(result.findings).toEqual([]);
    // And the sharing is reported, which is the thing a corpus-wide uniqueness rule would have
    // refused: these ids are declared by every paper that emits them.
    expect(result.sharedDeclaredIds.length).toBeGreaterThan(0);
  }, 120_000);

  test("a section with no cut sentence units emits zero sentences rather than a minted id", async () => {
    // The direct statement of the fix. None of the four manifests carries sentenceSpans today, so
    // every section takes this path; the old fallback would have emitted one id per block here.
    const emitted = await emitAndCollect(PAPERS, false);
    const total = emitted.reduce((n, e) => n + e.sentenceIds.length, 0);
    const blocks = PAPERS.reduce((n, slug) => n + manifestUnits(slug).length, 0);
    console.log(
      `[sentence id provenance] ${blocks} block(s) with no spans emitted ${total} sentence id(s); the fallback would have emitted ${blocks}`,
    );
    // The population is real, so zero means something.
    expect(blocks).toBeGreaterThan(900);
    expect(total).toBe(0);
  }, 120_000);
});

describe("the gate would have refused the old emitter's output", () => {
  test("the ids the removed fallback would have minted are refused, over the real corpus", () => {
    // THE PLANT THAT MATTERS MOST, and it needs no file edit: the removed fallback's rule was
    // exactly `${block.id}-s1`, so the ids it WOULD have emitted are computable from the manifests.
    // Feeding them to the predicate asks the question the acceptance item asks -- would this gate
    // have caught the defect it was written for -- without reintroducing the defect to find out.
    const minted = PAPERS.map((slug) => ({
      paper: slug,
      // Blocks only. A sentence unit is not a block, and the fallback ran over blocks.
      sentenceIds: manifestUnits(slug)
        .filter((unit) => !/-s\d+[a-z]?$/.test(unit.id))
        .map((unit) => `${unit.id}-s1`),
    }));
    const total = minted.reduce((n, m) => n + m.sentenceIds.length, 0);
    const result = checkSentenceIdProvenance(minted, declaredByPaper);
    const byKind = new Map<string, number>();
    for (const finding of result.findings)
      byKind.set(finding.kind, (byKind.get(finding.kind) ?? 0) + 1);
    console.log(
      `[sentence id provenance] the fallback would have minted ${total} id(s); the gate reports ${result.findings.length} finding(s): ${[...byKind].map(([k, n]) => `${k} ${n}`).join(", ")}`,
    );
    // The plant landed: there is a real population of minted ids to judge.
    expect(total).toBeGreaterThan(400);
    // And the gate refuses it. Both classes are present, which is the point of having two arms:
    // ids minted into a grammar their own paper never declared, and ids two papers both mint.
    expect(result.findings.length).toBeGreaterThan(0);
    expect(byKind.get("not-declared") ?? 0).toBeGreaterThan(0);
    expect(byKind.get("duplicate-undeclared") ?? 0).toBeGreaterThan(0);
  });
});

describe("two papers in one emit do not receive each other's blocks", () => {
  /** Two papers, one block each, both in a section called s0 -- the real section grammar. */
  const twoPapers = (declarePaper: boolean) => ({
    rootDir: mkdtempSync(join(tmpdir(), "two-papers-")),
    contentRevision: "test",
    releaseProfile: "preview" as const,
    papers: [
      { id: "alpha", slug: "alpha", title: "Alpha", sections: [{ id: "s0", title: "S0" }] },
      { id: "beta", slug: "beta", title: "Beta", sections: [{ id: "s0", title: "S0" }] },
    ],
    sourceBlocks: [
      {
        id: "s0-p1",
        ...(declarePaper ? { paper: "alpha" } : {}),
        section: "s0",
        kind: "paragraph",
        order: 0,
        diplomaticText: "ALPHA TEXT",
        sentenceSpans: [{ id: "s0-p1-s1" }],
      },
      {
        id: "s0-p9",
        ...(declarePaper ? { paper: "beta" } : {}),
        section: "s0",
        kind: "paragraph",
        order: 1,
        diplomaticText: "BETA TEXT",
        sentenceSpans: [{ id: "s0-p9-s1" }],
      },
    ],
  });

  test("with the paper declared, each paper's section carries only its own block", async () => {
    // THE DEFECT THIS REPLACES, measured before the repair: blocks were grouped by SECTION ID
    // alone, so `papers/alpha/s0.json` listed blocks ["s0-p1","s0-p9"] and sentences
    // ["s0-p1-s1","s0-p9-s1"], and `papers/beta/s0.json` listed exactly the same. Every paper in
    // this corpus uses the same section grammar, so wiring the real four would have published each
    // paper carrying all four papers' source text. Found while giving am-49lz's gate a population.
    const input = twoPapers(true);
    const index = await emitMachineReadableExports(input);
    const seen: Record<string, { blocks: string[]; sentences: string[] }> = {};
    for (const file of index.files) {
      const match = /^papers\/(alpha|beta)\/s0\.json$/.exec(file.path);
      if (!match?.[1]) continue;
      const parsed = JSON.parse(
        readFileSync(resolve(input.rootDir, "exports/v1", file.path), "utf8"),
      ) as { blocks?: readonly { id: string }[]; sentences?: readonly { id: string }[] };
      seen[match[1]] = {
        blocks: (parsed.blocks ?? []).map((b) => b.id),
        sentences: (parsed.sentences ?? []).map((x) => x.id),
      };
    }
    // Both files were found, or the assertions below would pass on absence.
    expect(Object.keys(seen).sort()).toEqual(["alpha", "beta"]);
    expect(seen.alpha).toEqual({ blocks: ["s0-p1"], sentences: ["s0-p1-s1"] });
    expect(seen.beta).toEqual({ blocks: ["s0-p9"], sentences: ["s0-p9-s1"] });
  }, 60_000);

  test("without it, a multi-paper emit is REFUSED rather than merged silently", async () => {
    // The direction that matters more: a silent merge is indistinguishable from correct output, so
    // the ambiguity is refused instead of resolved by guessing. A single-paper caller is unaffected,
    // which is why `paper` is optional -- proved by the whole pre-existing export suite staying
    // green, and by the test below.
    let thrown: unknown;
    try {
      await emitMachineReadableExports(twoPapers(false));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ExportValidationError);
    const refusal = thrown as ExportValidationError;
    // THE CODE IS NAMED, not only the message. `rejects.toThrow(/declare no paper/)` passes on any
    // error whose prose happens to match, and it left this throw site reading as UNTESTED to the
    // refusal ratchet, which looks for the code as a string literal. Asserting the identity is both
    // the stronger check and the honest citation (emitter.ts:364).
    expect(refusal.schema).toBe("emitter-input");
    expect(refusal.path).toBe("sourceBlocks[].paper");
    expect(refusal.message).toMatch(/2 papers are being emitted/);
    expect(refusal.message).toMatch(/declare no paper/);
  }, 60_000);

  test("a single-paper emit still needs no paper on its blocks", async () => {
    const input = twoPapers(false);
    const index = await emitMachineReadableExports({
      ...input,
      rootDir: mkdtempSync(join(tmpdir(), "one-paper-")),
      papers: [input.papers[0] ?? { id: "alpha", slug: "alpha", title: "Alpha" }],
    });
    expect(index.files.some((f) => f.path === "papers/alpha/s0.json")).toBe(true);
  }, 60_000);
});

describe("the planted negatives, so a clean result above is a result", () => {
  test("A: an id emitted for a paper that does not declare it is refused, and the owner is named", () => {
    // The bead's class A, with the plant corrected after a first version of it came back GREEN. It
    // stole brownian's first sentence-shaped id, which is `s0-p1-s1` -- and ALL FOUR manifests
    // declare that string, so light-quanta emitting it is not a finding at all. The plant has to
    // name an id brownian declares and light-quanta does NOT, or it proves nothing. That green plant
    // is what surfaced the 214 shared ids and corrected this gate's design.
    const brownian = declaredByPaper.get("brownian-motion") ?? new Set<string>();
    const lightQuanta = declaredByPaper.get("light-quanta") ?? new Set<string>();
    const stolen = [...brownian].find((id) => /-s\d+$/.test(id) && !lightQuanta.has(id));
    // The plant must have something real to steal, or it proves nothing.
    expect(stolen).toBeDefined();
    const result = checkSentenceIdProvenance(
      [{ paper: "light-quanta", sentenceIds: [stolen ?? ""] }],
      declaredByPaper,
    );
    expect(result.examined).toBe(1);
    expect(result.findings.map((f) => f.kind)).toEqual(["not-declared"]);
    // The report names the paper that really owns it, which is what makes the finding actionable.
    expect(result.findings[0]?.detail).toContain("brownian-motion");
  });

  test("B: two papers minting the same id are refused, even when nothing freezes it", () => {
    // The bead's class B, and it is a DIFFERENT failure: this id is declared by nobody, so class A
    // alone would report it once per paper and never say the two collide with each other.
    const result = checkSentenceIdProvenance(
      [
        { paper: "light-quanta", sentenceIds: ["s9-p9-s9"] },
        { paper: "special-relativity", sentenceIds: ["s9-p9-s9"] },
      ],
      declaredByPaper,
    );
    expect(result.examined).toBe(2);
    const crossPaper = result.findings.filter((f) => f.kind === "duplicate-undeclared");
    expect(crossPaper).toHaveLength(1);
    expect(crossPaper[0]?.detail).toContain("light-quanta");
    expect(crossPaper[0]?.detail).toContain("special-relativity");
  });

  test("C: a paper re-minting one of its OWN frozen ids is refused as a duplicate", () => {
    // The bead's class C, latent: brownian's blocks would each mint an id that is already one of
    // its own. Declared, so class A cannot see it; emitted twice, so the duplicate arm must.
    const brownian = [...(declaredByPaper.get("brownian-motion") ?? [])];
    const own = brownian.find((id) => /-s\d+$/.test(id));
    expect(own).toBeDefined();
    const result = checkSentenceIdProvenance(
      [{ paper: "brownian-motion", sentenceIds: [own ?? "", own ?? ""] }],
      declaredByPaper,
    );
    expect(result.examined).toBe(2);
    expect(result.findings.map((f) => f.kind)).toEqual(["duplicate-in-paper"]);
    expect(result.findings[0]?.detail).toContain("within brownian-motion");
  });

  test("and the predicate passes what it should, so it is not refusing everything", () => {
    // The other direction. A stripper or checker that refused everything would satisfy all three
    // plants above and be useless.
    const brownian = [...(declaredByPaper.get("brownian-motion") ?? [])];
    const two = brownian.filter((id) => /-s\d+$/.test(id)).slice(0, 2);
    expect(two).toHaveLength(2);
    const result = checkSentenceIdProvenance(
      [{ paper: "brownian-motion", sentenceIds: two }],
      declaredByPaper,
    );
    expect(result.examined).toBe(2);
    expect(result.findings).toEqual([]);
  });

  test("the same DECLARED id emitted by two papers is reported, not refused", () => {
    // The arm the bead's acceptance item 3 would have got wrong. `s0-p1-s1` is declared by all four
    // manifests and names a different real sentence in each, so two papers emitting it is the
    // grammar working. A corpus-wide uniqueness rule would have refused the corpus's own frozen ids.
    const shared = "s0-p1-s1";
    for (const slug of ["brownian-motion", "light-quanta"] as const)
      expect(declaredByPaper.get(slug)?.has(shared)).toBe(true);
    const result = checkSentenceIdProvenance(
      [
        { paper: "brownian-motion", sentenceIds: [shared] },
        { paper: "light-quanta", sentenceIds: [shared] },
      ],
      declaredByPaper,
    );
    expect(result.findings).toEqual([]);
    // Reported rather than silent, so the sharing is visible without being fatal.
    expect(result.sharedDeclaredIds).toEqual([shared]);
  });

  test("an unsupplied paper is a finding, not a silent pass", () => {
    // The fail-open this predicate could have had: no manifest for a paper means nothing declares
    // its ids, which must read as a refusal rather than as "nothing to check against".
    const result = checkSentenceIdProvenance(
      [{ paper: "not-a-paper", sentenceIds: ["s0-p1-s1"] }],
      declaredByPaper,
    );
    expect(result.findings.map((f) => f.kind)).toEqual(["not-declared"]);
    expect(result.findings[0]?.detail).toContain("no manifest was supplied");
  });
});
