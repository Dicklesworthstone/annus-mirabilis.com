import type { Metadata } from "next";
import { BrownianComparisonLab } from "../../../../components/lab/BrownianComparisonLab.tsx";
import example from "../../../../generated/bm01-comparison.json";
import replayCatalogue from "../../../../generated/notebook-replay.json";

export const metadata: Metadata = {
  title: "Hold something fixed: a controlled Brownian comparison",
  description:
    "Double the particle radius from 0.5 to 1 μm, and keep the liquid (1.35 mPa·s at 290.15 K), the observation time and the random draws.",
};
export default function BrownianComparisonPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Experiment · Brownian motion · Controlled comparison</p>
        <h1>A smaller spread. But how much smaller?</h1>
        <p className="lead">
          Double the particle radius from 0.5 to 1 μm, and keep the liquid (1.35 mPa·s at 290.15 K),
          the observation time and the random draws. Then tell what you changed from what changed as
          a consequence. It is a synthetic model calculation with modern SI constants, not
          historical measurements.
        </p>
      </header>
      <BrownianComparisonLab
        example={example}
        passage={replayCatalogue.passages["arg-bm-observable"]}
      />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/bm-01/">Full tracer laboratory</a>
          </li>
          <li>
            <a href="/discover/brownian-motion/investigate/">Guided interval investigation</a>
          </li>
          <li>
            <a href="/lab/countermodels/">Compare competing models, not just one changed input</a>
          </li>
        </ul>
      </nav>
    </>
  );
}
