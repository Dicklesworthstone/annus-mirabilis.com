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
import { paperSourceFaces } from "../src/reader/paperSourceFaces.ts";
import { packageSearchIndex } from "../src/search/build.ts";
import type { SearchAlias, SearchDocument } from "../src/search/core.ts";
import {
  aliasesForDocuments,
  assertSearchCoverage,
  documentsFromCompiled,
  germanSourceDocuments,
  notationAliases,
  notationDocuments,
  type SearchProfile,
  searchProfile,
} from "../src/search/documents.ts";

/**
 * Everything the index holds, as the build publishes it. Compiled, digest-checked projections for
 * the papers, lessons and instruments. Two sources the content index does not compile come from
 * the pages that render them, so a hit says what its page shows: the notation concordance through
 * the /notation/ page's own data (loadNotationPageData), and the German passages through the
 * German face's own loader (loadGermanSourceFace). Never scrape raw YAML or build a second corpus.
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
  // The German a reader can open: only where the paper's German face renders the drafted ledger,
  // decided by the same rule the reader uses (paperSourceFaces), so no hit names a page that shows
  // a notice instead of text, or a block id a compiled edition would not have.
  const german: SearchDocument[] = [];
  for (const { paper } of papers) {
    const sources = await paperSourceFaces(paper.id);
    if (!sources.germanIsDraft || sources.availability.german !== "available") continue;
    const face = loadGermanSourceFace(paper.id as RouteSlug, root);
    if (face)
      german.push(
        ...germanSourceDocuments(paper, { label: face.notice.label, blocks: face.blocks }, profile),
      );
  }
  const documents = [
    ...documentsFromCompiled(papers, foundations, instruments, profile, equationTerms),
    ...notation,
    ...german,
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
