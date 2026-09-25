/**
 * Where a printed page of a paper is, on the paper's facsimile face.
 *
 * Every paper serves /papers/<paper>/view/facsimile/ as a static page, and FacsimilePanel gives
 * each printed page the id below, so a link built here lands with and without JavaScript. The
 * source face's "[p. N]" locators used to point at /papers/<paper>/?view=facsimile#page-N: the
 * explanation page's in-page view, which has no page anchors. With JavaScript it rewrote the hash
 * to the paper's entry and showed page 1; without it, the reading view's top (dispatch 206).
 *
 * No imports, so a client component can use it.
 */

/** The id FacsimilePanel gives a printed page. */
export function facsimilePageId(printedPage: number): string {
  return `facsimile-page-${printedPage}`;
}

/** A link to one printed page on the paper's facsimile face. */
export function facsimilePageHref(paper: string, printedPage: number): string {
  return `/papers/${paper}/view/facsimile/#${facsimilePageId(printedPage)}`;
}
