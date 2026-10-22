import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNotationPageData } from "../src/app/notation/notationData.ts";
import {
  loadContentIndex,
  loadFoundationPayload,
  loadPaperPayload,
} from "../src/content/compiler/serverLoaders.ts";
import { loadConnections } from "../src/content/connections/connections.ts";
import { loadGermanSourceFace } from "../src/content/editions/germanSourceFace.ts";
import type { RouteSlug } from "../src/content/ids.ts";
import { loadTeachingTapes } from "../src/content/teachingTapes.ts";
import { requireTour, tourIds } from "../src/content/tours/tours.ts";
import { capstoneExists, loadCapstone } from "../src/discovery/capstone/loadCapstone.ts";
import { ROUTE_INDEX } from "../src/discovery/routeIndex.ts";
import { GUIDED_TOURS } from "../src/discovery/tours/catalogue.ts";
import {
  equationCatalogue,
  equationLocator,
  marginNoteLocator,
  sectionShortLabel,
} from "../src/equations/printed/catalogue.ts";
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
import { loadPaperMargins } from "../src/reader/marginRecords.ts";
import { parseWhatIsTrue } from "../src/reader/misconceptions/types.ts";
import { paperSourceFaces } from "../src/reader/paperSourceFaces.ts";
import { tapePath } from "../src/reader/sitePaths.ts";
import { packageSearchIndex } from "../src/search/build.ts";
import type { SearchAlias, SearchDocument } from "../src/search/core.ts";
import {
  aliasesForDocuments,
  assertSearchCoverage,
  assertSearchFaceCoverage,
  capstoneDocuments,
  connectionDocuments,
  discoveryDocuments,
  documentsFromCompiled,
  englishTranslationDocuments,
  explainedEquationDocuments,
  germanSourceDocuments,
  marginNoteDocuments,
  notationAliases,
  notationDocuments,
  type SearchCapstone,
  type SearchConnectionThread,
  type SearchEnglishParagraph,
  type SearchExplainedEquation,
  type SearchMarginNote,
  type SearchProfile,
  type SearchWrongTurn,
  searchInlineText,
  searchProfile,
  tourDocuments,
  walkthroughDocuments,
  wrongTurnDocuments,
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
  // The recorded walkthroughs, from the loader the /tapes/ pages use rather than a second read of
  // the YAML (this file's own rule, above). Each carries the passages its instrument declares, so a
  // reader searching for the SECTION finds the walkthrough that works it.
  const walkthroughs = loadTeachingTapes(root).tapes.map((tape) => ({
    id: tape.tapeId,
    title: tape.title,
    description: tape.description ?? "",
    route: tapePath(tape.tapeId),
    paper: tape.passages[0]?.paper ?? "",
    paperTitle: tape.passages[0]?.paperTitle ?? "",
    instrumentId: tape.instrument?.id ?? tape.experimentId,
    sectionTitles: tape.passages.map((passage) => passage.sectionTitle),
  }));
  // BOTH tour sources, merged here rather than in the builder, because /tours/ renders both and
  // indexing one would cover four of the five paths a reader can see: the YAML records through
  // tourIds/requireTour, and the GUIDED_TOURS catalogue in code.
  const guidedTours = [
    ...tourIds(root).flatMap((id) => {
      const tour = requireTour(root, id);
      return tour
        ? [
            {
              id: tour.id,
              title: tour.title,
              paper: tour.paper,
              introduction: tour.introduction,
              stopTitles: tour.steps.map((step) => step.title),
            },
          ]
        : [];
    }),
    ...GUIDED_TOURS.map((tour) => ({
      id: tour.id,
      title: tour.title,
      paper: tour.paper,
      introduction: tour.introduction,
      stopTitles: tour.stops.map((stop) => stop.title),
    })),
  ];
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
  /*
   * THE PRINTED DISPLAYS, EACH FOUND BY WHAT IT SAYS (am-9p8v). Measured on the index this
   * replaces: 0 of 998 documents routed under /equations/, so none of the 200 authored sentences
   * that say what a printed equation claims was searchable, and neither was the page that explains
   * it. The locator is derived from the paper's OWN section titles, which is why this is built here
   * rather than in documents.ts: `papers` holds the compiled records.
   */
  const explainedEquations: SearchExplainedEquation[] = [];
  /*
   * Driven by the COMPILED papers rather than by the catalogue's own list, so the two populations
   * cannot disagree at build time: a paper with no explanations contributes no rows, and a paper
   * the catalogue knows and the content index does not cannot exist here. That second direction is
   * a build-time constant on both sides, so it is asserted once in catalogue.test.ts rather than
   * re-checked on every build with a refusal nothing can reach.
   */
  /*
   * THE WRONG TURNS AND THE CAPSTONES (am-9p8v follow-up). Measured on the index of 2026-10-22:
   * `misconception` and `capstone` were two of eight declared search types with ZERO documents,
   * each with a heading already written in TYPE_LABELS and a route family already allowed by the
   * validator, and each with real reader-facing records behind it. Builders that were never
   * written, not content that is absent.
   */
  const wrongTurns: SearchWrongTurn[] = [];
  const capstones: SearchCapstone[] = [];
  const marginNotes: SearchMarginNote[] = [];
  // The five connections among the papers, which belong to no single paper and so are built
  // outside the per-paper loop.
  const connections: SearchConnectionThread[] = loadConnections().map((connection) => ({
    id: connection.id,
    what: connection.what,
    label: connection.label,
    papers: connection.papers,
    text: [connection.what, connection.uses?.text].filter(Boolean).join(" "),
  }));
  for (const { paper } of papers) {
    const margins = loadPaperMargins(paper.id);
    const sectionLabels = new Map(paper.sections.map((s) => [s.id, sectionShortLabel(s.title)]));
    const hasSections = paper.sections.length > 1;
    const labelOf = (section: string) =>
      hasSections ? (sectionLabels.get(section) ?? null) : null;
    for (const note of margins.notes) {
      const locator = marginNoteLocator(note.affectedIds[0], labelOf);
      marginNotes.push({
        id: note.id,
        paper: paper.id,
        paperTitle: paper.title,
        // One of the 28 names no affected id and is about the paper as a whole; it says so rather
        // than being given a position it does not have.
        locator: locator ?? "A note on the paper as a whole",
        text: [note.claim, note.reasoning, note.evidence].filter(Boolean).join(" "),
        kind: note.kind,
      });
    }
    for (const wrongTurn of margins.misconceptions) {
      const claim = wrongTurn.temptingClaims[0];
      // A record with no tempting claim has nothing a reader would type, and the schema permits
      // none; skipping it is visible in the census below rather than silent.
      if (!claim) continue;
      wrongTurns.push({
        id: wrongTurn.id,
        paper: paper.id,
        paperTitle: paper.title,
        claim,
        text: [
          ...wrongTurn.temptingClaims.slice(1),
          wrongTurn.whyTempting,
          wrongTurn.whereItIsTrue,
          // `whatIsTrue` is `unknown` at the schema layer and is validated at the render
          // boundary by this parser, which is the only place its shape is known (types.ts says so).
          parseWhatIsTrue(wrongTurn.whatIsTrue, wrongTurn.id).r0,
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
    if (capstoneExists(paper.id)) {
      const { capstone } = loadCapstone(paper.id);
      capstones.push({
        paper: paper.id,
        paperTitle: paper.title,
        title: capstone.title,
        text: [capstone.question, ...capstone.claims.map((claim) => claim.text)].join(" "),
      });
    }
    // mass-energy prints no numbered sections and its whole argument is s0, so its displays are
    // cited by number alone rather than under a section that does not exist (labelOf, above).
    for (const row of equationCatalogue(paper.id)) {
      if (row.kind !== "printed") continue;
      explainedEquations.push({
        display: row.display,
        paper: paper.id,
        paperTitle: paper.title,
        locator: equationLocator(row.display, labelOf),
        words: row.words,
        spoken: row.spoken,
      });
    }
  }
  const documents = [
    ...documentsFromCompiled(papers, foundations, instruments, profile, equationTerms),
    ...explainedEquationDocuments(explainedEquations, profile),
    ...wrongTurnDocuments(wrongTurns, profile),
    ...capstoneDocuments(capstones, profile),
    ...marginNoteDocuments(marginNotes, profile),
    ...connectionDocuments(connections, profile),
    ...walkthroughDocuments(walkthroughs, profile),
    ...discoveryDocuments(ROUTE_INDEX, profile),
    ...tourDocuments(guidedTours, profile),
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
