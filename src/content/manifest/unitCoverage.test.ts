/**
 * Unit statuses derived from the tree (am-rc1001-bridge-plan-pcjk.13). On 2026-10-01 all 544
 * manifest units reported `unspecified`, so the completeness authority could never say a paper's
 * blocks were covered.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { strictParse } from "../schemas/strictParse.ts";
import { formatManifestReportText, generateManifestReport, ManifestReportError } from "./report.ts";
import { validateSourceManifest } from "./schema.ts";
import { readSourceLayers } from "./sourceLayers.ts";
import type { SourceManifest } from "./types.ts";
import { deriveUnitCoverage } from "./unitCoverage.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

function manifestOf(root: string, paper: string): SourceManifest {
  const path = join(root, "content", "source-blocks", paper, "manifest.yaml");
  return validateSourceManifest(parseYaml(readFileSync(path, "utf8")), path);
}

describe("every manifest unit gets a status from the tree", () => {
  for (const paper of PAPERS)
    test(`${paper}: the population is the manifest's, and no unit is unspecified`, () => {
      const manifest = manifestOf(ROOT, paper);
      const coverage = deriveUnitCoverage(ROOT, manifest);
      const report = generateManifestReport(
        manifest,
        readSourceLayers(ROOT, paper, manifest.document, manifest.pageCount),
        coverage,
      );
      console.log(
        `[unit coverage] ${paper}: ${coverage.length} units, ${report.coveredCount} covered (${report.declaredUnits.length} by a declaration), ${report.glossedCount} glossed`,
      );
      expect(coverage.map((c) => c.id)).toEqual(manifest.units.map((u) => u.id));
      expect(report.unitStatusSource).toBe("derived-from-tree");
      expect(report.byStatus.unspecified).toBeUndefined();
      expect(coverage.length).toBeGreaterThan(0);
    });

  test("the two relativity paragraphs declared unexplained report as declared, with their reasons", () => {
    const coverage = deriveUnitCoverage(ROOT, manifestOf(ROOT, "special-relativity"));
    for (const id of ["s1-fn1", "s5-p8"]) {
      const unit = coverage.find((c) => c.id === id);
      expect(unit?.status).toBe("covered-declared");
      expect(unit?.declared?.status).toBe("unexplained");
      expect(unit?.declared?.reason.length).toBeGreaterThan(20);
    }
  });

  test("mass-energy agrees with an independent census of blocks, alignment and gloss", () => {
    // Counted from the files directly, not through deriveUnitCoverage's readers.
    const blockFiles = readdirSync(join(ROOT, "content/source-blocks/mass-energy")).filter((f) =>
      /^kind:/m.test(readFileSync(join(ROOT, "content/source-blocks/mass-energy", f), "utf8")),
    );
    const alignment = strictParse(
      readFileSync(join(ROOT, "content/alignments/mass-energy.yaml"), "utf8"),
      "yaml",
    ) as { edges: { source: { blockId: string } }[] };
    const alignedBlocks = new Set(alignment.edges.map((e) => e.source.blockId));
    const coverage = deriveUnitCoverage(ROOT, manifestOf(ROOT, "mass-energy"));
    // A SOURCE BLOCK IS A FILE; A SENTENCE IS A SPAN INSIDE ONE. Measured 2026-10-02, this read
    // `expect(blockFiles.length).toBe(coverage.length)` on 25 files and 25 units. That equality is
    // not a property of the corpus, it was an artifact of this paper having no sentence units yet:
    // brownian-motion has carried 178 units over about 90 block files since 2026-09-21, because
    // sentences live as `sentenceSpans` inside their paragraph's file rather than as files of their
    // own. On 2026-10-03 this paper's 28 sentence ids became units under owner ruling am-xz2d and
    // the equality broke on correct work. So the census now compares like with like, and gains the
    // sentence half it never had: block-level units against block FILES, sentence units against
    // the span ids counted from those same files.
    //
    // THE THIRD TIME, and the partition now names the sub-block kinds instead of excluding one at a
    // time. On 2026-10-09, 24 inline-equation units landed and `kind !== "sentence"` counted them as
    // block FILES: 25 files against 49. An inline equation is a region inside a sentence, no more a
    // file than a sentence is, so it gets its own census below rather than a place in either half.
    const SUB_BLOCK_KINDS = new Set(["sentence", "inline-equation"]);
    const blockLevel = coverage.filter((c) => !SUB_BLOCK_KINDS.has(c.kind));
    const sentenceUnits = coverage.filter((c) => c.kind === "sentence");
    const inlineUnits = coverage.filter((c) => c.kind === "inline-equation");
    const spanIds = new Set(
      blockFiles.flatMap((f) => {
        const text = readFileSync(join(ROOT, "content/source-blocks/mass-energy", f), "utf8");
        const blockId = f.slice(0, -".yaml".length);
        const spans = text.split("sentenceSpans:")[1];
        return spans === undefined
          ? []
          : [...spans.matchAll(/^\s+- id: "([\w.-]+)"/gm)]
              .map((m) => m[1] as string)
              // A masthead, closing or footnote block carries ONE span that is the block itself, so
              // it is not a sentence and is already inventoried as its own block-level unit.
              .filter((id) => id !== blockId);
      }),
    );
    expect(blockFiles.length).toBe(blockLevel.length);
    expect(alignedBlocks.size).toBe(blockLevel.length);
    // Every sentence id authored on a block is inventoried, and no unit is invented: set equality,
    // not two counts that could agree while naming different members.
    expect([...spanIds].sort()).toEqual(sentenceUnits.map((c) => c.id).sort());
    expect(sentenceUnits.length).toBeGreaterThan(0);
    // The inline half, censused INDEPENDENTLY of the derivation that produced these units. Set
    // equality against that derivation is asserted in inlineEquationUnits.test.ts; repeating it here
    // would only re-ask the derivation whether it agrees with itself. What this can ask, from the
    // files alone, is that every inline id names a real owner: an `-m<i>` suffix on a span id or a
    // block id censused above, with a 1-based index. An id whose owner does not exist is the failure
    // that matters, because these ids are frozen and one naming a wrong passage is not editable.
    const censusedOwners = new Set([
      ...spanIds,
      ...blockFiles.map((f) => f.slice(0, -".yaml".length)),
    ]);
    const badlyOwned = inlineUnits.filter((c) => {
      const match = /^(.+)-m(\d+)$/.exec(c.id);
      return match === null || !censusedOwners.has(match[1] as string) || Number(match[2]) < 1;
    });
    expect(badlyOwned.map((c) => c.id)).toEqual([]);
    expect(inlineUnits.length).toBeGreaterThan(0);
    expect(coverage.every((c) => c.status === "covered")).toBe(true);
    const text = formatManifestReportText(
      generateManifestReport(
        manifestOf(ROOT, "mass-energy"),
        readSourceLayers(ROOT, "mass-energy", "ap-18-639", 3),
        coverage,
      ),
    );
    expect(text).toContain(`Every block covered: ${coverage.length} of ${coverage.length}`);
  });
});

describe("a missing layer demotes exactly the unit it belongs to", () => {
  /** A copy of mass-energy's records the plants may change; the repository's are never touched. */
  function scratchTree(): string {
    const root = mkdtempSync(join(tmpdir(), "am-unit-coverage-"));
    for (const dir of ["source-blocks", "translation-units", "gloss-units"])
      cpSync(join(ROOT, "content", dir, "mass-energy"), join(root, "content", dir, "mass-energy"), {
        recursive: true,
      });
    for (const dir of ["alignments", "bindings"]) {
      mkdirSync(join(root, "content", dir), { recursive: true });
      cpSync(
        join(ROOT, "content", dir, "mass-energy.yaml"),
        join(root, "content", dir, "mass-energy.yaml"),
      );
    }
    return root;
  }
  const statuses = (root: string) =>
    new Map(deriveUnitCoverage(root, manifestOf(ROOT, "mass-energy")).map((c) => [c.id, c]));

  test("removing s0-p2's alignment edge makes s0-p2, and only s0-p2, not-translated", () => {
    const root = scratchTree();
    const before = statuses(root);
    const path = join(root, "content/alignments/mass-energy.yaml");
    const text = readFileSync(path, "utf8");
    // The one edge out of s0-p2, cut from the YAML text (the reader is the strict YAML parser).
    const edge =
      / {2}- source:\n {6}paper: "mass-energy"\n {6}blockId: "s0-p2"\n(?: {6}.*\n)*? {4}target:\n {6}translationUnitId: "[\w-]+"\n/;
    expect(text.match(new RegExp(edge.source, "g"))?.length).toBe(1);
    writeFileSync(path, text.replace(edge, ""));
    expect(readFileSync(path, "utf8")).not.toContain('blockId: "s0-p2"');
    const after = statuses(root);
    const changed = [...after].filter(([id, c]) => before.get(id)?.status !== c.status);
    // TWO UNITS, AND THAT IS THE POINT. This expected ["s0-p2:not-translated"] alone until the
    // paper's 28 sentence ids became units on 2026-10-03. The single edge cut above is the one that
    // carries BOTH `blockId: "s0-p2"` and `sentenceId: "s0-p2-s1"`, so its removal takes the English
    // rendering of the paragraph AND of the sentence it contains; a derivation that demoted only the
    // paragraph would be judging the sentence by its parent instead of on its own evidence. What the
    // test is really asserting survives unchanged and is what its title says: the demotion reaches
    // exactly the unit the missing layer belongs to, and nothing else in the paper moves.
    expect(changed.map(([id, c]) => `${id}:${c.status}`)).toEqual([
      "s0-p2:not-translated",
      "s0-p2-s1:not-translated",
    ]);
  });

  test("setting one sentence's gloss aside un-glosses its paragraph, and only that one", () => {
    const root = scratchTree();
    const before = statuses(root);
    const gloss = join(root, "content/gloss-units/mass-energy/s0-p3-s1.yaml");
    expect(existsSync(gloss)).toBe(true);
    renameSync(gloss, `${gloss}.set-aside`);
    const after = statuses(root);
    const changed = [...after].filter(([id, c]) => before.get(id)?.glossed !== c.glossed);
    // The sentence now appears beside its paragraph for the same reason as in the test above: since
    // 2026-10-03 `s0-p3-s1` is a unit of its own, and the gloss set aside is precisely its gloss, so
    // it is the unit most directly affected. Every other sentence and paragraph in the paper keeps
    // its gloss, which is the "and only that one" the title promises.
    expect(changed.map(([id, c]) => `${id}:${c.glossed}`)).toEqual([
      "s0-p3:false",
      "s0-p3-s1:false",
    ]);
    // Gloss is reported, not gating: the status is unchanged.
    expect(after.get("s0-p3")?.status).toBe(before.get("s0-p3")?.status);
  });

  test("a coverage over fewer units than the manifest is refused", () => {
    const manifest = manifestOf(ROOT, "mass-energy");
    const coverage = deriveUnitCoverage(ROOT, manifest).slice(1);
    let caught: unknown;
    try {
      generateManifestReport(
        manifest,
        readSourceLayers(ROOT, "mass-energy", "ap-18-639", 3),
        coverage,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ManifestReportError);
    expect((caught as ManifestReportError).code).toBe("unit-coverage-population");
  });
});
