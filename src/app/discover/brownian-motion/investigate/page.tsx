import type { Metadata } from "next";
import { BrownianInvestigation } from "../../../../components/discover/BrownianInvestigation.tsx";
import tracerExample from "../../../../generated/bm01-example.json";
import spreadExample from "../../../../generated/bm06-example.json";
import "../../../../discovery/investigationPage.css";

export const metadata: Metadata = {
  title: "Investigate Brownian motion: from a trial to a probability",
};

export default function BrownianInvestigationPage() {
  return (
    <article className="investigation-page">
      <header className="page-intro">
        <p className="eyebrow">Discover · Brownian motion · Guided investigation</p>
        <h1>Measure one trial at two intervals, then ask it about probability</h1>
        <p className="lead">
          Choose what to measure, compare observation intervals on the same recorded trial, and
          carry its diffusion coefficient into an interval-probability question.
        </p>
        <p>
          The trial here is synthetic: this site computes it from a model, with the tracer and
          spreading instruments. It is not a historical measurement, and not a reconstruction of
          Einstein’s private thoughts.
        </p>
        <div className="actions">
          <a href="/discover/brownian-motion/">Back to the Brownian route</a>
          <a href="/papers/brownian-motion/#arg-bm-observable">Return to the paper’s argument</a>
        </div>
      </header>
      <BrownianInvestigation tracerExample={tracerExample} spreadExample={spreadExample} />
    </article>
  );
}
