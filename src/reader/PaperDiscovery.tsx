import { ROUTE_INDEX } from "../discovery/routeIndex.ts";

/**
 * THE PAPER NAMES ITS DISCOVERY ROUTE (am-2rl9's sibling problem, measured 2026-09-28).
 *
 * AGENTS.md calls the discovery journeys "the site's signature content" and a first-class editorial
 * product. Measured on live, no paper page linked its own: /papers/special-relativity/,
 * /papers/light-quanta/, /papers/brownian-motion/ and /papers/mass-energy/ each carried exactly one
 * /discover/ link and it was the index, from the global nav. The route links BACK to the papers, so
 * the arrow ran one way, which is the same shape the teaching tapes were in until this week.
 *
 * THE LABEL IS AGENTS.md'S OWN. A discovery journey is "a route you could take", never "what
 * Einstein thought", and the eyebrow says so rather than inviting the reader to believe they are
 * retracing him. The line under it is the route's OWN opening sentence, authored in
 * src/discovery/routeIndex.ts, not a summary written here: "A magnet, a coil, and a needle that
 * moves." does the work, and anything I wrote instead would be a second voice describing the first.
 *
 * Renders nothing for a paper with no route, so the companion dissertation is unaffected. A server
 * component reading a frozen array: no JavaScript ships and the link is a real anchor.
 */
export function PaperDiscovery({ paperId }: { readonly paperId: string }) {
  const route = ROUTE_INDEX.find((entry) => entry.slug === paperId);
  if (!route) return null;
  // The first sentence of the authored blurb. Split on a full stop followed by a space so an
  // abbreviation inside the sentence does not truncate it; if that finds nothing, show none rather
  // than a fragment.
  const opening = route.blurb.split(/(?<=\.)\s/)[0]?.trim() ?? "";
  return (
    <nav
      className="actions paper-discovery no-print"
      // Named by paper: one page carries one of these, but the landmark-name gate requires every
      // nav on a page to be distinguishable and a generic label would collide the day a second
      // route appears on one page.
      aria-label={`A route you could take through ${route.name}`}
    >
      <span className="eyebrow">A route you could take</span>
      <a className="button secondary" href={`/discover/${route.slug}/`}>
        {route.name}, in {route.steps.length} steps
      </a>
      {opening ? <p className="paper-discovery-opening">{opening}</p> : null}
    </nav>
  );
}
