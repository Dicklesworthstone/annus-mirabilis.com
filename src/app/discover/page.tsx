import type { Metadata } from "next";
import Image from "next/image";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import "../../components/home/firstPages.css";
import {
  isWrittenDiscoveryRoute,
  UNWRITTEN_DISCOVERY_ROUTES,
  WRITTEN_DISCOVERY_ROUTES,
} from "../../discovery/journeyRegistry.ts";
import { ROUTE_INDEX as ROUTES } from "../../discovery/routeIndex.ts";
import "../papers/papersIndex.css";
import "./discover.css";

const SPELLED = ["no", "One", "Two", "Three", "Four"] as const;

/** Total by construction: a fifth paper would read "5" rather than crash or read "undefined". */
function spelled(n: number): string {
  return SPELLED[n] ?? String(n);
}

/** The plant that removed a route from the declaration produced "One routes are written". */
function plural(n: number): string {
  return n === 1 ? "route is" : "routes are";
}

/** For a clause whose noun is elided: "the other one IS", "the other two ARE". */
function isAre(n: number): string {
  return n === 1 ? "is" : "are";
}
const WRITTEN_COUNT = WRITTEN_DISCOVERY_ROUTES.length;
const UNWRITTEN_COUNT = UNWRITTEN_DISCOVERY_ROUTES.length;

export const metadata: Metadata = {
  title: "Discovery routes",
  // With every route written this read "Four routes are written; the other no are not yet.",
  // the sentence search results showed. The count clause now appears only while it is true.
  description: `Reconstructions of the problems the 1905 papers answer, worked from what was on the shelf at the end of 1904.${UNWRITTEN_COUNT > 0 ? ` ${spelled(WRITTEN_COUNT)} ${plural(WRITTEN_COUNT)} written; the other ${spelled(UNWRITTEN_COUNT).toLowerCase()} ${isAre(UNWRITTEN_COUNT)} not yet.` : ""}`,
};

/**
 * The /discover index (TanElk's nav call, 2026-09-22): the one page that names all four routes.
 *
 * NOT DRIVEN FROM journeyRegistry.ts's Journey records. The registry's one record is
 * FIXTURE_JOURNEY_BROWNIAN, from src/discovery/testing/, and it describes a different artefact
 * from the page (1 stage against the page's five steps). Its counts and its `firstHonestQuestion`
 * would advertise a shape the reader does not meet. So the copy below describes the PAGES, as
 * measured on BUILD 8 (steps are each page's numbered `step-number` labels; instruments are the
 * distinct /lab/ routes it links):
 *
 *   light-quanta         7 steps   9 instruments
 *   brownian-motion      5 steps   4 instruments
 *   special-relativity   8 steps   8 instruments
 *   mass-energy          5 steps   2 instruments (me-02, and sr-10 for the one 1905 import)
 *
 * Only the written/unwritten split comes from the registry, through isWrittenDiscoveryRoute.
 */

export default function DiscoverIndex() {
  const plates = loadFirstPages();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">A route you could take</p>
        <h1>Discovery routes</h1>
        <p className="lead">
          Each route puts you where a careful reader stood at the end of 1904: holding the results
          already in print, facing an observation that does not fit them, and not yet knowing which
          way the answer lies. You make each move yourself, and the paper comes at the end, at the
          passage where it makes the same move.
        </p>
        <p>
          A route is one way to reach the argument from what was known at the time. Each says at its
          start that it is a reconstruction, and none claims to be how Einstein thought.
        </p>
      </header>

      <ol className="paper-index route-index">
        {ROUTES.map((route) => {
          const plate = plates.find((p) => p.slug === route.slug);
          return (
            <li key={route.slug} className="paper-entry">
              {plate && (
                <div className="paper-entry-plate">
                  <Image
                    src={`/figures/plates/${plate.key}-first-page-400.webp`}
                    width={400}
                    height={662}
                    alt={`First page of ${plate.title}, as printed`}
                  />
                  <p className="fine">
                    <span className="first-page-marks" aria-hidden="true">
                      {Array.from({ length: plate.pages }, (_, n) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: the marks are identical and never reorder
                        <i key={n} />
                      ))}
                    </span>
                    {/* No break inside the range: "pp. 132–" and "148" split across lines at 390. */}
                    {plate.pages} pages, pp.&nbsp;{plate.firstPage}&#8288;&ndash;&#8288;
                    {plate.lastPage}
                  </p>
                </div>
              )}
              <div className="paper-entry-body">
                <p className="eyebrow">
                  {isWrittenDiscoveryRoute(route.slug) ? "" : "Not written yet · "}
                  {plate ? `Received ${dayAndMonth(plate.received)} 1905` : null}
                </p>
                <p className="german-title" lang="de">
                  {route.germanTitle}
                </p>
                <h2>
                  <a href={`/discover/${route.slug}/`}>{route.name}</a>
                </h2>
                <p>{route.blurb}</p>
                <ol className="route-steps" aria-label={`The ${route.steps.length} steps`}>
                  {route.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="route-steps-end">Where this enters the paper</p>
                <div className="actions">
                  <a className="button" href={`/discover/${route.slug}/`}>
                    Take this route
                  </a>
                  <a href={`/papers/${route.slug}/`}>Read the paper instead</a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/*
        THE TERMINAL STATE HAD NO COPY WRITTEN FOR IT, and the page reached it today.
        When special-relativity landed, UNWRITTEN_COUNT went to 0 and this section still rendered
        unconditionally: spelled(0) is "no", so the heading read "no routes not written yet" above
        a paragraph describing a set with nothing in it, followed by an empty
        <section className="journey-catalogue"> where the last card had been.

        A data-driven page still needs copy for every value its data can take. The count became
        correct and the sentence around it did not.
      */}
      {UNWRITTEN_COUNT > 0 && (
        <section className="reading page-flush">
          <h2>
            {spelled(UNWRITTEN_COUNT)} {plural(UNWRITTEN_COUNT)} not written yet
          </h2>
          <p>
            Each of these papers has its reading edition and its instruments. What is missing is the
            reconstruction: the shelf, the difficulty, and the fork where a reasonable person could
            have gone the other way. Until that is written, the paper itself is the better door.
          </p>
        </section>
      )}
    </>
  );
}
