import type { Metadata } from "next";
import { ROUTE_SLUGS } from "../../content/ids.ts";
import { capstoneExists, loadCapstone } from "../../discovery/capstone/loadCapstone.ts";
import "./capstones.css";

/**
 * THE FOUR CAPSTONES, LISTED (am-9p8v).
 *
 * `/capstones/` was a 404 with four pages beneath it, one of the 43 dead ends the trimmed-URL
 * ratchet measured on 2026-10-21 (`src/testing/trimmedUrlParents.test.ts`). The four pages were
 * each linked from their paper's discovery route and from /tours/, so a reader arriving by either
 * door was fine and a reader who trimmed the address was not.
 *
 * It is fourteen lines of content and no new words: each entry is the capstone record's own `title`
 * and `question`, read through `loadCapstone`, the same loader the four pages render from. A paper
 * without a record is left out rather than shown as absent, which is what `capstoneExists` is for.
 *
 * `src/app/tours/[tour]/page.tsx` carries a CAPSTONE_TITLE map that hand-copies the same four
 * titles. This page does not read it: the record is the source, and a copy that cannot be compared
 * to the record is how two pages come to give one capstone two names.
 */

export const metadata: Metadata = {
  title: "The capstones",
  description:
    "Four arguments to rebuild, one per paper: the claims in an order that does not work, and the question of which premise does the work.",
};

export default function Capstones() {
  // `capstone.paper` is the record's own, and loadCapstone refuses a record whose paper disagrees
  // with the file it was read from, so there is no second spelling of it to keep in step here.
  const capstones = ROUTE_SLUGS.filter((paper) => capstoneExists(paper)).map(
    (paper) => loadCapstone(paper).capstone,
  );

  return (
    <main className="capstone-index">
      <h1>The capstones</h1>
      <p className="capstone-index-lede">
        A capstone is the whole of one paper&rsquo;s argument laid out as claims, with the chain
        that fixes what has to come before what. The paper&rsquo;s own sequence is one arrangement
        that works, not the only one. Each is optional, and each can be printed.
      </p>
      <ol className="capstone-index-list">
        {capstones.map((capstone) => (
          <li key={capstone.paper}>
            <a href={`/capstones/${capstone.paper}/`}>
              <span className="capstone-index-title">{capstone.title}</span>
              <span className="capstone-index-question">{capstone.question}</span>
              <span className="capstone-index-count">
                {capstone.claims.length} claims, {capstone.assumptions.length} assumptions
              </span>
            </a>
          </li>
        ))}
      </ol>
      <p className="capstone-index-elsewhere">
        Each capstone is reached from its own <a href="/discover/">discovery route</a> as well,
        where the argument is rebuilt a step at a time before it is laid out whole.
      </p>
    </main>
  );
}
