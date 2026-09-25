import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNotationPageData } from "../src/app/notation/notationData.ts";
import {
  loadContentIndex,
  loadFoundationPayload,
  loadPaperPayload,
} from "../src/content/compiler/serverLoaders.ts";
import { loadGermanSourceFace } from "../src/content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../src/content/ids.ts";
import { recordLatex } from "../src/equations/recordLatex.ts";
import {
  CATALOGUE_IDS,
  CATALOGUE_QUESTIONS,
  CATALOGUE_STATUS,
  catalogueLabel,
} from "../src/experiments/catalogue.ts";
import { editionBlocksReviewed, germanFaceRendersEdition } from "../src/reader/faceAvailability.ts";
import { loadBilingualEdition } from "../src/reader/faces/bilingualLoader.ts";
import { editionGermanNotice } from "../src/reader/faces/editionCoverage.ts";
import { FACE_IDS, FACE_REGISTRY } from "../src/reader/faces/registry.ts";
import { translationReviewSummary } from "../src/reader/faces/reviewState.ts";
import { groupTranslationUnits } from "../src/reader/faces/TranslationParagraphs.tsx";
import {
  MASTHEAD_AUTHOR_ID,
  MASTHEAD_TITLE_ID,
  unitTranslating,
} from "../src/reader/faces/translationMasthead.ts";
import { paperSourceFaces } from "../src/reader/paperSourceFaces.ts";
import { packageSearchIndex } from "../src/search/build.ts";
import type { SearchAlias, SearchDocument } from "../src/search/core.ts";
import {
  aliasesForDocuments,
  assertSearchCoverage,
  assertSearchFaceCoverage,
  documentsFromCompiled,
  englishTranslationDocuments,
  germanSourceDocuments,
  notationAliases,
  notationDocuments,
  type SearchEnglishParagraph,
  type SearchProfile,
  searchInlineText,
  searchProfile,
} from "../src/search/documents.ts";

/**
 * Everything the index holds, as the build publishes it. Compiled, digest-checked projections for
 * the papers, lessons and instruments. Two sources the content index does not compile come from
 * the pages that render them, so a hit says what its page shows: the notation concordance through
 * the /notation/ page's own data (loadNotationPageData), the German passages through the German
 * face's own loader (loadGermanSourceFace, or the edition that face renders when a paper has no
 * drafted ledger), and the English through the English face's loader and grouping
 * (loadBilingualEdition, groupTranslationUnits). Never scrape raw YAML or build a second corpus.
 */
export async function loadSearchCorpus(
  root: string,
  profile: SearchProfile,
): Promise<{
  documents: readonly SearchDocument[];
  aliases: readonly SearchAlias[];
  buildDigest: string;
}> {
  const index = await loadContentIndex(root);
  assertSearchCoverage(index.payloads.map((entry) => entry.kind));
  assertSearchFaceCoverage(FACE_IDS.filter((id) => FACE_REGISTRY[id].isLanguageFace));
  const papers = await Promise.all(
    index.payloads
      .filter((entry) => entry.kind === "paper")
      .map((entry) => loadPaperPayload(entry.id, root)),
  );
  const foundations = await Promise.all(
    index.payloads
      .filter((entry) => entry.kind === "foundation")
      .map((entry) => loadFoundationPayload(entry.id, root)),
  );
  const instruments = CATALOGUE_IDS.map((id) => ({
    id,
    status: CATALOGUE_STATUS[id],
    title: catalogueLabel(id),
    ...(CATALOGUE_QUESTIONS[id] ? { question: CATALOGUE_QUESTIONS[id] } : {}),
  }));
  const equationTerms = Object.fromEntries(
    papers.flatMap((paper) =>
      paper.equations.map((equation) => [equation.id, recordLatex(equation) ?? ""]),
    ),
  );
  const glyphs = loadNotationPageData().uniqueGlyphs;
  const notation = notationDocuments(glyphs, profile);
  // The German a reader can open, decided by the same rule the reader uses (paperSourceFaces,
  // faceAvailability), so no hit names a page that shows a notice instead of text, or an id the
  // face does not render: the drafted ledger where the German face shows it, else the edition's
  // blocks where the face renders those. Special relativity has no drafted ledger, and until
  // dispatch 214 none of its German was indexed.
  const german: SearchDocument[] = [];
  // The English a reader can open: the English face's units, grouped as that face sets them.
  const english: SearchDocument[] = [];
  for (const { paper } of papers) {
    const sources = await paperSourceFaces(paper.id);
    const edition = await loadBilingualEdition(paper.id, root).catch(() => null);
    const blocks = edition?.blocks ?? [];
    if (sources.availability.german === "available") {
      const draft = editionBlocksReviewed(blocks)
        ? null
        : loadGermanSourceFace(paper.id as RouteSlug, root);
      if (germanFaceRendersEdition(blocks, draft?.blocks.length ?? 0)) {
        const label = editionGermanNotice(blocks)?.label ?? "Edition";
        const faceBlocks = blocks.map((b) => ({
          id: b.id,
          kind: b.kind,
          text: searchInlineText(b.inlines),
        }));
        german.push(...germanSourceDocuments(paper, { label, blocks: faceBlocks }, profile));
      } else if (draft && sources.germanIsDraft) {
        german.push(
          ...germanSourceDocuments(
            paper,
            { label: draft.notice.label, blocks: draft.blocks },
            profile,
          ),
        );
      }
    }
    if (sources.availability.english === "available" && edition) {
      // The masthead's units head the English face rather than opening its body (EnglishFace).
      const title = unitTranslating(edition.units, MASTHEAD_TITLE_ID);
      const author = unitTranslating(edition.units, MASTHEAD_AUTHOR_ID);
      const body = edition.units.filter((u) => u !== title && u !== author);
      const blockById = new Map(blocks.map((b) => [b.id, b]));
      const paragraphs = new Map<
        string,
        { -readonly [K in keyof SearchEnglishParagraph]: SearchEnglishParagraph[K] }
      >();
      for (const group of groupTranslationUnits(body, edition.alignment, blocks)) {
        const block = blockById.get(group.key);
        const kind =
          group.kind === "paragraph" || group.kind === "footnote"
            ? group.kind
            : block?.kind === "heading"
              ? "heading"
              : null;
        const first = group.units[0];
        if (kind === null || first === undefined) continue;
        const text = group.units.map((u) => searchInlineText(u.inlines)).join(" ");
        const seen = paragraphs.get(group.key);
        if (seen) seen.text = `${seen.text} ${text}`;
        else
          paragraphs.set(group.key, {
            key: group.key,
            kind,
            section: block?.section ?? /^(s\d+)/u.exec(group.key)?.[1] ?? "",
            anchor: first.id,
            text,
          });
      }
      // "Translated and checked by AI agents" continues the label, so only its first letter drops.
      const review = translationReviewSummary(edition.units, edition.reviewRecords).title;
      english.push(
        ...englishTranslationDocuments(
          paper,
          {
            label: `${FACE_REGISTRY.english.label}, ${review.charAt(0).toLowerCase()}${review.slice(1)}`,
            paragraphs: [...paragraphs.values()],
          },
          profile,
        ),
      );
    }
  }
  const documents = [
    ...documentsFromCompiled(papers, foundations, instruments, profile, equationTerms),
    ...notation,
    ...german,
    ...english,
  ];
  return {
    documents,
    aliases: [...aliasesForDocuments(documents), ...notationAliases(glyphs, documents)],
    buildDigest: index.buildDigest,
  };
}

/** Writes the content-addressed shards and their manifest into generated/search. */
export async function buildSearchIndex(
  root = process.cwd(),
  profileValue = process.env.AM_RELEASE_PROFILE,
) {
  const profile = searchProfile(profileValue);
  const { documents, aliases, buildDigest } = await loadSearchCorpus(root, profile);
  const bundle = packageSearchIndex(documents, aliases, buildDigest, profile);
  const directory = resolve(root, "generated/search");
  await mkdir(directory, { recursive: true });
  for (const file of bundle.files) {
    const path = resolve(directory, file.descriptor.path.slice("/search/".length));
    try {
      await writeFile(path, file.text, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if ((await readFile(path, "utf8")) !== file.text)
        throw new Error("An existing content-addressed search shard has different bytes.");
    }
  }
  // Publish only after every shard exists. Older shards remain outside public/ and cannot
  // be exported or served unless this manifest enumerates them. No cleanup deletes files.
  await writeFile(resolve(directory, "index-manifest.json"), bundle.manifestText);
  return bundle.manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildSearchIndex();
  console.log(
    JSON.stringify({
      event: "search-index-built",
      profile: manifest.profile,
      documents: manifest.totalDocuments,
      shards: manifest.shards.length,
      buildDigest: manifest.buildDigest,
    }),
  );
}
