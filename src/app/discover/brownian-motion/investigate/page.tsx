import type { Metadata } from "next";
import { BrownianInvestigation } from "../../../../components/discover/BrownianInvestigation.tsx";
import tracerExample from "../../../../generated/bm01-example.json";
import spreadExample from "../../../../generated/bm06-example.json";

export const metadata: Metadata = { title: "Investigate Brownian motion: from a trial to a probability" };

export default function BrownianInvestigationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Discover · Brownian motion · Guided investigation</p>
        <h1>One trial. Two questions. Evidence you can keep.</h1>
        <p className="lead">Choose what to measure, compare observation intervals on the same recorded
          trial, and carry its diffusion coefficient into an interval-probability question.</p>
        <p>This is a synthetic, host-calculated investigation using the existing tracer and spreading
          laboratories. It is not a reconstruction of Einstein’s private thoughts or a historical measurement.</p>
        <div className="actions">
          <a href="/discover/brownian-motion/">Read the no-algebra encounter →</a>
          <a href="/papers/brownian-motion/#arg-bm-observable">Return to the paper’s argument →</a>
        </div>
      </header>
      <BrownianInvestigation tracerExample={tracerExample} spreadExample={spreadExample} />
    </>
  );
}
