import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { paperMetadata } from "../../reader/paperRoutes.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { formatExportLinkHtml, getPaperExportLinks, getSectionExportLinks } from "./discovery.ts";
import { emitMachineReadableExports } from "./emitter.ts";
import { escapeMarkdownSourceText, generateSectionMarkdown } from "./markdown.ts";
import { assertExportSafety, ExportValidationError, validateExportRecord } from "./schemas.ts";
import type { ExportIndex, SectionExport } from "./types.ts";

const sha256Hex = (buf: string | Uint8Array): string =>
  createHash("sha256").update(buf).digest("hex");

describe("Machine-Readable Exports (/exports/v1/) (am-cm-machine-readable-exports-xgy)", () => {
  const logger = getLogger("exports");

  function logOutcome(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-machine-readable-exports-xgy",
      outcome,
      message,
    });
  }

  // 1. Generation and Schema Validation
  it("generates all exports and index for fixture corpus and validates against JSON Schemas", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-exports-test-"));

    const index: ExportIndex = await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision: "rev-2026-test-abc",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          slug: "brownian-motion",
          title: FIXTURE_BROWNIAN_PAPER.titleEnglishWorking,
          germanTitle: FIXTURE_BROWNIAN_PAPER.titleGerman,
          authorLine: FIXTURE_BROWNIAN_PAPER.authorLine,
          bibKey: FIXTURE_BROWNIAN_PAPER.bibKey,
          dates: FIXTURE_BROWNIAN_PAPER.dates,
          journal: FIXTURE_BROWNIAN_PAPER.journal,
          sections: [
            {
              id: "bm-sec-04",
              title: "§ 4. On the Irregular Motion of Suspended Particles",
            },
          ],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignments: [FIXTURE_BROWNIAN_ALIGNMENT],
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      equations: [
        {
          id: "eq-bm-01",
          paper: "brownian-motion",
          section: "bm-sec-04",
          title: "Diffusion Coefficient (Stokes-Einstein)",
          latexModern: "D = \\frac{R T}{6 \\pi k N}",
          spoken: "D equals R times T over six pi k N",
          explanation: "Stokes-Einstein relation for the diffusion coefficient.",
          quantityIds: ["diffusionCoefficient", "temperature", "gasConstant"],
        },
      ],
      arguments: [
        {
          id: "arg-bm-01",
          paper: "brownian-motion",
          section: "bm-sec-04",
          title: "Osmotic Equilibrium and Irregular Motion",
          question: "How does osmotic pressure balance particle motion?",
          recap: "Particles undergo random thermal motion balanced by viscous drag.",
          premises: ["Dynamic equilibrium in a stationary liquid."],
          limitations: ["Valid only for spherical particles much larger than liquid molecules."],
          meaning: {
            logicalRole: "derivation",
            historicalStatus: "pedagogical-reconstruction",
            modelStatus: "exact-within-model",
            executionStatus: "static-illustration",
          },
        },
      ],
      experiments: [
        {
          id: "bm-01",
          paper: "brownian-motion",
          title: "Stokes-Einstein Diffusion Instrument",
          kind: "simulation",
          parameters: [
            {
              id: "temperature",
              name: "Temperature",
              unit: "K",
              default: 293.15,
              min: 270,
              max: 370,
            },
            { id: "viscosity", name: "Viscosity", unit: "Pa*s", default: 0.001 },
          ],
        },
      ],
    });

    expect(index.schemaVersion).toBe(1);
    expect(index.files.length).toBeGreaterThan(0);

    // Verify index itself against schema
    validateExportRecord("index", index);

    // Verify each generated JSON file on disk validates against its specific schema
    for (const entry of index.files) {
      const fullPath = resolve(tempRoot, "exports/v1", entry.path);
      const rawContent = await readFile(fullPath, "utf8");

      if (entry.format === "json") {
        const parsed = JSON.parse(rawContent);
        if (entry.path.startsWith("papers/") && entry.path.endsWith(".json")) {
          if (entry.path.split("/").length === 2) {
            validateExportRecord("paper", parsed);
          } else {
            validateExportRecord("section", parsed);
          }
        } else if (entry.path.startsWith("equations/")) {
          validateExportRecord("equation", parsed);
        } else if (entry.path.startsWith("arguments/")) {
          validateExportRecord("argument", parsed);
        } else if (entry.path.startsWith("experiments/")) {
          validateExportRecord("experiment", parsed);
        }
      }
    }

    logOutcome(
      "exports-schema-validation",
      "passed",
      "All exports generated and validated against schemas.",
    );
  });

  // 2. Determinism Test
  it("produces byte-identical exports and index across two separate builds", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const dirA = await mkdtemp(resolve(tempBase, "am-det-a-"));
    const dirB = await mkdtemp(resolve(tempBase, "am-det-b-"));

    const payload = {
      contentRevision: "fixed-digest-12345",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          slug: "brownian-motion",
          title: FIXTURE_BROWNIAN_PAPER.titleEnglishWorking,
          germanTitle: FIXTURE_BROWNIAN_PAPER.titleGerman,
          authorLine: FIXTURE_BROWNIAN_PAPER.authorLine,
          bibKey: FIXTURE_BROWNIAN_PAPER.bibKey,
          dates: FIXTURE_BROWNIAN_PAPER.dates,
          journal: FIXTURE_BROWNIAN_PAPER.journal,
          sections: [{ id: "s4", title: "§ 4. Motion" }],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      equations: [
        {
          id: "eq-bm-01",
          paper: "brownian-motion",
          title: "Diffusion",
          latexModern: "D = \\frac{R T}{6 \\pi k N}",
          spoken: "D equals R T over six pi k N",
          explanation: "Diffusion relation",
          quantityIds: ["D", "T"],
        },
      ],
    };

    const indexA = await emitMachineReadableExports({ ...payload, rootDir: dirA });
    const indexB = await emitMachineReadableExports({ ...payload, rootDir: dirB });

    expect(indexA.files.length).toBe(indexB.files.length);

    for (let i = 0; i < indexA.files.length; i++) {
      const fileA = indexA.files[i];
      const fileB = indexB.files[i];
      if (!fileA || !fileB) {
        throw new Error("Missing file in index");
      }
      expect(fileA.path).toBe(fileB.path);
      expect(fileA.sha256).toBe(fileB.sha256);
      expect(fileA.bytes).toBe(fileB.bytes);

      const contentA = await readFile(resolve(dirA, "exports/v1", fileA.path));
      const contentB = await readFile(resolve(dirB, "exports/v1", fileB.path));
      expect(contentA.equals(contentB)).toBe(true);
    }

    // index.json comparison
    const indexContentA = await readFile(resolve(dirA, "exports/v1/index.json"), "utf8");
    const indexContentB = await readFile(resolve(dirB, "exports/v1/index.json"), "utf8");
    expect(indexContentA).toBe(indexContentB);

    logOutcome(
      "exports-determinism",
      "passed",
      "Two separate builds produced byte-identical files and index.",
    );
  });

  // 3. Rights Filtering Test
  it("omits assets marked pin-local-only or reference-only from exports and index", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-rights-test-"));

    const sourceAssets = [
      {
        id: "sa-pinned-local",
        publicationDecision: "pin-local-only",
        sha256: "1111111111111111111111111111111111111111111111111111111111111111",
      },
      {
        id: "sa-reference-only",
        publicationDecision: "reference-only",
        sha256: "2222222222222222222222222222222222222222222222222222222222222222",
      },
      {
        id: "sa-public-scan",
        publicationDecision: "publish",
        sha256: "3333333333333333333333333333333333333333333333333333333333333333",
      },
    ];

    const index = await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision: "rev-rights-1",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          title: "Brownian Motion",
          sections: [{ id: "s4", title: "Section 4" }],
        },
      ],
      sourceAssets,
    });

    // Check that none of the files mention the pin-local or reference-only digests
    const indexStr = JSON.stringify(index);
    expect(
      indexStr.includes("1111111111111111111111111111111111111111111111111111111111111111"),
    ).toBe(false);
    expect(
      indexStr.includes("2222222222222222222222222222222222222222222222222222222222222222"),
    ).toBe(false);

    // Only the public scan digest is admitted
    const paperJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/papers/brownian-motion.json"), "utf8"),
    );
    expect(paperJson.sourceAssetDigest).toBe(
      "3333333333333333333333333333333333333333333333333333333333333333",
    );

    logOutcome(
      "exports-rights-filtering",
      "passed",
      "pin-local-only and reference-only assets omitted.",
    );
  });

  // 4. Profile Filtering Test
  it("exports draft units with reviewState and draft: true under preview, and omits them under production", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const previewDir = await mkdtemp(resolve(tempBase, "am-prof-preview-"));
    const prodDir = await mkdtemp(resolve(tempBase, "am-prof-prod-"));

    const draftBlock = {
      id: "bm-s4-b-draft",
      section: "s4",
      order: 1,
      diplomaticText: "Draft Satz der Bewegung.",
      sentenceSpans: [{ id: "bm-s4-b-draft-s1", span: { exactText: "Draft Satz der Bewegung." } }],
      status: {
        review: "draft",
        translation: "draft",
      },
    };

    const draftTranslation = {
      id: "tu-draft-01",
      sourceRefs: [{ id: "bm-s4-b-draft-s1" }],
      diplomaticText: "Draft sentence of motion.",
      reviewState: "machine-draft",
    };

    // Preview build
    await emitMachineReadableExports({
      rootDir: previewDir,
      contentRevision: "rev-preview",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          title: "Brownian Motion",
          sections: [{ id: "s4", title: "Section 4" }],
        },
      ],
      sourceBlocks: [draftBlock],
      translationUnits: [draftTranslation],
    });

    const previewSectionJson = JSON.parse(
      await readFile(resolve(previewDir, "exports/v1/papers/brownian-motion/s4.json"), "utf8"),
    );
    expect(previewSectionJson.sentences.length).toBe(1);
    expect(previewSectionJson.sentences[0].draft).toBe(true);
    expect(previewSectionJson.sentences[0].reviewState).toBe("machine-draft");
    expect(previewSectionJson.sentences[0].english).toBe("Draft sentence of motion.");

    // Production build
    await emitMachineReadableExports({
      rootDir: prodDir,
      contentRevision: "rev-prod",
      releaseProfile: "production",
      papers: [
        {
          id: "brownian-motion",
          title: "Brownian Motion",
          sections: [{ id: "s4", title: "Section 4" }],
        },
      ],
      sourceBlocks: [draftBlock],
      translationUnits: [draftTranslation],
    });

    const prodSectionJson = JSON.parse(
      await readFile(resolve(prodDir, "exports/v1/papers/brownian-motion/s4.json"), "utf8"),
    );
    // Under production profile, draft block is excluded
    expect(prodSectionJson.blocks.length).toBe(0);

    logOutcome("exports-profile-filtering", "passed", "Draft units handled correctly by profile.");
  });

  // 5. Safety Test: no executable functions or code keys
  it("verifies no export key holds executable code or private user data", () => {
    // Valid object
    expect(() => {
      assertExportSafety({
        schemaVersion: 1,
        title: "Test Safe Object",
        values: [1, 2, 3],
      });
    }).not.toThrow();

    // Planted function violation
    expect(() => {
      assertExportSafety({
        title: "Unsafe Object",
        action: () => "evil",
      });
    }).toThrow(ExportValidationError);

    // Planted user state violation
    expect(() => {
      assertExportSafety({
        title: "Leaked State",
        predictions: ["user guessed right"],
      });
    }).toThrow(ExportValidationError);

    logOutcome("exports-safety", "passed", "Verified absence of functions and private data.");
  });

  // 6. Source Text Escaping in Markdown
  it("escapes characters like < and * in source text and prevents rendered HTML", () => {
    const rawGerman = "Für Geschwindigkeiten v < c gilt *stets* der Impulssatz: <tag>test</tag>.";
    const escaped = escapeMarkdownSourceText(rawGerman);

    expect(escaped).toContain("\\<");
    expect(escaped).toContain("\\*");
    expect(escaped).toContain("\\<tag\\>test\\</tag\\>");
    expect(escaped.includes("<tag>")).toBe(false);

    // Test inside a complete section markdown generation
    const dummySection: SectionExport = {
      schemaVersion: 1,
      paperSlug: "special-relativity",
      sectionId: "s1",
      title: "Relativity & Motion",
      sentences: [
        {
          id: "sr-s1-p1-s1",
          german: rawGerman,
          english: "For velocities v < c the momentum law *always* holds: <tag>test</tag>.",
          sourceBlockId: "sr-s1-p1",
        },
      ],
      blocks: [],
      rights: {
        germanText: {
          layer: "german-text",
          status: "public-domain-text",
          statement: "Public Domain",
        },
      },
      contentRevision: "rev-test-esc",
    };

    const md = generateSectionMarkdown(dummySection);
    expect(md).toContain("\\< c");
    expect(md).toContain("\\*stets\\*");
    expect(md.includes("<tag>")).toBe(false);

    logOutcome(
      "exports-markdown-escaping",
      "passed",
      "Markdown text escaping verified without HTML.",
    );
  });

  // 7. Index SHA-256 and byte counts accuracy
  it("verifies index.json byte sizes and SHA-256 hashes match on-disk bytes exactly", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-hash-test-"));

    const index = await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision: "rev-hash-check",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          title: "Brownian Motion",
          sections: [{ id: "s4", title: "Section 4" }],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      equations: [
        {
          id: "eq-test",
          paper: "brownian-motion",
          title: "Test Eq",
          latexModern: "E = m c^2",
          spoken: "E equals m c squared",
          explanation: "Mass-energy equivalence",
          quantityIds: ["E", "m", "c"],
        },
      ],
    });

    for (const fileEntry of index.files) {
      const fullPath = resolve(tempRoot, "exports/v1", fileEntry.path);
      const bytes = await readFile(fullPath);
      const computedSha = sha256Hex(bytes);

      expect(bytes.length).toBe(fileEntry.bytes);
      expect(computedSha).toBe(fileEntry.sha256);
    }

    logOutcome(
      "exports-sha256-verification",
      "passed",
      "Every SHA-256 and byte count in index matched disk bytes.",
    );
  });

  // 8. TEI XML, JSON-LD, and Parallel Corpus Verification
  it("validates TEI P5 XML, JSON-LD, and TSV parallel corpus exports", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-extra-formats-"));

    await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision: "rev-extra-formats",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          title: "Brownian Motion",
          germanTitle: "Über die Bewegung...",
          sections: [{ id: "bm-sec-04", title: "Section 4" }],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
    });

    // 1. TEI XML check
    const teiPath = resolve(tempRoot, "exports/v1/tei/brownian-motion.xml");
    const teiContent = await readFile(teiPath, "utf8");
    expect(teiContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(teiContent).toContain('<TEI xmlns="http://www.tei-c.org/ns/1.0">');
    expect(teiContent).toContain("<teiHeader>");
    expect(teiContent).toContain('<text xml:lang="de">');
    expect(teiContent).toContain('<text xml:lang="en">');
    expect(teiContent).toContain("<s xml:id=");

    // 2. JSON-LD check
    const jsonldPath = resolve(tempRoot, "exports/v1/jsonld/brownian-motion.json");
    const jsonldParsed = JSON.parse(await readFile(jsonldPath, "utf8"));
    expect(jsonldParsed["@context"]).toBe("https://schema.org");
    expect(jsonldParsed["@type"]).toBe("ScholarlyArticle");
    expect(jsonldParsed.author["@type"]).toBe("Person");
    expect(jsonldParsed.author.name).toBe("A. Einstein");

    // 3. Parallel Corpus TSV check
    const tsvPath = resolve(tempRoot, "exports/v1/corpus/brownian-motion.tsv");
    const tsvContent = await readFile(tsvPath, "utf8");
    expect(tsvContent).toContain("# corpus: Annus Mirabilis Bilingual Parallel Corpus");
    expect(tsvContent).toContain("id\tgerman\tenglish");
    const lines = tsvContent.trim().split("\n");
    expect(lines.length).toBeGreaterThan(3);

    logOutcome(
      "exports-extra-formats",
      "passed",
      "TEI XML, JSON-LD, and Parallel Corpus verified.",
    );
  });

  // 9. Discovery Link Helpers
  it("generates correct discovery alternate link descriptors and HTML tags", () => {
    const paperLinks = getPaperExportLinks("brownian-motion");
    expect(paperLinks.length).toBe(4);
    const [p0] = paperLinks;
    expect(p0?.type).toBe("application/json");
    expect(p0?.href).toBe("/exports/v1/papers/brownian-motion.json");

    const sectionLinks = getSectionExportLinks("brownian-motion", "s4");
    expect(sectionLinks.length).toBe(2);
    const [s0, s1] = sectionLinks;
    expect(s0?.type).toBe("application/json");
    expect(s0?.href).toBe("/exports/v1/papers/brownian-motion/s4.json");
    expect(s1?.type).toBe("text/markdown");
    expect(s1?.href).toBe("/exports/v1/papers/brownian-motion/s4.md");

    const html = formatExportLinkHtml(sectionLinks);
    expect(html).toContain(
      '<link rel="alternate" type="application/json" href="/exports/v1/papers/brownian-motion/s4.json"',
    );
    expect(html).toContain(
      '<link rel="alternate" type="text/markdown" href="/exports/v1/papers/brownian-motion/s4.md"',
    );

    logOutcome("exports-discovery-links", "passed", "Discovery link helpers verified.");
  });

  // 10. Golden Section JSON and Markdown Comparison
  it("matches golden section JSON and Markdown byte-for-byte (am-cm-machine-readable-exports-xgy)", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-golden-comp-"));

    await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision: "golden-fixture-rev-1",
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          slug: "brownian-motion",
          title: FIXTURE_BROWNIAN_PAPER.titleEnglishWorking,
          germanTitle: FIXTURE_BROWNIAN_PAPER.titleGerman,
          authorLine: FIXTURE_BROWNIAN_PAPER.authorLine,
          bibKey: FIXTURE_BROWNIAN_PAPER.bibKey,
          dates: FIXTURE_BROWNIAN_PAPER.dates,
          journal: FIXTURE_BROWNIAN_PAPER.journal,
          sections: [
            { id: "bm-sec-04", title: "§ 4. On the Irregular Motion of Suspended Particles" },
          ],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS.filter((b) => b.section === "bm-sec-04"),
      translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignments: [FIXTURE_BROWNIAN_ALIGNMENT],
      // EditorialNote has no `section`; it addresses blocks by affectedIds. Select the
      // notes that actually touch a block in this section rather than a field that
      // does not exist on the record.
      editorialNotes: FIXTURE_EDITORIAL_NOTES.filter((n) =>
        n.affectedIds.some((id) =>
          FIXTURE_BROWNIAN_SOURCE_BLOCKS.some((b) => b.section === "bm-sec-04" && b.id === id),
        ),
      ),
    });

    const producedJson = await readFile(
      resolve(tempRoot, "exports/v1/papers/brownian-motion/bm-sec-04.json"),
      "utf8",
    );
    const goldenJson = await readFile(
      resolve(
        process.cwd(),
        "src/content/exports/__fixtures__/golden/section-bm-sec-04.golden.json",
      ),
      "utf8",
    );
    expect(producedJson).toBe(goldenJson);

    const producedMd = await readFile(
      resolve(tempRoot, "exports/v1/papers/brownian-motion/bm-sec-04.md"),
      "utf8",
    );
    const goldenMd = await readFile(
      resolve(process.cwd(), "src/content/exports/__fixtures__/golden/section-bm-sec-04.golden.md"),
      "utf8",
    );
    expect(producedMd).toBe(goldenMd);

    logOutcome(
      "exports-golden-comparison",
      "passed",
      "Section JSON and Markdown matched golden references byte-for-byte.",
    );
  });

  // 11. Governance & Un-Ratified Delegated Decision Rights Marker
  it("fails schema validation if a layer governed by an un-ratified decision lacks the delegated status marker", () => {
    // Valid section with un-ratified delegated decision marker passes
    const validSection: SectionExport = {
      schemaVersion: 1,
      paperSlug: "brownian-motion",
      sectionId: "s1",
      title: "Section 1",
      sentences: [],
      blocks: [],
      rights: {
        translation: {
          layer: "translation",
          status: "site-original-prose",
          statement: "English translation",
          license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
          decisionRef: "D-2026-09-16-license-and-rider",
          ratificationStatus: "delegated-not-owner-ratified",
        },
      },
      contentRevision: "rev-1",
    };
    expect(() => validateExportRecord("section", validSection)).not.toThrow();

    // Planted violation 1: Missing decisionRef
    const missingDecisionRef: SectionExport = {
      ...validSection,
      rights: {
        translation: {
          layer: "translation",
          status: "site-original-prose",
          statement: "English translation flatly claiming MIT",
          license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
          ratificationStatus: "delegated-not-owner-ratified",
        },
      },
    };
    expect(() => validateExportRecord("section", missingDecisionRef)).toThrow(
      ExportValidationError,
    );

    // Planted violation 2: Missing or incorrect ratificationStatus (claiming owner-ratified when it is un-ratified)
    const incorrectRatificationStatus: SectionExport = {
      ...validSection,
      rights: {
        translation: {
          layer: "translation",
          status: "site-original-prose",
          statement: "English translation falsely claiming owner ratification",
          license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
          decisionRef: "D-2026-09-16-license-and-rider",
          ratificationStatus: "owner-ratified",
        },
      },
    };
    expect(() => validateExportRecord("section", incorrectRatificationStatus)).toThrow(
      ExportValidationError,
    );

    logOutcome(
      "exports-delegated-rights-marker",
      "passed",
      "Schema validation rejects exports lacking explicit delegated-not-owner-ratified governance markers.",
    );
  });

  // 12. RH-3 Protection: Invariants Derived Directly From Source Records (AC 1, AC 4)
  it("verifies emitted files satisfy semantic invariants derived directly from source records (RH-3)", async () => {
    const tempBase = process.env.AM_TEST_TMP ?? tmpdir();
    const tempRoot = await mkdtemp(resolve(tempBase, "am-rh3-source-"));
    const contentRevision = "rev-rh3-source-1234";

    const index = await emitMachineReadableExports({
      rootDir: tempRoot,
      contentRevision,
      releaseProfile: "preview",
      papers: [
        {
          id: "brownian-motion",
          slug: "brownian-motion",
          title: FIXTURE_BROWNIAN_PAPER.titleEnglishWorking,
          germanTitle: FIXTURE_BROWNIAN_PAPER.titleGerman,
          authorLine: FIXTURE_BROWNIAN_PAPER.authorLine,
          bibKey: FIXTURE_BROWNIAN_PAPER.bibKey,
          dates: FIXTURE_BROWNIAN_PAPER.dates,
          journal: FIXTURE_BROWNIAN_PAPER.journal,
          sections: [
            {
              id: "bm-sec-04",
              title: "§ 4. On the Irregular Motion of Suspended Particles",
            },
          ],
        },
      ],
      sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS.filter((b) => b.section === "bm-sec-04"),
      translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignments: [FIXTURE_BROWNIAN_ALIGNMENT],
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      equations: [
        {
          id: "eq-bm-01",
          paper: "brownian-motion",
          section: "bm-sec-04",
          title: "Diffusion Coefficient (Stokes-Einstein)",
          latexModern: "D = \\frac{R T}{6 \\pi k N}",
          spoken: "D equals R times T over six pi k N",
          explanation: "Stokes-Einstein relation for the diffusion coefficient.",
          quantityIds: ["diffusionCoefficient", "temperature", "gasConstant"],
        },
      ],
      arguments: [
        {
          id: "arg-bm-01",
          paper: "brownian-motion",
          section: "bm-sec-04",
          title: "Osmotic Equilibrium and Irregular Motion",
          question: "How does osmotic pressure balance particle motion?",
          recap: "Particles undergo random thermal motion balanced by viscous drag.",
          premises: ["Dynamic equilibrium in a stationary liquid."],
          limitations: ["Valid only for spherical particles much larger than liquid molecules."],
          meaning: {
            logicalRole: "derivation",
            historicalStatus: "pedagogical-reconstruction",
            modelStatus: "exact-within-model",
            executionStatus: "static-illustration",
          },
        },
      ],
      experiments: [
        {
          id: "bm-01",
          paper: "brownian-motion",
          title: "Stokes-Einstein Diffusion Instrument",
          kind: "simulation",
          parameters: [
            {
              id: "temperature",
              name: "Temperature",
              unit: "K",
              default: 293.15,
              min: 270,
              max: 370,
            },
          ],
        },
      ],
    });

    // 1. Every on-disk JSON file has schemaVersion: 1 (for Annus Mirabilis schemas), matching contentRevision, and non-empty rights
    for (const fileEntry of index.files) {
      if (fileEntry.format === "json") {
        const fullPath = resolve(tempRoot, "exports/v1", fileEntry.path);
        const parsed = JSON.parse(await readFile(fullPath, "utf8"));
        if (!fileEntry.path.startsWith("jsonld/")) {
          expect(parsed.schemaVersion).toBe(1);
          expect(parsed.contentRevision).toBe(contentRevision);
        } else {
          expect(parsed["@context"]).toBe("https://schema.org");
          expect(parsed["@type"]).toBe("ScholarlyArticle");
        }
        if (fileEntry.path !== "index.json" && !fileEntry.path.startsWith("jsonld/")) {
          expect(parsed.rights).toBeDefined();
          expect(Object.keys(parsed.rights).length).toBeGreaterThan(0);
        }
      }
    }

    // 2. Paper export values derived from SOURCE input
    const paperJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/papers/brownian-motion.json"), "utf8"),
    );
    expect(paperJson.titleEnglishWorking).toBe(FIXTURE_BROWNIAN_PAPER.titleEnglishWorking);
    expect(paperJson.titleGerman).toBe(FIXTURE_BROWNIAN_PAPER.titleGerman);
    expect(paperJson.authorLine).toBe(FIXTURE_BROWNIAN_PAPER.authorLine);
    expect(paperJson.bibKey).toBe(FIXTURE_BROWNIAN_PAPER.bibKey);
    expect(paperJson.journal?.name).toBe(FIXTURE_BROWNIAN_PAPER.journal?.name);

    // 3. Section export values derived from SOURCE blocks and translation units
    const sectionJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/papers/brownian-motion/bm-sec-04.json"), "utf8"),
    );
    expect(sectionJson.paperSlug).toBe("brownian-motion");
    expect(sectionJson.sectionId).toBe("bm-sec-04");
    expect(sectionJson.sentences.length).toBeGreaterThan(0);
    for (const sentence of sectionJson.sentences) {
      const matchingTu = FIXTURE_BROWNIAN_TRANSLATION_UNITS.find((tu) =>
        tu.sourceRefs.some((sr) => sr.id === sentence.id || sr.id === sentence.sourceBlockId),
      );
      expect(matchingTu).toBeDefined();
    }

    // 4. Equation export values derived from SOURCE equation
    const eqJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/equations/eq-bm-01.json"), "utf8"),
    );
    expect(eqJson.latexModern).toBe("D = \\frac{R T}{6 \\pi k N}");
    expect(eqJson.spoken).toBe("D equals R times T over six pi k N");
    expect(eqJson.quantityIds).toEqual(["diffusionCoefficient", "temperature", "gasConstant"]);

    // 5. Argument export values derived from SOURCE argument
    const argJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/arguments/arg-bm-01.json"), "utf8"),
    );
    expect(argJson.question).toBe("How does osmotic pressure balance particle motion?");
    expect(argJson.premises).toEqual(["Dynamic equilibrium in a stationary liquid."]);
    expect(argJson.meaning.logicalRole).toBe("derivation");

    // 6. Experiment export values derived from SOURCE experiment (and zero executable code)
    const expJson = JSON.parse(
      await readFile(resolve(tempRoot, "exports/v1/experiments/bm-01.json"), "utf8"),
    );
    expect(expJson.title).toBe("Stokes-Einstein Diffusion Instrument");
    expect(expJson.parameters[0].unit).toBe("K");

    logOutcome(
      "exports-rh3-source-invariants",
      "passed",
      "All emitted files verified against source records without reading from output artifacts.",
    );
  });

  // 13. Paper & Section Metadata Discovery Links (AC 7)
  it("paperMetadata includes alternate link types for paper and section discovery (AC 7)", async () => {
    // Paper route metadata
    const paperMeta = await paperMetadata({ paperId: "brownian-motion" });
    expect(paperMeta.alternates?.types).toBeDefined();
    const paperTypes = paperMeta.alternates?.types as Record<string, string>;
    expect(paperTypes["application/json"]).toBe("/exports/v1/papers/brownian-motion.json");
    expect(paperTypes["application/ld+json"]).toBe("/exports/v1/jsonld/brownian-motion.json");
    expect(paperTypes["application/tei+xml"]).toBe("/exports/v1/tei/brownian-motion.xml");
    expect(paperTypes["text/tab-separated-values"]).toBe("/exports/v1/corpus/brownian-motion.tsv");

    // Section route metadata
    const sectionMeta = await paperMetadata({ paperId: "brownian-motion", section: "s4" });
    expect(sectionMeta.alternates?.types).toBeDefined();
    const sectionTypes = sectionMeta.alternates?.types as Record<string, string>;
    expect(sectionTypes["application/json"]).toBe("/exports/v1/papers/brownian-motion/s4.json");
    expect(sectionTypes["text/markdown"]).toBe("/exports/v1/papers/brownian-motion/s4.md");

    logOutcome(
      "exports-metadata-discovery",
      "passed",
      "Paper and section routes provide rel=alternate export types in metadata.",
    );
  });

  // 14. Documentation Contract Verification (AC 6)
  it("docs/EXPORTS.md documents all required export endpoints, stability guarantees, and rights model (AC 6)", async () => {
    const docPath = resolve(process.cwd(), "docs/EXPORTS.md");
    const docContent = await readFile(docPath, "utf8");

    // Documented endpoints
    expect(docContent).toContain("/exports/v1/index.json");
    expect(docContent).toContain("/exports/v1/papers/<slug>.json");
    expect(docContent).toContain("/exports/v1/papers/<slug>/<section>.json");
    expect(docContent).toContain("/exports/v1/papers/<slug>/<section>.md");
    expect(docContent).toContain("/exports/v1/equations/<id>.json");
    expect(docContent).toContain("/exports/v1/arguments/<id>.json");
    expect(docContent).toContain("/exports/v1/experiments/<id>.json");
    expect(docContent).toContain("/exports/v1/tei/<slug>.xml");
    expect(docContent).toContain("/exports/v1/jsonld/<slug>.json");
    expect(docContent).toContain("/exports/v1/corpus/<slug>.tsv");

    // Stability guarantees
    expect(docContent).toContain("Stability Guarantees");
    expect(docContent).toContain("Versioned Namespace");
    expect(docContent).toContain("Additive Evolution");
    expect(docContent).toContain("Byte Determinism");

    // Rights model
    expect(docContent).toContain("Rights & Licensing Model");
    expect(docContent).toContain("Historical German Text");
    expect(docContent).toContain("English Translations");

    logOutcome(
      "exports-documentation-contract",
      "passed",
      "docs/EXPORTS.md verified for complete endpoint and stability contract coverage.",
    );
  });
});
