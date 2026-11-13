/**
 * Search must reach the papers' closing passages, not only commentary about them.
 * Plan 16.1 names Besso's acknowledgment as a source-search destination
 * (am-plat-search-index-snx1).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSearchCorpus } from "../../scripts/build-search-index.ts";
import { parseYaml } from "../content/provenance/yaml.ts";
import { type SourceBlock, validateSourceBlock } from "../content/schemas/source.ts";
import { loadBilingualEdition } from "../reader/faces/bilingualLoader.ts";
import { PaperPage } from "../reader/PaperPage.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { createSearchEngine, type SearchDocument, searchResultHref } from "./core.ts";
import {
  englishTranslationDocuments,
  germanSourceDocuments,
  germanSourcePlain,
  searchInlineText,
} from "./documents.ts";

const paper = { id: "special-relativity", title: "Special relativity" };
const closingLabels = [
  ["closing-ack", "Acknowledgment"],
  ["closing-dateline", "Date-line"],
  ["closing-received", "Date received"],
] as const;

describe("closing source search projections", () => {
  test("edition and ledger closings keep their names and exact source anchors", () => {
    for (const [id, title] of closingLabels) {
      for (const kind of ["closing", id]) {
        const documents = germanSourceDocuments(
          paper,
          { label: "Edition", blocks: [{ id, kind, text: "A closing passage." }] },
          "scaffold",
        );
        expect(documents).toHaveLength(1);
        expect(documents[0]?.title).toBe(title);
        expect(documents[0]?.anchor).toBe(id);
        expect(documents[0]?.section).toBe("");
        expect(documents[0]?.type).toBe("sentence-de");
      }
    }
  });

  test("English closings retain the translated unit's exact anchor", () => {
    const documents = englishTranslationDocuments(
      paper,
      {
        label: "English translation",
        paragraphs: [
          {
            key: "closing-ack",
            kind: "closing",
            section: "",
            anchor: "closing-ack-en",
            text: "A translated acknowledgment.",
          },
        ],
      },
      "scaffold",
    );
    expect(documents).toHaveLength(1);
    expect(documents[0]?.title).toBe("Acknowledgment");
    expect(documents[0]?.anchor).toBe("closing-ack-en");
    expect(documents[0]?.section).toBe("");
    expect(documents[0]?.type).toBe("sentence-en");
  });

  test("adding closings does not admit mastheads or duplicate displayed-equation documents", () => {
    const documents = germanSourceDocuments(
      paper,
      {
        label: "Edition",
        blocks: [
          { id: "closing-ack", kind: "closing", text: "Acknowledgment." },
          { id: "masthead-author", kind: "masthead", text: "Author line." },
          { id: "eq-s1-d1", kind: "equation", text: "An indexed display has its own explanation." },
        ],
      },
      "scaffold",
    );
    expect(documents.map((document) => document.anchor)).toEqual(["closing-ack"]);
  });

  test("closing text obeys the existing publication profile", () => {
    for (const profile of ["preview", "launch"] as const) {
      expect(
        germanSourceDocuments(
          paper,
          { label: "Edition", blocks: [{ id: "closing-ack", kind: "closing", text: "Besso" }] },
          profile,
        ),
      ).toEqual([]);
      expect(
        englishTranslationDocuments(
          paper,
          {
            label: "English translation",
            paragraphs: [
              {
                key: "closing-ack",
                kind: "closing",
                section: "",
                anchor: "closing-ack",
                text: "Besso",
              },
            ],
          },
          profile,
        ),
      ).toEqual([]);
    }
  });
});

const { documents, aliases } = await loadSearchCorpus(process.cwd(), "scaffold");
const engine = createSearchEngine(documents, aliases);
const papers = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/** Read the source records, not the projection whose omissions this test must detect. */
function closingRecords(paperId: string): readonly SourceBlock[] {
  const directory = join(process.cwd(), "content/source-blocks", paperId);
  return readdirSync(directory)
    .filter((file) => /\.(?:json|ya?ml)$/u.test(file))
    .flatMap((file) => {
      const text = readFileSync(join(directory, file), "utf8");
      const raw: unknown = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        !("kind" in raw) ||
        raw.kind !== "closing"
      )
        return [];
      return [validateSourceBlock(raw, file)];
    });
}

function languageDocuments(paperId: string, face: "german" | "english"): readonly SearchDocument[] {
  const type = face === "german" ? "sentence-de" : "sentence-en";
  return documents.filter((document) => document.paper === paperId && document.type === type);
}

for (const paperId of papers) {
  test(`${paperId}: each closing is searchable in both language faces`, async () => {
    const closings = closingRecords(paperId);
    expect(closings.length).toBeGreaterThan(0);
    const edition = await loadBilingualEdition(paperId);
    expect(edition).not.toBeNull();
    for (const face of ["german", "english"] as const) {
      const indexed = languageDocuments(paperId, face);
      const html = await exportMarkup(await PaperPage({ paperId, face }));
      const anchors = new Set([...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]));
      for (const closing of closings) {
        const matches = indexed.filter(
          (document) => document.id === `${face}:${paperId}:${closing.id}`,
        );
        expect(matches).toHaveLength(1);
        const document = matches[0];
        expect(anchors.has(document?.anchor ?? "")).toBe(true);
        if (face === "german") {
          expect(document?.anchor).toBe(closing.id);
          expect(document?.text).toBe(germanSourcePlain(searchInlineText(closing.inlines)));
        } else {
          const units =
            edition?.units.filter((unit) =>
              unit.sourceRefs.some(
                (reference) => reference.paper === paperId && reference.id === closing.id,
              ),
            ) ?? [];
          expect(units.length).toBeGreaterThan(0);
          expect(document?.anchor).toBe(units[0]?.id);
          for (const unit of units)
            expect(document?.text).toContain(germanSourcePlain(searchInlineText(unit.inlines)));
        }
      }
    }
  });
}

for (const [face, type] of [
  ["german", "sentence-de"],
  ["english", "sentence-en"],
] as const) {
  test(`Besso reaches the ${face} acknowledgment itself`, () => {
    const matches = engine.search("Besso", { paper: "special-relativity", type });
    const acknowledgment = matches.find(
      (hit) => hit.document.id === `${face}:special-relativity:closing-ack`,
    );
    expect(acknowledgment).toBeDefined();
    expect(acknowledgment?.document.text).toContain("Besso");
    if (acknowledgment)
      expect(searchResultHref(acknowledgment.document)).toBe(
        `/papers/special-relativity/view/${face}/#closing-ack`,
      );
  });
}
