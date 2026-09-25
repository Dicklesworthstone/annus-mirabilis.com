import { NotModeledLine } from "../NotModeledLine.tsx";
import "./walks.css";
import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { WalkComparison } from "../../../components/lab/WalkLab.tsx";
import { validateBm05Parameters } from "../../../experiments/bm05/parameters.ts";
import example from "../../../generated/bm05-example.json";
export const metadata: Metadata = {
  title: "From random steps to diffusion",
  description:
    "Begin with a coin walk you can count exactly. Change the shape of each step without changing its variance.",
};
export default function WalkPage() {
  const checked = validateBm05Parameters(example.parameters);
  if (checked.kind !== "accepted") throw new Error("The prepared walk parameters are invalid.");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · The distribution argument</p>
        <h1>
          <span>Different steps.</span> <span>The same spreading law?</span>
        </h1>
        <p className="lead">
          Begin with a coin walk you can count exactly. Change the shape of each step without
          changing its variance. Then see what adding many independent steps preserves, and which
          assumptions the argument needs.
        </p>
      </header>
      <WalkComparison example={{ ...example, parameters: checked.data }} />
      <NotModeledLine instrumentId="bm-05" />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/discover/brownian-motion/">Start with the no-algebra encounter</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-independent-steps">
              Read the argument and open its missing steps
            </a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="derivation">
        <p className="eyebrow">Open the argument</p>
        <h2>Why the second moment survives</h2>
        <p>
          Write a walker’s position after n steps as the sum of its displacements. A symmetric step
          has zero mean. Independence makes the cross terms in the square average to zero; the n
          individual squared steps remain.
        </p>
        <Formula
          latex={String.raw`\begin{gathered}x_n=\sum_{j=1}^{n}\Delta_j, \\ \langle\Delta\rangle=0, \\ \langle x_n^2\rangle=n\langle\Delta^2\rangle\end{gathered}`}
        />
        <p>
          With one step every τ seconds, elapsed time is nτ. The coefficient connecting mean square
          with time is therefore fixed by the variance of one step divided by twice its interval.
        </p>
        <Formula
          latex={String.raw`\begin{gathered}D=\frac{\langle\Delta^2\rangle}{2\tau}, \\ \langle x^2\rangle=2Dt, \\ \sqrt{\langle x^2\rangle}\propto\sqrt{t}\end{gathered}`}
        />
        <h2>From a finite jump to a continuous density</h2>
        <p>
          The next position distribution is the old one shifted by every allowed step, weighted by
          the probability of that step. Expanding the shifted density explains the role of symmetry:
          the first-order spatial term vanishes, and the second-order term contains the same
          coefficient.
        </p>
        <Formula
          latex={String.raw`\begin{aligned}& p(x,t+\tau) \\ &\qquad = \int p(x-\Delta,t)\varphi(\Delta)\,d\Delta\end{aligned}`}
        />
        <Formula
          latex={String.raw`\frac{\partial p}{\partial t}=D\frac{\partial^2p}{\partial x^2}`}
        />
        <p>
          This continuous equation is a limiting description, not an assertion that four discrete
          jumps already have a continuous Gaussian distribution. The shape gap in the laboratory
          makes that distinction visible. A biased mean leaves a drift term; an infinite variance
          does not supply the finite second-order coefficient used here.
        </p>
        <h2>A calculation is not an observation</h2>
        <p>
          Agreement between the synthetic walks and their limiting law tests the numerical
          implementation of the assumptions. It does not establish that a real suspension satisfies
          them. This is a modern explanation of the argument.
        </p>
        <div className="actions">
          <a className="button" href="/lab/bm-06/">
            Open the spreading laboratory
          </a>
          <a href="/lab/bm-01/">Return to the tracer ensemble</a>
        </div>
      </section>
    </>
  );
}
