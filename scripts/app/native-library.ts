/** The native library's bibliographic and availability details come from the web edition's owners. */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { PORTRAIT } from "../../src/app/about/portrait.ts";
import { paperFacts } from "../../src/app/papers/paperFacts.ts";
import { checkedReceipts } from "../../src/app/sources/receiptPages.ts";
import { germanTextState } from "../../src/content/germanTextState.ts";
import { ROUTE_SLUGS, type RouteSlug } from "../../src/content/ids.ts";
import { missingReadingLayers } from "../../src/content/paperAvailability.ts";
import { translationState } from "../../src/content/translationState.ts";

export interface NativeLibraryPaper {
  readonly workingTitle?: string;
  readonly locator?: string;
  readonly pageCount?: number;
  readonly firstPage?: number;
  readonly lastPage?: number;
  readonly availabilityNotice?: string;
}

export interface NativeLibraryPortrait {
  readonly path: string;
  readonly alt: string;
  readonly credit: string;
  readonly recordURL: string;
}

export interface NativeLibraryDetails {
  readonly papers: ReadonlyMap<string, NativeLibraryPaper>;
  readonly portrait?: NativeLibraryPortrait;
}

export function buildNativeLibrary(contentDir: string): NativeLibraryDetails {
  const root = resolve(contentDir, "..");
  const provenanceDir = join(root, "docs/provenance");
  const receipts = checkedReceipts({ provenanceDir, rootDir: root, requireLocal: false });
  const facts = new Map(paperFacts(root).map((paper) => [paper.slug, paper]));
  const translations = new Map(translationState(root).map((paper) => [paper.slug, paper]));
  const papers = new Map<string, NativeLibraryPaper>();
  for (const slug of ROUTE_SLUGS) {
    // The compiler can also export an older/minimal content fixture. It never invents facts for it.
    if (!existsSync(join(contentDir, "papers", `${slug}.json`))) continue;
    const receipt = receipts.find((entry) => entry.receipt?.frontMatter.slug === slug)?.receipt;
    const fact = facts.get(slug);
    const missing = missingReadingLayers(
      germanTextState(slug as RouteSlug, root),
      translations.get(slug),
    );
    papers.set(slug, {
      ...(receipt
        ? {
            workingTitle: receipt.frontMatter.paper.titleEnglishWorking,
            firstPage: receipt.frontMatter.paper.journal.pages.first,
            lastPage: receipt.frontMatter.paper.journal.pages.last,
          }
        : {}),
      ...(fact ? { locator: fact.locator, pageCount: fact.printedPages } : {}),
      ...(missing ? { availabilityNotice: missing } : {}),
    });
  }
  const image = PORTRAIT.served[0];
  const portrait = existsSync(join(root, "public", image.path.slice(1)))
    ? {
        path: image.path,
        alt: PORTRAIT.alt,
        credit: `${PORTRAIT.archiveCaption}. ${PORTRAIT.archive}, ${PORTRAIT.identifier}. The archive records the photographer as ${PORTRAIT.archivePhotographer.toLowerCase()}; often attributed to ${PORTRAIT.attributedTo}. ${PORTRAIT.rights}.`,
        recordURL: `https://doi.org/${PORTRAIT.doi}`,
      }
    : undefined;
  return { papers, ...(portrait ? { portrait } : {}) };
}
