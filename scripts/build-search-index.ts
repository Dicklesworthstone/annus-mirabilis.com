import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContentIndex, loadFoundationPayload, loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { expressionLatex } from "../src/equations/latex.ts";
import { BROWNIAN_QUANTITIES } from "../src/equations/quantities.ts";
import { CATALOGUE_IDS, CATALOGUE_QUESTIONS, CATALOGUE_STATUS, catalogueLabel } from "../src/experiments/catalogue.ts";
import { packageSearchIndex } from "../src/search/build.ts";
import { aliasesForDocuments, assertSearchCoverage, documentsFromCompiled, searchProfile } from "../src/search/documents.ts";

/** Compiled, digest-checked projections only. Never scrape raw YAML or build a second corpus. */
export async function buildSearchIndex(root = process.cwd(), profileValue = process.env.AM_RELEASE_PROFILE) {
  const profile = searchProfile(profileValue);
  const index = await loadContentIndex(root);
  assertSearchCoverage(index.payloads.map((entry) => entry.kind));
  const papers = await Promise.all(index.payloads.filter((entry) => entry.kind === "paper")
    .map((entry) => loadPaperPayload(entry.id, root)));
  const foundations = await Promise.all(index.payloads.filter((entry) => entry.kind === "foundation")
    .map((entry) => loadFoundationPayload(entry.id, root)));
  const instruments = CATALOGUE_IDS.map((id) => ({
    id, status: CATALOGUE_STATUS[id], title: catalogueLabel(id),
    ...(CATALOGUE_QUESTIONS[id] ? { question: CATALOGUE_QUESTIONS[id] } : {}),
  }));
  const equationTerms = Object.fromEntries(papers.flatMap((paper) => paper.equations.map((equation) =>
    [equation.id, expressionLatex(equation.tree, BROWNIAN_QUANTITIES)])));
  const documents = documentsFromCompiled(papers, foundations, instruments, profile, equationTerms);
  const bundle = packageSearchIndex(documents, aliasesForDocuments(documents), index.buildDigest, profile);
  const directory = resolve(root, "generated/search");
  await mkdir(directory, { recursive: true });
  for (const file of bundle.files) {
    const path = resolve(directory, file.descriptor.path.slice("/search/".length));
    try {
      await writeFile(path, file.text, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await readFile(path, "utf8") !== file.text)
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
  console.log(JSON.stringify({ event: "search-index-built", profile: manifest.profile,
    documents: manifest.totalDocuments, shards: manifest.shards.length, buildDigest: manifest.buildDigest }));
}
