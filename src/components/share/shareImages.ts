import { dayAndMonth, loadFirstPages } from "../home/firstPages.ts";

/**
 * The Open Graph entry that names a page's share card, for its metadata. Kept apart from
 * shareCards.tsx so a page's metadata does not import the renderer. The cards themselves are
 * published at /share/<id>.png by src/app/share/[card]/route.tsx.
 */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

/**
 * The instruments with a card of their own: the page's title, which the page's metadata also takes
 * from here, and the question the page opens on.
 */
export const LAB_CARDS = {
  "bm-01": {
    paperKey: "ap-17-549",
    title: "The Brownian tracer ensemble",
    question: "Where does a wandering particle end up?",
  },
} as const;
export type LabCardId = keyof typeof LAB_CARDS;

export function shareImage(id: string, alt: string) {
  return { url: `/share/${id}.png`, ...SHARE_CARD_SIZE, alt };
}

/** A paper's card, for the paper and every section and face of it, or none for a slug with no card. */
export function paperShareImages(slug: string) {
  const paper = loadFirstPages().find((p) => p.slug === slug);
  if (!paper) return undefined;
  return [
    shareImage(
      slug,
      `The first printed page of "${paper.germanTitle}", received by Annalen der Physik on ${dayAndMonth(paper.received)} 1905`,
    ),
  ];
}

/** An instrument's card: its paper's first page under the instrument's own title. */
export function labShareImages(id: LabCardId) {
  const lab = LAB_CARDS[id];
  const paper = loadFirstPages().find((p) => p.key === lab.paperKey);
  return [
    shareImage(
      id,
      `${lab.title}: an instrument for ${paper?.title ?? "the paper"}, shown with the paper's first printed page`,
    ),
  ];
}
