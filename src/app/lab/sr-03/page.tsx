import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { InlineFormula } from "../../../components/lab/InlineFormula.tsx";
import { RodSimultaneityLab } from "../../../components/lab/RodSimultaneityLab.tsx";
import { validateSr03Parameters } from "../../../experiments/sr03/parameters.ts";
import example from "../../../generated/sr03-example.json";

export const metadata: Metadata = {
  title: "Rod measurement and simultaneity",
};

export default function RodSimultaneityPage() {
  const checked = validateSr03Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared rod simultaneity parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Kinematics §2 &amp; §4</p>
        <h1>
          <span>Simultaneity is relative;</span> <span>moving bodies contract.</span>
        </h1>
        <p className="lead">
          How does relative motion affect the synchronization of clocks, the coordinate measurement
          of moving rods, and the shape of moving spheres?
        </p>
      </header>

      <RodSimultaneityLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s2">
              {" "}
              Read §2 (On the Relativity of Lengths and Times) of Einstein’s 1905 paper{" "}
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="simultaneity-theory">
        <p className="eyebrow">The physical context</p>
        <h2>§2: the relativity of simultaneity</h2>
        <p>
          In §2 of <em>Zur Elektrodynamik bewegter Körper</em>, Einstein investigates a rigid rod of
          length <InlineFormula latex="r_{AB}" /> moving with velocity <InlineFormula latex="v" />{" "}
          relative to a stationary frame <InlineFormula latex="K" />. Clocks mounted at the two ends{" "}
          <InlineFormula latex="A" /> and <InlineFormula latex="B" /> are synchronized by light
          signals emitted from <InlineFormula latex="A" /> at time <InlineFormula latex="t_A" />,
          reflected at <InlineFormula latex="B" /> at time <InlineFormula latex="t_B" />, and
          returning to <InlineFormula latex="A" /> at <InlineFormula latex="t'_A" />.
        </p>
        <p>
          From the perspective of stationary observers in <InlineFormula latex="K" />, light travels
          forward with speed <InlineFormula latex="c - v" /> relative to the rod, and backward with
          speed <InlineFormula latex="c + v" />:
        </p>
        <Formula
          latex={String.raw`t_B - t_A = \frac{r_{AB}}{c - v}, \qquad t'_A - t_B = \frac{r_{AB}}{c + v}`}
        />
        <p>
          Because <InlineFormula latex="t_B - t_A \neq t'_A - t_B" />, observers in{" "}
          <InlineFormula latex="K" /> judge the moving clocks to be desynchronized:
        </p>
        <blockquote>
          &ldquo;We see that we cannot attach any absolute meaning to the concept of simultaneity,
          but that two events which, viewed from a system of coordinates, are simultaneous, can no
          longer be viewed as simultaneous events when viewed from a system which is in motion
          relative to that system.&rdquo;
        </blockquote>

        <h2>§4: physical meaning of moving rods and spheres</h2>
        <p>
          In §4, Einstein uses the Lorentz transformation to determine the coordinate dimensions of
          moving bodies measured simultaneously in the observer’s frame:
        </p>
        <Formula latex={String.raw`x' = \gamma (x - v t) = \frac{x - v t}{\sqrt{1 - v^2/c^2}}`} />
        <p>
          Taking positions of both ends at <strong>one time of the stationary frame</strong> (
          <InlineFormula latex="\Delta t = 0" />) yields a measured coordinate length:
        </p>
        <Formula
          latex={String.raw`\Delta x = \Delta x' \sqrt{1 - \frac{v^2}{c^2}} = \frac{L_0}{\gamma}`}
        />
        <p>
          Similarly, a rigid sphere of radius <InlineFormula latex="R" /> at rest in{" "}
          <InlineFormula latex="k" /> whose surface satisfies{" "}
          <InlineFormula latex="(\xi - \xi_0)^2 + \eta^2 + \zeta^2 = R^2" />, when measured at{" "}
          <InlineFormula latex="t = 0" /> from the stationary system, is an ellipsoid of revolution
          with semi-axes:
        </p>
        <Formula latex={String.raw`a = R \sqrt{1 - \frac{v^2}{c^2}}, \qquad b = R, \qquad c = R`} />

        <h2>Coordinate measurement versus visual appearance</h2>
        <p>
          Einstein’s length contraction describes <em>coordinate measurement</em> (positions
          recorded simultaneously in the measuring frame by a network of synchronized clocks). It is
          not what a human eye or camera sees. An optical image collects light rays that arrive at
          the shutter at the same instant, which left different parts of the moving object at
          different past times (Terrell-Penrose effect, 1959), causing a moving sphere to appear
          visually rotated rather than flattened.
        </p>

        <h2>Invariant spacetime intervals and causal order</h2>
        <p>
          Between any two events <InlineFormula latex="E_1" /> and <InlineFormula latex="E_2" />,
          the squared spacetime interval is strictly invariant under all Lorentz transformations:
        </p>
        <Formula
          latex={String.raw`s^2 = \Delta x^2 + \Delta y^2 + \Delta z^2 - c^2 \Delta t^2 = \Delta x'^2 + \Delta y'^2 + \Delta z'^2 - c^2 \Delta t'^2`}
        />
        <p>
          When <InlineFormula latex="s^2 < 0" /> (timelike) or <InlineFormula latex="s^2 = 0" />{" "}
          (lightlike), a subluminal or light signal can causally connect the events, and their
          chronological order is invariant across all inertial frames. When{" "}
          <InlineFormula latex="s^2 > 0" /> (spacelike), no signal can connect them, and observers
          in different states of relative motion disagree on which event occurred first.
        </p>

        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s2">
            Read §2 of the Special Relativity Paper
          </a>
          <a href="/papers/special-relativity/#s4">Read §4 (Physical Meaning of Moving Bodies)</a>
        </div>
      </section>
    </>
  );
}
