import type { Metadata } from "next";
import { withScripts } from "../../../../components/lab/subscripts.tsx";
import generated from "../../../../generated/countermodels.json";
import { INDEPENDENCE_CAPTION } from "../../../../reasoning/independence/caption.ts";
import { IndependenceWorkbench } from "../../../../reasoning/independence/IndependenceWorkbench.tsx";
import { createOccupancyState } from "../../../../reasoning/independence/state.ts";

export const metadata: Metadata = {
  title: "Does the same average imply independent positions?",
  description:
    "Compare independent and perfectly locked positions, choose a distinguishing measurement, and test a local count record without treating model predictions as historical data.",
  alternates: { canonical: "/lab/countermodels/independence/" },
};

export default function IndependencePage() {
  // Reuse the existing countermodel generator's publication decision; numerical
  // validation does not promote a draft case into a reviewed release.
  if (generated.profile !== "scaffold")
    return (
      <section className="reading">
        <h1>Independence comparison in preparation</h1>
        <p>
          This publication profile does not include the explanatory draft.{" "}
          <a href="/papers/light-quanta/">Return to the light-quanta paper</a>.
        </p>
      </section>
    );
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Reasoning laboratory · Preview</p>
        <h1>The same average can hide different arrangements.</h1>
        <p className="lead">
          Seeing half the points inside on average does not tell you whether they were placed
          independently. Keep the point count and region fixed, and compare points placed one by one
          with points locked to a single shared position.
        </p>
      </header>
      <IndependenceWorkbench example={createOccupancyState()} />
      <section className="lab-readings" aria-label="The comparison in words">
        <p data-detail="0">{withScripts(INDEPENDENCE_CAPTION.r0)}</p>
        <p data-detail="1">{withScripts(INDEPENDENCE_CAPTION.r1)}</p>
        <p data-detail="2" hidden>
          {withScripts(INDEPENDENCE_CAPTION.r2)}
        </p>
        <p data-detail="3" hidden>
          {withScripts(INDEPENDENCE_CAPTION.r3)}
        </p>
      </section>
      <section className="reading">
        <h2>Which premise earns the exponent?</h2>
        <p>
          These are two explicit ideal candidates, not every possible form of correlation. The
          comparison calculates predictions and can analyze a count record you enter. It does not
          produce historical observations.
        </p>
        <p>
          The light-quanta paper’s §5 counts independently placed points. The chance that every one
          lies in a fraction f of the original volume is f<sup>n</sup>. One perfectly locked group
          has only one placement to make, so its corresponding probability is f. The logarithm turns
          this difference into an entropy coefficient.
        </p>
        <p>
          In the Brownian configuration argument, independently placed units likewise determine the
          power of available volume. Constituents locked into one ideal point-like unit do not
          acquire independent placements merely because you can count several labels.
        </p>
        <p>
          Try keeping only the mean, then add the all-inside probability or the variance. Finally
          set n to one, or choose the empty or whole region: a useful measurement can cease to
          distinguish the candidates in a degenerate case.
        </p>
        <p>
          Rejecting perfect locking does not establish every independence assumption. Finite-size
          clusters, partial correlations, measurement errors and time dependence need other models.
          Real measurements must specify those conditions and their uncertainty.
        </p>
        <nav className="actions" aria-label="Continue the independence argument">
          <a href="/lab/lq-05/">Count independent configurations</a>
          <a href="/lab/bm-03/">From configuration counts to osmotic pressure</a>
          <a href="/papers/light-quanta/#s5">Light-quanta paper, §5</a>
          <a href="/papers/brownian-motion/view/german/#s2">
            Brownian configuration argument, §2 in the German original
          </a>
          <a href="/lab/countermodels/">Compare the relativity countermodels</a>
        </nav>
        <details>
          <summary>Inspect the numerical owners</summary>
          <p>
            The same binomial and locked-probability functions serve this comparison and LQ-05. The
            workbench projects their results; its controls do not implement a second probability
            law.
          </p>
          <p>
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/radiation/configurationCounts.ts">
              Configuration-count source
            </a>
            {" · "}
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/configurationCountermodels.ts">
              Prediction and likelihood source
            </a>
          </p>
        </details>
      </section>
    </>
  );
}
