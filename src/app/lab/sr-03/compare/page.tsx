import type { Metadata } from "next";
import { ObserverControlledComparison } from "../../../../components/lab/ObserverControlledComparison.tsx";
import { prepareSr03Comparisons } from "../../../../content/sr03Comparison.ts";
import example from "../../../../generated/sr03-example.json";
import catalogue from "../../../../generated/sr03-notebook-replay.json";
import { NotModeledLine } from "../../NotModeledLine.tsx";
import "../../../../experiments/compare/comparison.css";

export const metadata: Metadata = {
  title: "Same events, different observers: a controlled relativity comparison",
  description:
    "Hold two events fixed, change only the observer, and compare time, distance and length-measurement validity from the same accepted physical model.",
  alternates: { canonical: "/lab/sr-03/compare/" },
};

export default async function ObserverComparisonPage() {
  const examples = await prepareSr03Comparisons(example.sourceDigest);
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Controlled observer comparison</p>
        <h1>The same events. Different clock readings.</h1>
        <p className="lead">
          A different observer can assign different times and distances to the same events. Keep the
          events and physical setup fixed, then see why a transformed separation need not be a
          length measurement.
        </p>
      </header>
      <ObserverControlledComparison
        examples={examples}
        passage={catalogue.passages["arg-sr-rod-events"]}
      />
      <NotModeledLine instrumentId="sr-03" />
      <section className="reading">
        <h2>Changing observer and changing a measurement</h2>
        <p>
          To measure a moving rod's length, an observer reads its two ends at one time in that
          observer's frame. A pair simultaneous in K need not be simultaneous in k. Selecting a new
          simultaneous pair is a new measurement; describing the pinned pair from another frame is
          an observer change.
        </p>
        <p>
          This comparison holds the frame speed fixed. The full laboratory lets you change it as
          part of the physical setup. The squared interval in the detailed comparison is Minkowski's
          later description, from 1908, not a quantity Einstein used in this paper.
        </p>
      </section>
      <nav className="lab-onward" aria-label="From this observer comparison">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/sr-03/">
              Choose new events or change the physical setup in the full laboratory
            </a>
          </li>
          <li>
            <a href="/papers/special-relativity/#s2">
              Read §2: the relativity of lengths and times
            </a>
          </li>
          <li>
            <a href="/papers/special-relativity/#s4">Read §4: moving rods and spheres</a>
          </li>
          <li>
            <a href="/lab/bm-08/compare/">
              Compare changing a measurement while keeping a particle's path fixed
            </a>
          </li>
        </ul>
      </nav>
    </>
  );
}
