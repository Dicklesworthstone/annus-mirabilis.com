import type { DiscoveryPaperSlug } from "./journeyRegistry.ts";
import { ROUTE_INDEX } from "./routeIndex.ts";
import "./routeMap.css";

/** The anchor a journey page gives step `n`, counting from 1: "step-01". */
export function stepAnchor(n: number): string {
  return `step-${String(n).padStart(2, "0")}`;
}

/**
 * The route's steps, beside it on a wide screen and above the first step on a narrow one.
 *
 * A route runs 5,000 to 6,800px at 1440 (BUILD 15) and until 2026-09-22 offered no view of
 * itself: a reader at step 4 could not see that there were eight, or reach the shelf without
 * scrolling past the rest. The labels are the ones the /discover/ index draws, which
 * routeIndex.test.ts holds to the page's own "01 / " labels, and routeMap.test.ts holds each
 * link to a section that exists.
 */
export function RouteMap({ slug }: { slug: DiscoveryPaperSlug }) {
  const route = ROUTE_INDEX.find((r) => r.slug === slug);
  if (!route) throw new Error(`The /discover/ index has no route for "${slug}".`);
  return (
    <nav className="route-map" aria-label="Steps on this route">
      <p className="route-map-title">The route</p>
      <ol>
        {route.steps.map((label, i) => (
          <li key={label}>
            <a href={`#${stepAnchor(i + 1)}`}>
              <span className="route-map-number">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          </li>
        ))}
      </ol>
      <ul>
        <li>
          <a href="#shelf">The 1904 shelf</a>
        </li>
        <li>
          <a href="#in-the-paper">Where this enters the paper</a>
        </li>
      </ul>
    </nav>
  );
}
