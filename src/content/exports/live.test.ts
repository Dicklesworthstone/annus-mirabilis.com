import { beforeAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportProfile,
  loadLiveExportInput,
  publishLiveExportBundle,
} from "../../../scripts/build-exports.ts";
import { setBilingualEditionTestOverride } from "../../reader/faces/bilingualLoader.ts";
import { getPaperExportLinks, publishedExportLinks } from "./discovery.ts";
import { plainText } from "../schemas/inlines.ts";
import { validateTranslationUnit } from "../schemas/source.ts";
import {
  createLiveExportBundle,
  type LiveExportBundle,
  type LiveExportInput,
} from "./live.ts";
import { escapeMarkdownSourceText } from "./markdown.ts";
import type {
  ArgumentExport, EquationExport, ExperimentExport, PaperExport, SectionExport,
} from "./types.ts";

let input: LiveExportInput;
let bundle: LiveExportBundle;
const normalized = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

beforeAll(async () => {
  input = await loadLiveExportInput(process.cwd(), "scaffold");
  bundle = createLiveExportBundle(input);
}, 60_000);

function textAt(path: string): string {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing corpus export ${path}.`);
  return file.text;
}
function recordAt<T>(path: string): T {
  return JSON.parse(textAt(path)) as T;
}

describe("production machine-readable corpus", () => {
  it("publishes real paper identities, every source block, and exact translation provenance", () => {
    expect(input.papers.length).toBeGreaterThanOrEqual(4);
    let sourceBlocks = 0;
    let translations = 0;
    for (const own of input.papers) {
      const slug = own.payload.paper.id;
      const paper = recordAt<PaperExport>(`/exports/v1/papers/${slug}.json`);
      expect(paper.bibKey).toBe(own.receipt.key);
      expect(paper.titleGerman).toBe(own.receipt.paper.titleGerman);
      expect(paper.journal.doi).toBe(own.receipt.paper.journal.doi);
      expect(paper.sourceStatus).toBe(own.payload.paper.sourceStatus);
      expect(paper.sourceNotice).toBe(own.payload.paper.sourceNotice);
      if (own.receipt.scan.publicationDecision === "publish") {
        expect(paper.sourceAssetDigest).toBe(own.receipt.scan.sha256);
      } else {
        expect(paper.sourceAssetDigest).toBeUndefined();
      }
      const sections = paper.sections.map((section) =>
        recordAt<SectionExport>(section.exportJsonUrl),
      );
      const blocks = sections.flatMap((section) => section.blocks);
      expect(blocks.map((block) => block.id).sort())
        .toEqual(own.edition.blocks.map((block) => block.id).sort());
      expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
      for (const original of own.edition.blocks) {
        const exported = blocks.find((block) => block.id === original.id);
        expect(exported?.diplomaticText).toBe(original.diplomaticText);
        expect(exported?.status).toEqual(original.status);
        expect(plainText(exported?.inlines ?? [])).toBe(plainText(original.inlines));
      }
      const units = new Map(
        sections.flatMap((section) => section.translationUnits ?? []).map((unit) => [unit.id, unit]),
      );
      expect([...units.keys()].sort()).toEqual(own.edition.units.map((unit) => unit.id).sort());
      for (const unit of own.edition.units) {
        expect(units.get(unit.id)).toEqual(normalized(validateTranslationUnit(unit)));
      }
      const edges = sections.flatMap((section) => section.alignments ?? []);
      expect(edges).toHaveLength(own.edition.alignment?.edges.length ?? 0);
      for (const edge of edges) expect(edge.source.paper).toBe(slug);
      sourceBlocks += blocks.length;
      translations += units.size;
    }
    expect(sourceBlocks).toBeGreaterThan(300);
    expect(translations).toBeGreaterThan(700);
  });

  it("retains every editorial record and attaches only notes whose affected ids belong to a section", () => {
    let notes = 0;
    for (const own of input.papers) {
      const paper = recordAt<PaperExport>(`/exports/v1/papers/${own.payload.paper.id}.json`);
      expect(paper.editorialNotes).toEqual(normalized(own.editorialNotes ?? []));
      notes += paper.editorialNotes?.length ?? 0;
      for (const reference of paper.sections) {
        const section = recordAt<SectionExport>(reference.exportJsonUrl);
        const ids = new Set([
          section.sectionId,
          ...(section.arguments ?? []).map((argument) => argument.id),
          ...section.blocks.map((block) => block.id),
          ...section.sentences.map((sentence) => sentence.id),
          ...(section.translationUnits ?? []).map((unit) => unit.id),
        ]);
        const expected = (own.editorialNotes ?? [])
          .filter((note) => note.affectedIds.some((id) => ids.has(id)));
        expect(section.editorialNotes?.map((note) => note.record)).toEqual(normalized(expected));
      }
    }
    expect(notes).toBeGreaterThan(0);
  });

  it("preserves typed argument edges, all reading levels, and honest modern equation scope", () => {
    for (const own of input.papers) {
      for (const argument of own.payload.arguments) {
        const record = recordAt<ArgumentExport>(`/exports/v1/arguments/${argument.id}.json`);
        expect(record.meaning).toEqual(argument.meaning);
        expect(record.prerequisites).toEqual(argument.prerequisites);
        expect(record.readings).toEqual(argument.readings);
        expect(record.reviewState).toBe(argument.review);
      }
      for (const equation of own.payload.equations) {
        const record = recordAt<EquationExport>(`/exports/v1/equations/${equation.id}.json`);
        expect(record.tree).toEqual(equation.tree);
        expect(record.assumptions).toEqual(equation.assumptions);
        expect(record.notation).toBe("modern-pedagogical");
        expect(record.latexSource).toBeUndefined();
        expect(record.latexModern).not.toContain("eq-model-");
      }
    }
    const markdown = textAt("/exports/v1/papers/mass-energy/s0.md");
    for (const level of ["(R0)", "(R1)", "(R2)", "(R3)"]) expect(markdown).toContain(level);
    const mass = input.papers.find((paper) => paper.payload.paper.id === "mass-energy");
    for (const argument of mass?.payload.arguments ?? []) {
      expect(markdown).toContain(escapeMarkdownSourceText(argument.title));
    }
  });

  it("retains categorical and boolean experiment controls without manufacturing numeric defaults", () => {
    for (const manifest of input.experiments) {
      const record = recordAt<ExperimentExport>(`/exports/v1/experiments/${manifest.id}.json`);
      expect(record.manifest).toEqual(normalized(manifest));
      expect(record.parameters.every((parameter) => typeof parameter.default === "number")).toBe(true);
    }
    const lq = recordAt<{
      manifest: { parameters: { id: string; default: unknown }[] };
    }>("/exports/v1/experiments/lq-05.json");
    expect(lq.manifest.parameters.find((parameter) => parameter.id === "locked")?.default).toBe(false);
    expect(lq.manifest.parameters.find((parameter) => parameter.id === "view")?.default).toBe("enumeration");
  });

  it("indexes deterministic bytes and keeps historical article metadata separate from commentary", () => {
    const reordered = createLiveExportBundle({
      ...input, papers: [...input.papers].reverse(), experiments: [...input.experiments].reverse(),
    });
    expect(reordered.files).toEqual(bundle.files);
    for (const entry of bundle.index.files) {
      const text = textAt(entry.path);
      expect(Buffer.byteLength(text)).toBe(entry.bytes);
      expect(createHash("sha256").update(text).digest("hex")).toBe(entry.sha256);
    }
    const graph = recordAt<{ "@graph": Record<string, unknown>[] }>(
      "/exports/v1/jsonld/mass-energy.json",
    )["@graph"];
    const article = graph.find((entity) => entity["@type"] === "ScholarlyArticle");
    expect(article?.license).toBeUndefined();
    expect(article?.translator).toBeUndefined();
    expect(article?.datePublished).toBe("1905-11-21");
    expect(graph.some((entity) => entity["@type"] === "CreativeWork" && entity.isBasedOn)).toBe(true);
  });

  it("keeps unspanned source records in TSV and produces unique, resolvable TEI identities", () => {
    for (const own of input.papers) {
      const slug = own.payload.paper.id;
      const tsv = textAt(`/exports/v1/corpus/${slug}.tsv`);
      const ids = new Set(tsv.split("\n").filter((line) => !line.startsWith("#"))
        .map((line) => line.split("\t")[0]));
      for (const block of own.edition.blocks.filter((block) => block.sentenceSpans.length === 0)) {
        expect(ids.has(block.id)).toBe(true);
      }
      const xml = textAt(`/exports/v1/tei/${slug}.xml`);
      const xmlIds = [...xml.matchAll(/xml:id="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(xmlIds).size).toBe(xmlIds.length);
      const references = [...xml.matchAll(/corresp="([^"]*)"/g)]
        .flatMap((match) => (match[1] ?? "").split(" ").filter(Boolean));
      for (const reference of references) expect(xmlIds.includes(reference.slice(1))).toBe(true);
    }
  });

  it("withholds drafts for strict profiles and removes previously published paths without deleting backups", async () => {
    const strict = createLiveExportBundle({ ...input, profile: "preview" });
    expect(strict.index.files.every((entry) => entry.path.startsWith("/schemas/exports/v1/"))).toBe(true);
    const root = await mkdtemp(join(process.env.AM_TEST_TMP ?? tmpdir(), "am-live-exports-"));
    await publishLiveExportBundle(root, bundle);
    const path = join(root, "public/exports/v1/papers/mass-energy.json");
    expect(existsSync(path)).toBe(true);
    expect(publishedExportLinks(getPaperExportLinks("mass-energy"), root)).toHaveLength(4);
    await publishLiveExportBundle(root, strict);
    expect(existsSync(path)).toBe(false);
    expect(publishedExportLinks(getPaperExportLinks("mass-energy"), root)).toHaveLength(0);
    const publicIndex = JSON.parse(await readFile(join(root, "public/exports/v1/index.json"), "utf8"));
    expect(publicIndex.releaseProfile).toBe("preview");
    expect(publicIndex.files).toEqual(strict.index.files);
  }, 60_000);

  it("refuses wrong bibliographic identity and unsafe publication paths", async () => {
    const first = input.papers[0];
    if (!first) throw new Error("The prepared corpus is empty.");
    expect(() => createLiveExportBundle({
      ...input, papers: [{ ...first, receipt: { ...first.receipt, key: "wrong-paper" } }],
    })).toThrow("export-receipt-identity");
    const root = await mkdtemp(join(process.env.AM_TEST_TMP ?? tmpdir(), "am-export-refusal-"));
    await expect(publishLiveExportBundle(root, {
      index: bundle.index,
      files: [{ path: "/exports/v1/../../outside.json", text: "{}" }],
    })).rejects.toThrow("export-publication-path");
  });

  it("refuses unsafe identities, unknown profiles, duplicate paths, missing arguments, and absent notation", () => {
    const first = input.papers[0];
    if (!first) throw new Error("The prepared corpus is empty.");
    expect(() => exportProfile("production")).toThrow("export-profile-unknown");
    expect(() => createLiveExportBundle({
      ...input, profile: "production" as LiveExportInput["profile"],
    })).toThrow("export-profile-unknown");
    expect(() => createLiveExportBundle({
      ...input,
      papers: [{
        ...first,
        payload: { ...first.payload, paper: { ...first.payload.paper, id: "../escape" } },
      }],
    })).toThrow("export-path-identity");
    expect(() => createLiveExportBundle({ ...input, papers: [first, first] }))
      .toThrow("export-path-duplicate");
    const requiredArgument = first.payload.paper.sections
      .flatMap((section) => section.arguments)[0];
    if (!requiredArgument) throw new Error("The corpus has no argument to exercise.");
    expect(() => createLiveExportBundle({
      ...input,
      papers: [{
        ...first,
        payload: {
          ...first.payload,
          arguments: first.payload.arguments.filter((argument) => argument.id !== requiredArgument),
        },
      }],
    })).toThrow("export-argument-missing");
    const equation = first.payload.equations[0];
    if (!equation) throw new Error("The corpus has no equation to exercise.");
    expect(() => createLiveExportBundle({
      ...input,
      papers: [{
        ...first,
        payload: {
          ...first.payload,
          equations: [{ ...equation, paper: "unknown-teaching-paper" } as unknown as typeof equation],
        },
      }],
    })).toThrow("export-equation-notation");
  });

  it("refuses to publish a compiled paper whose source loader returns no edition", async () => {
    setBilingualEditionTestOverride(() => null);
    try {
      await expect(loadLiveExportInput(process.cwd(), "scaffold"))
        .rejects.toThrow("export-source-unavailable");
    } finally {
      setBilingualEditionTestOverride(null);
    }
  });
});
