/** A bounded public return address, never arbitrary URLs, answers, notebook ids or saved text. */
export const CAPSTONE_RETURN_PARAM = "fromCapstone";
export const CAPSTONE_RETURN_PAPERS = Object.freeze({
  "brownian-motion": "Brownian motion",
  "light-quanta": "Light quanta",
  "special-relativity": "Special relativity",
  "mass-energy": "Mass and energy",
});
export type CapstoneReturnPaper = keyof typeof CAPSTONE_RETURN_PAPERS;
export type CapstoneReturnContext = Readonly<{ paper: CapstoneReturnPaper; destination: string }>;
const ORIGIN = "https://annus-mirabilis.com";
// Match the portable laboratory-link cap without importing the tape schema into every page.
// The real-corpus launch test also checks decorated links against the codec's own bound.
const MAX_URL_LENGTH = 2048;

export function isCapstoneReturnPaper(value: string): value is CapstoneReturnPaper {
  return Object.hasOwn(CAPSTONE_RETURN_PAPERS, value);
}
export function worksheetPaper(pathname: string): CapstoneReturnPaper | null {
  const match = /^\/capstones\/([a-z-]+)\/?$/.exec(pathname);
  return match?.[1] && isCapstoneReturnPaper(match[1]) ? match[1] : null;
}
/** The destination family remains the same when a paper switches face or opens a clarification. */
export function capstoneDestination(pathname: string): string | null {
  const match =
    /^\/(papers|lab|tapes|foundations)\/([a-z0-9][a-z0-9.-]*)(?:\/[a-z0-9/-]*)?\/?$/.exec(pathname);
  if (!match || pathname.includes("..")) return null;
  return `/${match[1]}/${match[2]}/`;
}
export function capstoneReturnHref(paper: CapstoneReturnPaper): string {
  return `/capstones/${paper}/#capstone-worksheet`;
}

/** Preserve every existing query byte (especially tape encodings), adding only the public slug. */
export function withCapstoneReturn(href: string, paper: string): string {
  if (
    !isCapstoneReturnPaper(paper) ||
    href.length > MAX_URL_LENGTH ||
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/u.test(href)
  )
    return href;
  let parsed: URL;
  try {
    parsed = new URL(href, ORIGIN);
  } catch {
    return href;
  }
  // Do not normalize escaped path separators, dot segments, or an external authority into a link
  // we would be willing to decorate. Fragments and the existing query stay byte-for-byte intact.
  const path = href.split(/[?#]/, 1)[0];
  if (
    parsed.origin !== ORIGIN ||
    path !== parsed.pathname ||
    path?.includes("%") ||
    !capstoneDestination(parsed.pathname)
  )
    return href;
  const existing = parsed.searchParams.getAll(CAPSTONE_RETURN_PARAM);
  if (existing.length !== 0) return href;
  const hashAt = href.indexOf("#");
  const head = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt);
  const joiner = !head.includes("?") ? "?" : /[?&]$/.test(head) ? "" : "&";
  const next = `${head}${joiner}${CAPSTONE_RETURN_PARAM}=${paper}${hash}`;
  return next.length <= MAX_URL_LENGTH ? next : href;
}

/**
 * Reader face/clarification controls rebuild their own URLs. Retain an already admitted return
 * context within that destination family, without changing those controls' URLs or history state.
 * A different destination without a token, an invalid token, or leaving the reading flow clears it.
 */
export function nextCapstoneReturn(
  previous: CapstoneReturnContext | null,
  pathname: string,
  search: string,
): CapstoneReturnContext | null {
  const destination = capstoneDestination(pathname);
  if (!destination || search.length > MAX_URL_LENGTH) return null;
  const params = new URLSearchParams(search);
  const values = params.getAll(CAPSTONE_RETURN_PARAM);
  if (values.length === 0) return previous?.destination === destination ? previous : null;
  const paper = values[0];
  if (values.length !== 1 || !paper || !isCapstoneReturnPaper(paper)) return null;
  return previous?.destination === destination && previous.paper === paper
    ? previous
    : { paper, destination };
}
