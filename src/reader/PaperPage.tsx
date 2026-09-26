import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import lightQuantaEntrance from "../../content/arguments/light-quanta/entrance-light-quanta.json";
import clockEntranceRaw from "../../content/arguments/special-relativity/entrance-special-relativity.json";
import { ModalCloseButton } from "../a11y/modal/ModalCloseButton.tsx";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { citationTitleClose } from "../content/citationTitle.ts";
import { loadGermanSourceFace, printedUnits } from "../content/editions/germanSourceFace.ts";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import type { RouteSlug } from "../content/ids.ts";
import { aliasTargets } from "../content/notation/anchorCoversPage.ts";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import { hasResultCards } from "../content/results/resultCards.ts";
import { getModalityClasses } from "../content/schemas/glossConventions.ts";
import { loadPaper } from "../content/server.ts";
import type { CompiledMissingStepLesson } from "../equations/missingStep/compiled.ts";
import { MissingStepDisclosure } from "../equations/missingStep/MissingStepPanel.tsx";
import entranceExample from "../generated/mass-energy-entrance.json";
import missingSteps from "../generated/missing-steps.json";
import { ArgumentEquations } from "./ArgumentEquations.tsx";
import { passageActionsFromArgument } from "./actions/fromArgument.ts";
import { PassageActionsBar } from "./actions/PassageActionsBar.tsx";
import { ReadingBlocks } from "./Blocks.tsx";
import type { MassEnergyEntranceScenario } from "./entrances/massEnergyExample.ts";
import { FaceFallback } from "./FaceFallback.tsx";
import { FirstUseCallout } from "./FirstUseCallout.tsx";
import {
  editionBlocksReviewed,
  englishFaceHasContent,
  faceAvailability,
  germanFaceHasContent,
  germanFaceRendersEdition,
  glossFaceHasContent,
  parallelFaceHasContent,
} from "./faceAvailability.ts";
import { type BilingualEdition, loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { EnglishFace } from "./faces/EnglishFace.tsx";
import {
  missingGermanSections,
  unglossedSections,
  untranslatedSections,
} from "./faces/editionCoverage.ts";
import { GermanDraftFace } from "./faces/GermanDraftFace.tsx";
import { GermanFace } from "./faces/GermanFace.tsx";
import { GlossFace } from "./faces/GlossFace.tsx";
import { sectionGlossPath } from "./faces/glossSections.ts";
import { ParallelFace } from "./faces/ParallelFace.tsx";
import { firstUseCallouts } from "./firstUse.ts";
import {
  LazyClockFirstEncounter,
  LazyLightQuantaFirstEncounter,
  LazyMassEnergyFirstEncounter,
} from "./lazyIslands.tsx";
import { ledgerGaps } from "./ledgerGaps.ts";
import { MassEnergyDerivation } from "./MassEnergyDerivation.tsx";
import { MassEnergyLowSpeed } from "./MassEnergyLowSpeed.tsx";
import { loadPaperMargins } from "./marginRecords.ts";
import { OutlineSectionTitle } from "./OutlineSectionTitle.tsx";
import { PaperMargins } from "./PaperMargins.tsx";
import { notationReach, notationReachLine, paperEquations } from "./paperEquations.ts";
import {
  isFaceFallbackId,
  type PaperRouteRequest,
  paperPath,
  resolvePaperRoute,
} from "./paperRoutes.ts";
import { paperSectionIds } from "./paperSections.ts";
import { englishSourceLink, originalHref, paperSourceFaces } from "./paperSourceFaces.ts";
import { passageKind } from "./passageKind.ts";
import { ReaderController } from "./ReaderController.tsx";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline.ts";
import { SectionPager } from "./SectionPager.tsx";
import { SourceParagraphs } from "./SourceParagraphs.tsx";
import { UnexplainedOutlineEntry, UnexplainedPartsLine } from "./UnexplainedParts.tsx";
import { outlineOrder, paperParts, unexplainedParts } from "./unexplainedParts.ts";
import "./reader.css";
import "./paperLayout.css";

export interface PaperPageOptions {
  readonly edition?: BilingualEdition | null | undefined;
  readonly editionLoader?: ((paperId: string) => Promise<BilingualEdition | null>) | undefined;
}

/**
 * Generic paper/section/face renderer. The dedicated brownian-motion pages keep
 * using PaperReader (layout work in flight there). This shell is paper-agnostic:
 * it loads whichever compiled paper the route named.
 */
export async function PaperPage(request: PaperRouteRequest, options?: PaperPageOptions) {
  const resolved = await resolvePaperRoute(request);
  if (!resolved.ok) notFound();
  if (resolved.face !== "reading") {
    if (!isFaceFallbackId(resolved.face)) notFound();

    if (
      resolved.face === "german" ||
      resolved.face === "english" ||
      resolved.face === "parallel" ||
      resolved.face === "gloss"
    ) {
      const edition =
        options?.edition !== undefined
          ? options.edition
          : options?.editionLoader
            ? await options.editionLoader(resolved.paperId)
            : await loadBilingualEdition(resolved.paperId);

      // GERMAN IS GATED BY THE SHARED PREDICATE, then dispatched to a renderer.
      //
      // An earlier version of this left the two conditions inline and asserted in a
      // comment that they "together ARE germanFaceHasContent". Nothing made that true:
      // an equivalence held in prose between two things that can be edited
      // independently is the same two-sources seam faceAvailability.ts exists to
      // remove, compressed into one file. The predicate now decides WHETHER the face
      // has content and the inner branches decide only WHICH renderer, so breaking the
      // predicate stops German rendering rather than silently disagreeing with the
      // chooser.
      //
      // A paper may hold a ledger draft on disk beside, or instead of, an edition's source
      // blocks. Since dispatch 255 the blocks render the German face whenever there are any,
      // reviewed or not (germanFaceRendersEdition), so the draft is read only for a paper with
      // none. The draft is consulted for German alone: English, parallel and gloss need
      // translation units that no ledger provides.
      if (resolved.face === "german") {
        const blocks = edition?.blocks ?? [];
        const editionBlocks = blocks.length;
        // The draft is read only for a paper without source blocks (germanFaceRendersEdition).
        const draft =
          editionBlocks > 0 || editionBlocksReviewed(blocks)
            ? null
            : loadGermanSourceFace(resolved.paperId as RouteSlug);
        if (germanFaceHasContent(editionBlocks, draft?.blocks.length ?? 0)) {
          if (edition && germanFaceRendersEdition(blocks, draft?.blocks.length ?? 0)) {
            // The edition names the sections and pages it lacks, and links each paragraph to its
            // explanation, as the draft face does: arriving a section at a time, it must not read
            // as the whole paper (dispatch 192).
            const paperRecord = await loadPaper(resolved.paperId);
            const { explainedBy, notExplained } = passageLinks(
              resolved.paperId,
              paperRecord.arguments,
            );
            const pdf = `papers/pdfs/${edition.paper.bibKey}.pdf`;
            // The printed pages beside the text, as the draft face set them: a page is offered only
            // when both of its plates (640 and 1280px wide) are in public/, and the volume comes
            // from the key's own grammar, ap-<volume>-<first page>.
            const printedKey = /^ap-(\d+)-(\d+)$/.exec(edition.paper.bibKey);
            const plateDir = `/figures/plates/pages/${edition.paper.bibKey}`;
            const platePages = printedKey
              ? [...new Set(blocks.flatMap((b) => b.locators.map((l) => l.printedPage)))]
                  .sort((a, b) => a - b)
                  .filter((page) =>
                    [`${page}.webp`, `${page}-1280.webp`].every((file) =>
                      existsSync(join(process.cwd(), "public", plateDir, file)),
                    ),
                  )
              : [];
            const plate =
              printedKey && platePages.length > 0
                ? {
                    dir: plateDir,
                    pages: platePages,
                    volume: printedKey[1] as string,
                    scanHref: `/${pdf}`,
                  }
                : undefined;
            // Retired manifest ids, each to the published id that absorbed it (content/aliases),
            // where the face publishes that id: a block or a sentence. A reference occurrence
            // (s2-p2-s1-r3) is no anchor, so an alias to it would lead nowhere.
            const published = new Set(
              blocks.flatMap((b) => [b.id, ...b.sentenceSpans.map((span) => span.id)]),
            );
            const aliases = Object.fromEntries(
              [...aliasTargets(process.cwd(), resolved.paperId)].flatMap(([retired, targets]) => {
                const target = targets[0];
                return target && published.has(target) && !published.has(retired)
                  ? [[retired, target]]
                  : [];
              }),
            );
            const availability = faceAvailability({
              blocks: editionBlocks,
              units: edition.units.length,
              glossUnits: edition.glossUnits?.length ?? 0,
              germanDraftBlocks: 0,
            });
            return (
              <GermanFace
                paper={edition.paper}
                blocks={edition.blocks}
                alignment={edition.alignment}
                editorialNotes={edition.editorialNotes}
                sectionId={resolved.section}
                missingSections={missingGermanSections(
                  paperSectionIds(
                    resolved.paperId,
                    edition.paper.sections.map((s) => s.id),
                  ),
                  blocks,
                )}
                untranscribedPages={ledgerGaps(resolved.paperId as RouteSlug)?.untranscribed ?? []}
                pdfHref={existsSync(join(process.cwd(), "public", pdf)) ? `/${pdf}` : null}
                explainedBy={explainedBy}
                notExplained={notExplained}
                plate={plate}
                aliases={aliases}
                availability={availability}
              />
            );
          }
          if (draft) {
            const paperRecord = await loadPaper(resolved.paperId);
            // The chooser's availability, derived from the same counts the dispatch decides
            // on, as FaceFallback does. The PDF is not hashed, so facsimile stays unknown.
            const availability = faceAvailability({
              blocks: editionBlocks,
              units: edition?.units.length ?? 0,
              glossUnits: edition?.glossUnits?.length ?? 0,
              germanDraftBlocks: draft.blocks.length,
            });
            // The printed pages of the scan, beside the text, turned to the page the reader has
            // reached (FollowingPlate). A section view opens on its own first page, so it gets
            // the plate too: that page is where the section was printed, not the paper's first.
            // A page is offered only when both of its plates (640 and 1280px wide) are in
            // public/, so a srcset never names a file that is not there.
            // The volume comes from the key's own grammar, ap-<volume>-<first page> (AGENTS.md,
            // bibliographic keys). A key that does not parse gets no plate rather than a raw id.
            const printed = /^ap-(\d+)-(\d+)$/.exec(draft.bibKey);
            const plateDir = `/figures/plates/pages/${draft.bibKey}`;
            const platePages = printed
              ? draft.printedPages.printed.filter((page) =>
                  [`${page}.webp`, `${page}-1280.webp`].every((file) =>
                    existsSync(join(process.cwd(), "public", plateDir, file)),
                  ),
                )
              : [];
            const plate =
              printed && platePages.length > 0
                ? {
                    dir: plateDir,
                    pages: platePages,
                    volume: printed[1] as string,
                    scanHref: `/papers/pdfs/${draft.bibKey}.pdf`,
                  }
                : undefined;
            // Each printed paragraph's explanation passages (content/bindings), by manifest anchor.
            const { explainedBy, notExplained } = passageLinks(
              resolved.paperId,
              paperRecord.arguments,
            );
            return (
              <GermanDraftFace
                face={draft}
                explainedBy={explainedBy}
                notExplained={notExplained}
                paperId={resolved.paperId}
                paperTitle={paperRecord.paper.title}
                germanTitle={paperRecord.paper.germanTitle}
                sectionId={resolved.section}
                availability={availability}
                plate={plate}
              />
            );
          }
        }
      }

      if (edition) {
        // The chooser's availability on the edition's faces, from the counts this dispatch decides
        // on, as the German draft face and FaceFallback derive theirs. The PDF is not hashed.
        const germanDraft = editionBlocksReviewed(edition.blocks)
          ? null
          : loadGermanSourceFace(resolved.paperId as RouteSlug);
        const availability = faceAvailability({
          blocks: edition.blocks.length,
          units: edition.units.length,
          glossUnits: edition.glossUnits?.length ?? 0,
          germanDraftBlocks: germanDraft?.blocks.length ?? 0,
        });
        // The sections no translation unit reaches yet, named on the English and parallel faces so
        // an edition that arrives a section at a time is not read as the whole paper; and the
        // sections no gloss unit reaches, named on the gloss face for the same reason.
        const sectionIds = paperSectionIds(
          resolved.paperId,
          edition.paper.sections.map((s) => s.id),
        );
        const untranslated = untranslatedSections(sectionIds, edition.blocks, edition.units);
        if (resolved.face === "english" && englishFaceHasContent(edition.units.length)) {
          return (
            <EnglishFace
              availability={availability}
              blocks={edition.blocks}
              paper={edition.paper}
              units={edition.units}
              alignment={edition.alignment}
              editorialNotes={edition.editorialNotes}
              reviewRecords={edition.reviewRecords}
              sectionId={resolved.section}
              untranslatedSections={untranslated}
            />
          );
        }
        if (
          resolved.face === "parallel" &&
          parallelFaceHasContent(edition.blocks.length, edition.units.length)
        ) {
          return (
            <ParallelFace
              availability={availability}
              paper={edition.paper}
              blocks={edition.blocks}
              units={edition.units}
              alignment={
                edition.alignment ?? {
                  id: `${edition.paper.slug}-empty-alignment`,
                  paper: edition.paper.slug,
                  edges: [],
                }
              }
              editorialNotes={edition.editorialNotes}
              reviewRecords={edition.reviewRecords}
              sectionId={resolved.section}
              untranslatedSections={untranslated}
            />
          );
        }
        if (
          resolved.face === "gloss" &&
          // The `&& edition.glossUnits` is load-bearing for TYPE NARROWING, not only for
          // the condition: the prop below needs it non-undefined. Replacing it with
          // `?.length ?? 0` alone compiles the predicate and breaks the prop.
          edition.glossUnits &&
          glossFaceHasContent(edition.blocks.length, edition.glossUnits.length)
        ) {
          return (
            <GlossFace
              availability={availability}
              paper={edition.paper}
              blocks={edition.blocks}
              glossUnits={edition.glossUnits}
              translations={edition.units}
              alignment={edition.alignment}
              editorialNotes={edition.editorialNotes}
              reviewRecords={edition.reviewRecords}
              modalityClasses={getModalityClasses()}
              unglossedSections={unglossedSections(sectionIds, edition.blocks, edition.glossUnits)}
              section={resolved.section}
            />
          );
        }
      }
    }

    return await FaceFallback({
      paperId: resolved.paperId,
      face: resolved.face,
      ...(resolved.section !== undefined ? { section: resolved.section } : {}),
    });
  }
  const payload = await loadPaper(resolved.paperId);
  const { paper, foundations } = payload;
  const equationsById = paperEquations(paper.id);
  const sectionId = resolved.section;
  const sections = sectionId ? paper.sections.filter((s) => s.id === sectionId) : paper.sections;
  const args = payload.arguments.filter((a) => sections.some((s) => s.id === a.section));
  // Einstein's beta and paper 2's k, called out in red where the explanation first uses them.
  // The printed paragraphs each passage explains, with their overviews (content/bindings).
  const boundParagraphs = loadParagraphBindings(process.cwd(), paper.id) ?? [];
  const firstUses = firstUseCallouts(
    loadConcordanceForPaper(paper.id).entries,
    args,
    (argumentId) =>
      new Set(
        [...equationsById.values()]
          .filter((e) => e.argument === argumentId)
          .flatMap((e) => e.terms.map((t) => t.quantityId)),
      ),
  );
  // Where a passage sends a reader for its source: "Read the original", the "Source context"
  // line, and the notice ?view=german shows in the passage's place. paperSourceFaces decides by
  // the chooser's rule, so each offers only a face with something in it, at the passage's section.
  const sources = await paperSourceFaces(paper.id);
  // The parts of the paper no passage explains yet, from its frozen manifest (unexplainedParts.ts),
  // each linked to Einstein's text: the German face at that part, else the facsimile.
  const missingParts = unexplainedParts(
    paperParts(printedUnits(process.cwd(), paper.id as RouteSlug)),
    new Set(payload.arguments.map((a) => a.section)),
  );
  const pdf = `papers/pdfs/${paper.citation}.pdf`;
  const pdfHref = existsSync(join(process.cwd(), "public", pdf)) ? `/${pdf}` : null;
  const partHref = (part: string) => originalHref(paper.id, sources, part) ?? pdfHref;
  const sourceContext = (a: { id: string; section: string }) =>
    [
      // German only where the German face has this passage's section: an edition that has reached
      // the introduction must not send a §3 passage to a German face with no §3 in it.
      sources.availability.german === "available" &&
        sources.sectionFragment(a.section) !== "" && {
          face: "german",
          label: "German source",
          name: "German source",
          href: `/papers/${paper.id}/view/german/${sources.sectionFragment(a.section)}`,
        },
      // English only where this passage's section has English: light quanta is translated a
      // section at a time, and a §5 passage offered "English" opened a face with no §5 in it.
      sources.availability.english === "available" &&
        sources.englishSectionFragment(a.section) !== "" && {
          face: "english",
          label: "English",
          name: "English translation",
          // No English unit carries an argument's id; the section's first English sentence does.
          href: `/papers/${paper.id}/view/english/${sources.englishSectionFragment(a.section)}`,
        },
      // Gloss only where this passage's section is glossed, at its first glossed sentence: the
      // gloss face's ids are sentence ids, and #<argument id> named nothing on it. The sentence is
      // on its section's gloss page, which prints that section alone (dispatch 254).
      sources.availability.gloss === "available" &&
        sources.glossSectionFragment(a.section) !== "" && {
          face: "gloss",
          label: "Interlinear gloss",
          name: "Interlinear gloss",
          href: `${sectionGlossPath(paper.id, a.section)}${sources.glossSectionFragment(a.section)}`,
        },
      // Facsimile is "unknown" here, never "empty" (faceAvailability.ts), so it stays offered.
      sources.availability.facsimile !== "empty" && {
        face: "facsimile",
        label: "Facsimile",
        name: "Facsimile scan",
        href: `/papers/${paper.id}/view/facsimile/${sources.sectionFragment(a.section)}`,
      },
    ].filter((link) => link !== false);
  const germanSource =
    sources.availability.german === "available"
      ? {
          href: `/papers/${paper.id}/view/german/`,
          // An edition that has reached only part of the paper does not promise the whole of it.
          // No "drafted" in the label (D-2026-09-25-no-review-status-banners).
          label: sources.germanIsPartial
            ? "Read the German source so far →"
            : "Read the German source for the whole paper →",
        }
      : null;
  // Beside it, the English wherever the paper has English units (paperSourceFaces.ts).
  const englishSource = englishSourceLink(paper.id, sources);
  const entrance =
    paper.id === "mass-energy" ? validateEntranceRecord(entranceExample.record) : null;
  const lightEntrance =
    paper.id === "light-quanta" ? validateEntranceRecord(lightQuantaEntrance) : null;
  const clockEntrance =
    paper.id === "special-relativity" ? validateEntranceRecord(clockEntranceRaw) : null;
  const entryAnchor = clockEntrance
    ? "entry-special-relativity"
    : lightEntrance
      ? "entry-light-quanta"
      : entrance
        ? "entry-mass-energy"
        : null;
  const anchors = [
    ...(entryAnchor && (!sectionId || entrance) ? [entryAnchor] : []),
    ...args.map((a) => a.id),
    ...sections.map((s) => s.id),
  ];
  const registry = { paperId: paper.id, anchors, foundations: foundations.map((f) => f.id) };
  // The Letters control says how many of the paper's formulas it redraws (paperEquations.ts).
  const reach = notationReach(paper.id);
  const notationHelp = reach ? notationReachLine(reach) : undefined;
  const titles = Object.fromEntries(foundations.map((f) => [f.id, f.title]));
  const questions = Object.fromEntries(args.map((a) => [a.id, a.question]));
  if (entrance) questions["entry-mass-energy"] = entrance.question;
  if (lightEntrance) questions["entry-light-quanta"] = lightEntrance.question;
  if (clockEntrance) questions["entry-special-relativity"] = clockEntrance.question;

  return (
    <div data-reader-root data-ready="true" data-view="reading" className="reader-root">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro">
        {/* The whole paper's title is the h1 right below; a section's page names its paper here. */}
        <p className="eyebrow">{sectionId ? `Read · ${paper.title}` : "Read"}</p>
        <h1>{sectionId ? sections[0]?.title : paper.title}</h1>
        {/* Paper-level lead, so a section view omits it. See PaperReader for the reasoning. */}
        {sectionId ? null : <p className="lead">{paper.description}</p>}
        {sectionId ? (
          <a href={`${paperPath(paper.id)}#${sectionId}`}>Read this section in the whole paper →</a>
        ) : null}
        {entryAnchor && (
          <p>
            <a href={`${paperPath(paper.id)}#${entryAnchor}`}>
              Show me one example before the notation →
            </a>
          </p>
        )}
      </header>
      <ReaderController
        registry={registry}
        titles={titles}
        questions={questions}
        notationHelp={notationHelp}
        resultCards={hasResultCards(process.cwd(), paper.id)}
        availability={sources.availability}
      />
      <div className="reader-layout">
        <aside className="reader-outline">
          <h2>Follow the argument</h2>
          <nav aria-label="Argument outline">
            {/* Every section of the paper, on a section's own page too: the others are plain
                links to their pages, and only this page's sections move within it. */}
            {outlineOrder(paper.sections, missingParts).map((entry) => {
              if (entry.kind === "missing")
                return (
                  <UnexplainedOutlineEntry
                    key={entry.part}
                    part={entry.part}
                    href={partHref(entry.part)}
                  />
                );
              // No part of these papers is explained elsewhere, and none is passed here.
              if (entry.kind !== "section") return null;
              const s = entry.section;
              return (
                <div key={s.id}>
                  <a
                    data-reader-anchor={sections.includes(s) ? s.id : undefined}
                    href={paperPath(paper.id, s.id)}
                    aria-current={sectionId === s.id ? "page" : undefined}
                    aria-label={s.title}
                  >
                    <OutlineSectionTitle title={s.title} />
                  </a>
                  {args
                    .filter((a) => a.section === s.id)
                    .map((a) => (
                      <a
                        key={a.id}
                        data-reader-anchor={a.id}
                        href={`${paperPath(paper.id, s.id)}#${a.id}`}
                      >
                        {a.title}
                      </a>
                    ))}
                </div>
              );
            })}
          </nav>
          <UnexplainedPartsLine parts={missingParts} hrefFor={partHref} />
        </aside>
        <div className="reader-body">
          {lightEntrance && !sectionId && <LazyLightQuantaFirstEncounter record={lightEntrance} />}
          {clockEntrance && !sectionId && <LazyClockFirstEncounter record={clockEntrance} />}
          {(lightEntrance || clockEntrance) && !sectionId && (
            <noscript>
              <p>
                The worked examples above are complete without JavaScript. Configuration links load
                their selected settings when JavaScript runs in the laboratory; its static page
                otherwise shows the prepared default.
              </p>
            </noscript>
          )}
          {entrance && (
            <LazyMassEnergyFirstEncounter
              record={entrance}
              scenarios={entranceExample.scenarios as readonly MassEnergyEntranceScenario[]}
              sourceDigest={entranceExample.sourceDigest}
            />
          )}

          {sections.map((s) => (
            <section key={s.id} id={s.id} tabIndex={-1} className="reader-section">
              {/* On a section's own page the h1 above already names it, so the eye gets it once;
                  the h2 stays for the section's structure and for screen readers. */}
              <h2 className={sectionId ? "visually-hidden" : undefined}>{s.title}</h2>
              {args
                .filter((a) => a.section === s.id)
                .map((a) => (
                  <article
                    key={a.id}
                    id={a.id}
                    data-unit={a.id}
                    tabIndex={-1}
                    className="reader-passage"
                  >
                    <p className="passage-kind">{passageKind(a.meaning)}</p>
                    <h3>{a.title}</h3>
                    <p className="passage-question">{a.question}</p>
                    {firstUses.get(a.id)?.map((entry) => (
                      <FirstUseCallout key={entry.id} entry={entry} />
                    ))}
                    <SourceParagraphs
                      paperId={paper.id}
                      bindings={boundParagraphs.filter((b) => b.passages.includes(a.id))}
                      germanAnchors={sources.germanAnchors}
                    />
                    <div data-face-reading>
                      {(["overview", "full"] as const).map((reading, i) => (
                        <div
                          data-reading={i}
                          hidden={i !== 1}
                          className="reading-version"
                          key={reading}
                        >
                          <ReadingBlocks
                            blocks={a.readings[reading]}
                            foundations={foundations}
                            contextLabel={`${a.title}, reading steps`}
                            equations={equationsById}
                            scope={{
                              paper: paper.id,
                              section: a.section,
                              where: `${a.id} ${reading}`,
                            }}
                          />
                        </div>
                      ))}
                      {/*
                        R2 IS RENDERED ONCE, AS THE DISCLOSURE. It used to be rendered twice per
                        passage: a hidden data-reading="2" copy for the page-wide "Show every
                        step", and the same blocks again, embedded lessons and all, inside "Show
                        every step here" below the equations. On /papers/brownian-motion/ that
                        was 149,096 bytes of markup twice over, plus both copies again in the
                        flight data, and it put the page over its 250 kB budget. One copy now
                        serves both: closed, it is the per-passage disclosure, which needs no
                        JavaScript; with Detail at "Show every step", ReaderController opens it
                        and detail.css hides its summary, so it reads as the passage's text.
                      */}
                      {/*
                        ON A WHOLE-PAPER PAGE THE STEPS LOAD WHEN THEY OPEN (stepsBody.ts). The
                        section's own page renders them inline; here the disclosure holds a real
                        link to it, and ReaderController lifts the steps from that page on first
                        opening, or for every passage at "Show every step".
                      */}
                      <details className="local-steps reading-version" data-reading={2}>
                        <summary>Show every step here: {a.title}</summary>
                        {sectionId ? (
                          <ReadingBlocks
                            blocks={a.readings.steps}
                            foundations={foundations}
                            embed
                            contextLabel={`${a.title}, reading steps`}
                            equations={equationsById}
                            scope={{ paper: paper.id, section: a.section, where: `${a.id} steps` }}
                          />
                        ) : (
                          <p
                            className="fine"
                            data-steps-body={a.id}
                            data-steps-src={`/papers/${paper.id}/${a.section}/`}
                          >
                            <a
                              href={`/papers/${paper.id}/${a.section}/#${a.id}`}
                              aria-label={`Read every step on this section’s own page: ${a.title}`}
                            >
                              Read every step on this section&rsquo;s own page
                            </a>
                            , where they are part of the page.
                          </p>
                        )}
                      </details>
                      {(missingSteps.lessons as readonly CompiledMissingStepLesson[])
                        .filter((lesson) => lesson.argument === a.id)
                        .map((lesson) => (
                          <MissingStepDisclosure key={lesson.id} lesson={lesson} />
                        ))}
                      <ArgumentEquations
                        paperId={paper.id}
                        argumentId={a.id}
                        lazy={!sectionId}
                        sectionHref={`/papers/${paper.id}/${a.section}/#${a.id}`}
                        title={a.title}
                      />
                      {paper.id === "mass-energy" && a.id === "arg-me-small-speed" && (
                        <MassEnergyLowSpeed />
                      )}
                      {paper.id === "mass-energy" && a.id === "arg-me-constant-premise" && (
                        <MassEnergyDerivation />
                      )}
                      {/* R3, THE HISTORIAN'S MARGIN, IS A DISCLOSURE (am-read-shell-routes-3ua). It was
                          an aside marked hidden that only the modern lens showed, and the lens is set
                          by script, so with JavaScript off nothing reached it. Now it is closed and
                          openable without script; with script the lens decides as before
                          (reader.css hides it at "paper", ReaderController opens it at "modern"). */}
                      <details className="modern-margin callout-limit" data-reading="3">
                        <summary>
                          <h4>Modern qualifications</h4>
                        </summary>
                        <ReadingBlocks
                          blocks={a.readings.margin}
                          foundations={foundations}
                          scope={{ paper: paper.id, section: a.section, where: `${a.id} margin` }}
                        />
                      </details>
                    </div>
                    <div data-face-results hidden>
                      <p>{a.recap}</p>
                      <h4>What this relies on</h4>
                      <ul>
                        {a.premises.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    {/* What ?view=german and the other source views show in the passage's place:
                        the ways to the faces that hold the source. It said "The reviewed German,
                        aligned English, gloss, facsimile, and split view for this passage are not
                        yet available", false once they were, and review copy besides
                        (D-2026-09-25-no-review-status-banners). */}
                    <div data-face-source hidden>
                      {germanSource && (
                        <p>
                          <a href={germanSource.href}>{germanSource.label}</a>
                        </p>
                      )}
                      {englishSource && (
                        <p>
                          <a href={englishSource.href}>{englishSource.label}</a>
                        </p>
                      )}
                    </div>
                    <details className="model-limits">
                      <summary>Assumptions and limits: {a.title}</summary>
                      <h4>Assumed here</h4>
                      <ul>
                        {a.premises.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <h4>What this does not establish</h4>
                      <ul>
                        {a.limitations.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      {a.prerequisites.length > 0 && (
                        <p>
                          Earlier step:{" "}
                          {a.prerequisites.map((x) => {
                            const prereq = payload.arguments.find((p) => p.id === x.id);
                            return (
                              <a key={x.id} href={`/papers/${paper.id}/#${x.id}`}>
                                {prereq?.title ?? x.id}
                              </a>
                            );
                          })}
                        </p>
                      )}
                    </details>
                    <PassageActionsBar
                      paperId={paper.id}
                      passageId={a.id}
                      passageLabel={a.title}
                      actions={passageActionsFromArgument(a)}
                      originalHref={originalHref(paper.id, sources, a.section)}
                    />
                    {sourceContext(a).length > 0 && (
                      <p className="fine">
                        Source context:{" "}
                        {sourceContext(a).map((link, n) => (
                          <Fragment key={link.face}>
                            {n > 0 && " · "}
                            <a href={link.href} aria-label={`${link.name}: ${a.title}`}>
                              {link.label}
                            </a>
                          </Fragment>
                        ))}
                      </p>
                    )}
                  </article>
                ))}
            </section>
          ))}
          {sectionId ? (
            <SectionPager paperId={paper.id} sections={paper.sections} current={sectionId} />
          ) : null}
        </div>
      </div>
      {/* A paper's common wrong turns and historian's margin (dispatch 163), on the whole-paper
          page only, and only where the paper has records. */}
      {sectionId ? null : <PaperMargins margins={loadPaperMargins(paper.id)} />}
      {/* The references, without the record's source-status notice
          (D-2026-09-25-no-review-status-banners): it said who had not yet reviewed what. */}
      <section className="reading reading-column" aria-label="References">
        <h2>References</h2>
        {payload.citations.map((citation) => (
          <p key={citation.id}>
            <a href={citation.url}>{citation.title}</a>
            {citationTitleClose(citation.title)} {citation.locator}
          </p>
        ))}
      </section>
      <p className="fine">{foundations.length} foundation readings sit behind this argument.</p>
      <dialog className="clarification-dialog" data-clarification-dialog aria-modal="true">
        {/* The X, first so the question line wraps round it; ReaderController wires it, and a press
            outside the lesson, to "Return to the exact step". Escape still goes back one step. */}
        <ModalCloseButton
          label="Close the lesson and return to the passage"
          data-clarification-close
        />
        {/* The question stays above the lesson; the reading settings and the way back sit
            after it, so on a phone the lesson opens on the first screen. The X is sticky, so a
            reader can still leave from anywhere in a long lesson. */}
        <p className="fine reader-compass-question">
          <strong>The question we were answering:</strong> <span data-compass-question />
        </p>
        {foundations.map((f) => (
          <section key={f.id} data-foundation-panel={f.id} hidden>
            <h2 id={`clarification-${f.id}`} tabIndex={-1}>
              {f.title}
            </h2>
            {/* The body loads when this lesson opens (src/reader/lessonBody.ts), from its own
                page; the dialog carried every lesson in full and put the Brownian page over its
                HTML budget. Without JavaScript the dialog never opens and each lesson link is a
                real link to that page. */}
            <div data-lesson-body={f.id}>
              <p className="fine">Loading the lesson.</p>
            </div>
            <p>
              <a
                href={`/foundations/${f.id}/`}
                aria-label={`Open ${f.title} as a full reading page`}
              >
                Open this as a full reading page →
              </a>
            </p>
          </section>
        ))}
        <nav className="reader-compass" aria-label="Explanation compass">
          <p>
            <strong>The idea we opened:</strong> <span data-compass-idea />
          </p>
          <div className="reader-options">
            <div className="reader-option">
              <label htmlFor="compass-detail-select">Passage detail</label>
              <select id="compass-detail-select" data-detail-control defaultValue="1" disabled>
                <option value="0">Overview</option>
                <option value="1">Full explanation</option>
                <option value="2">Show every step</option>
              </select>
            </div>
            <label className="check">
              <input type="checkbox" data-lens-control disabled />
              Show modern qualifications
            </label>
          </div>
          <p>
            <a href="?view=reading" data-view-link="reading">
              Explanation
            </a>{" "}
            ·{" "}
            <a href="?view=results" data-view-link="results">
              Argument synopsis
            </a>
          </p>
          <div className="actions">
            <button type="button" className="secondary" data-reader-back>
              Back one step
            </button>
            <button type="button" data-reader-close>
              Return to the exact step
            </button>
          </div>
        </nav>
      </dialog>
    </div>
  );
}

/**
 * Each printed paragraph's explanation passages (content/bindings), by its manifest id, and the
 * paragraphs declared unexplained: what both German faces print under a paragraph.
 */
function passageLinks(
  paperId: string,
  passages: readonly Readonly<{ id: string; title: string }>[],
): {
  explainedBy: Record<string, { id: string; title: string }[]>;
  notExplained: Set<string>;
} {
  const titles = new Map(passages.map((a) => [a.id, a.title]));
  const bindings = loadParagraphBindings(process.cwd(), paperId) ?? [];
  return {
    notExplained: new Set(bindings.filter((b) => b.unexplained).map((b) => b.unit)),
    explainedBy: Object.fromEntries(
      bindings.map((b) => [
        b.unit,
        b.passages.flatMap((id) => {
          const title = titles.get(id);
          return title ? [{ id, title }] : [];
        }),
      ]),
    ),
  };
}
