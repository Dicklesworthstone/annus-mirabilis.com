import { loadFirstPages } from "../../components/home/firstPages.ts";
import { loadContentIndex } from "../../content/compiler/serverLoaders.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import {
  commentary,
  historicalArticle,
  type TaggedEntity,
  validateScholarly,
} from "./scholarly.ts";

/**
 * The paper page's structured citation data, rendered into the static HTML so it is there without
 * JavaScript: Einstein's article and this site's commentary on it, as one JSON-LD graph. The pair is
 * validated before it is written, so a build that would misattribute either one stops instead.
 * A paper with no receipt gets no metadata rather than a guessed one.
 */
export async function ScholarlyMetadata({ paperId }: { paperId: string }) {
  const receipt = loadProvenanceReceipts().receipts.find(
    (entry) => entry.receipt?.frontMatter.slug === paperId,
  )?.receipt;
  if (!receipt) return null;
  const fm = receipt.frontMatter;
  const { buildDigest } = await loadContentIndex();
  const shortTitle = loadFirstPages().find((paper) => paper.slug === paperId)?.title;
  const entities: TaggedEntity[] = [
    { role: "historical-article", entity: historicalArticle(fm) },
    {
      role: "commentary",
      entity: commentary(fm, `${shortTitle ?? fm.paper.titleGerman}, explained`, buildDigest),
    },
  ];
  validateScholarly(entities);
  // "<" is escaped so no text in a record can close the script element.
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": entities.map((e) => e.entity),
  }).replace(/</g, "\\u003c");
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: a JSON-LD data block built from validated receipts, with "<" escaped; it is never executed
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
