import type { Metadata } from "next";
import { BrownianComparisonLab } from "../../../../components/lab/BrownianComparisonLab.tsx";
import replayCatalogue from "../../../../generated/notebook-replay.json";
import example from "../../../../generated/bm01-comparison.json";

export const metadata: Metadata = {
  title: "Hold something fixed: a controlled Brownian comparison",
};
export default function BrownianComparisonPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Experiment · Brownian motion · Controlled comparison</p>
        <h1>A smaller spread. But how much smaller?</h1>
        <p className="lead">
          Double the particle radius without changing the liquid, temperature, observation time or
          random draws. Then distinguish what you changed from what changed as a consequence.
        </p>
        <p>
          The worked comparison uses 290.15 K, viscosity 1.35 mPa·s, and radii 0.5 and 1 micrometre,
          with explicitly modern SI constants. It is a synthetic model calculation, not historical
          measurements.
        </p>
        <div className="actions">
          <a href="/lab/bm-01/">Full tracer laboratory</a>
          <a href="/discover/brownian-motion/investigate/">Guided interval investigation</a>
          <a href="/lab/countermodels/">
            Next: compare competing models, not just one changed input
          </a>
        </div>
      </header>
      <BrownianComparisonLab example={example} passage={replayCatalogue.passages["arg-bm-observable"]} />
    </>
  );
}
