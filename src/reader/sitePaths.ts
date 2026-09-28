/**
 * THE ONE PLACE THAT DECIDES WHETHER A SITE-EMITTED PATH CARRIES A TRAILING SLASH (am-tpzn).
 *
 * next.config sets `trailingSlash: true` and `output: "export"`, so the build writes a directory
 * per route and every route is addressed with a slash. The static host does not honour that
 * uniformly: it reads a FINAL PATH SEGMENT CONTAINING A DOT as a filename and normalises the slash
 * away. Measured on annus-mirabilis.com on 2026-09-28 with the repository's declared user agent:
 *
 *     /tapes/the-locked-positions/   200      /tapes/einstein-0-8-micron/   200
 *     /tapes/the-boost-to-0.6c/      308  ->  /tapes/the-boost-to-0.6c      200
 *
 * It is the dot and nothing else. `out/tapes/the-boost-to-0.6c/` is a directory exactly like its
 * twenty-one siblings, /papers/[paper]/ is also a dynamic route and keeps its slash, and twenty-one
 * of the twenty-two tape routes keep theirs. The id is not a mistake either: AGENTS.md permits a dot
 * "only between two digits", which `0.6c` satisfies, and names `the-boost-to-0.6c` as one of the five
 * teaching tapes. Preset ids take the same shape (`sr-03-boost-0.6c`), so a future route keyed by a
 * preset meets this too.
 *
 * THE RULE: a path whose last segment contains a dot is emitted WITHOUT the trailing slash. Every
 * other path keeps it.
 *
 * WHY THAT IS THE SAFE DIRECTION, and not merely the faster one. Both forms resolve today, so the
 * choice is about which one survives the host changing its mind. It is asymmetric:
 *
 *   - Emit the no-slash form (this rule). Today it answers 200 directly. If the host ever stopped
 *     special-casing dots, `out/` still holds a DIRECTORY for the route, so the no-slash form would
 *     begin redirecting to the slash form and the link would still resolve. It degrades to one
 *     redirect.
 *   - Emit the slash form. Today it costs a redirect, and it would only ever stop costing one.
 *
 * Neither breaks, so this is not a safety argument for one over the other; it is a correctness
 * argument for the sitemap, which the redirect DOES harm. A sitemap should name the URL that answers
 * 200, and until now it listed the 308. That is the part of am-tpzn worth fixing, and the rest of
 * the call sites follow it so the rule lives in one place rather than in five string templates.
 *
 * This helper is deliberately not clever: it does not know about the host, cannot reach the network,
 * and encodes one measured fact. If the measurement above stops holding, change it here.
 */

/** True when the host will read this path's last segment as a filename rather than a directory. */
export function lastSegmentLooksLikeAFile(path: string): boolean {
  const withoutTrailingSlash = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSegment = withoutTrailingSlash.slice(withoutTrailingSlash.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}

/**
 * The form of `path` this site emits: the trailing slash unless the last segment contains a dot.
 * `path` is given with its trailing slash, the way the rest of the site writes a route.
 */
export function staticHostPath(path: string): string {
  if (!path.endsWith("/")) return lastSegmentLooksLikeAFile(path) ? path : `${path}/`;
  return lastSegmentLooksLikeAFile(path) ? path.slice(0, -1) : path;
}

/** The address of one teaching tape's walkthrough page. The only route family that meets the rule. */
export function tapePath(tapeId: string): string {
  return staticHostPath(`/tapes/${tapeId}/`);
}
