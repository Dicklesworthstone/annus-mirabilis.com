import { createHash } from "node:crypto";
import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveLayerRights } from "../../content/exports/rights.ts";
import type { SourceBlock as SourceRecord } from "../../content/schemas/source.ts";
import { withoutClaimedDisplays } from "../../reader/faces/displayClaims.ts";
import { FootnotesSection } from "../../reader/faces/Footnote.tsx";
import { SourceAliasAnchors } from "../../reader/faces/SourceAliases.tsx";
import { SourceBlock } from "../../reader/faces/SourceBlock.tsx";
import { TranslationParagraphs } from "../../reader/faces/TranslationParagraphs.tsx";
import { unitsBySourceRef } from "../../reader/faces/TranslationUnit.tsx";
import type { OfflineProfile } from "./server.ts";
import {
  OFFLINE_ENGLISH_PREFIX,
  OfflineSourceError,
  type OfflineSourceSelection,
  offlineMarkupIds,
  offlineSourceIds,
  prepareOfflineSourceMarkup,
  selectOfflineSources,
} from "./sourceProjection.ts";

export type OfflineSourceCoverage = Readonly<{
  germanBlocks: number;
  englishUnits: number;
  revision: string;
  translationRevision: string | null;
}>;

export type OfflineSourceAttachment = Readonly<{
  html: string;
  coverage: OfflineSourceCoverage;
}>;

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Only the existing reader's source/translation renderers set the diplomatic text. */
export function renderOfflineSources(
  selection: OfflineSourceSelection,
  aliases: Readonly<Record<string, string>>,
): OfflineSourceAttachment {
  const { paper, section, blocks, units, alignment } = selection;
  const german = withoutClaimedDisplays(blocks).filter((block) => block.kind !== "footnote");
  const footnotes = blocks.filter((block) => block.kind === "footnote");
  const sourceIds = new Set(blocks.flatMap(offlineSourceIds));
  const unitForSource = unitsBySourceRef(units);
  const translation = (block: SourceRecord) => {
    const unit = offlineSourceIds(block).map((id) => unitForSource.get(id)).find((id) => id !== undefined);
    return unit ? (
      <p className="offline-source-return" lang="en">
        <a href={"#" + OFFLINE_ENGLISH_PREFIX + unit}>Read this passage in English</a>
      </p>
    ) : null;
  };
  const aliasAnchors = (block: SourceRecord) => (
    <SourceAliasAnchors aliases={aliases} targets={offlineSourceIds(block)} />
  );
  const rights = resolveLayerRights({ germanText: blocks.length > 0, translation: units.length > 0 });
  const raw = renderToStaticMarkup(
    <section className="offline-source" id={"offline-sources-" + section} aria-label="Source text carried with this chapter">
      <h2>Read the source beside the explanation</h2>
      <p>
        The available German source{units.length > 0 ? " and English translation" : ""} for this
        section {units.length > 0 ? "are" : "is"} carried below, including the footnotes. Passage links work within this file. Links to scans and other
        sections open the website and need a connection.
      </p>
      <nav aria-label="Texts in this file">
        <a href={"#explanation-" + section}>Return to the explanation</a>{" · "}
        <a href={"#offline-german-" + section}>German source</a>
        {units.length > 0 && <>{" · "}<a href={"#offline-english-" + section}>English translation</a></>}
      </nav>
      <details open id={"offline-german-" + section}>
        <summary>German source</summary>
        <div lang="de" data-offline-source-face="german">
          {german.map((block) => (
            <Fragment key={block.id}>
              {aliasAnchors(block)}
              <SourceBlock block={block} paperSlug={paper} />
              {translation(block)}
            </Fragment>
          ))}
          <FootnotesSection
            footnotes={footnotes}
            anchored
            heading="Fußnoten"
            after={(block) => <>{aliasAnchors(block)}{translation(block)}</>}
          />
        </div>
      </details>
      {units.length > 0 ? (
        <details open id={"offline-english-" + section}>
          <summary>English translation</summary>
          <div lang="en" data-offline-source-face="english">
            <TranslationParagraphs
              units={units}
              blocks={blocks}
              alignment={alignment}
              aliases={aliases}
              anchorPrefix={OFFLINE_ENGLISH_PREFIX}
              footnoteUnits={unitForSource}
            />
          </div>
        </details>
      ) : (
        <p>No English translation of this section is included in this file.</p>
      )}
      <details className="offline-source-rights">
        <summary>Source and translation rights</summary>
        {rights.germanText && <p>{rights.germanText.statement}</p>}
        {rights.translation && <p>{rights.translation.statement}</p>}
        <p>The repository and mathematics licenses are reproduced below. No facsimile scans or witness translations are embedded.</p>
      </details>
    </section>,
  );
  // The explanation address is owned by chapter.ts, outside this fragment.
  const html = prepareOfflineSourceMarkup(raw, paper, new Set(["explanation-" + section]));
  const ids = offlineMarkupIds(html);
  const expected = [...sourceIds, ...units.map((unit) => OFFLINE_ENGLISH_PREFIX + unit.id)];
  for (const id of expected)
    if (!ids.has(id))
      throw new OfflineSourceError(
        "offline-source-anchor",
        "The offline source renderer dropped a canonical address: " + id,
      );
  const translationRevision = units.length > 0 ? digest(units) : null;
  return Object.freeze({
    html,
    coverage: Object.freeze({
      germanBlocks: blocks.length,
      englishUnits: units.length,
      revision: digest({ selection, aliases, rights }),
      translationRevision,
    }),
  });
}

export async function loadOfflineSectionSources(
  root: string,
  paper: string,
  section: string,
  profile: OfflineProfile,
): Promise<OfflineSourceAttachment | null> {
  if (profile !== "scaffold") return null;
  const [{ loadBilingualEdition }, { loadSourceAliases }] = await Promise.all([
    import("../../reader/faces/bilingualLoader.ts"),
    import("../../reader/anchors/sourceAliases.ts"),
  ]);
  const edition = await loadBilingualEdition(paper, root);
  const selection = selectOfflineSources(edition, section, profile);
  if (!selection) return null;
  const ids = new Set(selection.blocks.flatMap(offlineSourceIds));
  const aliases = loadSourceAliases(root, paper, ids);
  return renderOfflineSources(selection, aliases);
}
