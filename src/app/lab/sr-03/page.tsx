import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { RodSimultaneityLab } from "../../../components/lab/RodSimultaneityLab.tsx";
import { validateSr03Parameters } from "../../../experiments/sr03/parameters.ts";
import example from "../../../generated/sr03-example.json";

export const metadata: Metadata = {
  title: "Rod measurement and simultaneity",
  description:
    "How does relative motion affect the synchronization of clocks, the coordinate measurement of moving rods, and the shape of moving spheres?",
};

export default function RodSimultaneityPage() {
  const checked = validateSr03Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared rod simultaneity parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="sr-03" />
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
          length <LabInlineFormula lab="sr-03" latex="r_{AB}" /> moving with velocity{" "}
          <LabInlineFormula lab="sr-03" latex="v" /> relative to a stationary frame{" "}
          <LabInlineFormula lab="sr-03" latex="K" />. Clocks mounted at the two ends{" "}
          <LabInlineFormula lab="sr-03" latex="A" /> and <LabInlineFormula lab="sr-03" latex="B" />{" "}
          are synchronized by light signals emitted from <LabInlineFormula lab="sr-03" latex="A" />{" "}
          at time <LabInlineFormula lab="sr-03" latex="t_A" />, reflected at{" "}
          <LabInlineFormula lab="sr-03" latex="B" /> at time{" "}
          <LabInlineFormula lab="sr-03" latex="t_B" />, and returning to{" "}
          <LabInlineFormula lab="sr-03" latex="A" /> at{" "}
          <LabInlineFormula lab="sr-03" latex="t'_A" />.
        </p>
        <p>
          From the perspective of stationary observers in <LabInlineFormula lab="sr-03" latex="K" />
          , light travels forward with speed <LabInlineFormula lab="sr-03" latex="c - v" /> relative
          to the rod, and backward with speed <LabInlineFormula lab="sr-03" latex="c + v" />:
        </p>
        <LabFormula
          lab="sr-03"
          latex={String.raw`\begin{gathered}t_B - t_A = \frac{r_{AB}}{c - v}, \\ t'_A - t_B = \frac{r_{AB}}{c + v}\end{gathered}`}
        />
        <p>
          The two times differ, <LabInlineFormula lab="sr-03" latex="t_B - t_A \neq t'_A - t_B" />.
          So observers riding with the rod, applying the test of §1, find the two clocks out of
          step, while observers at rest in <LabInlineFormula lab="sr-03" latex="K" /> declare them
          synchronous. Einstein draws the conclusion at the end of §2: simultaneity has no absolute
          meaning. Two events that are simultaneous as seen from one system of coordinates are not
          simultaneous as seen from a system moving relative to it.
        </p>

        <h2>§4: physical meaning of moving rods and spheres</h2>
        <p>
          In §4, Einstein uses the transformation he derived in §3 to find the dimensions of a
          moving body, measured at one time of the observer’s frame:
        </p>
        <LabFormula
          lab="sr-03"
          latex={String.raw`x' = \gamma (x - v t) = \frac{x - v t}{\sqrt{1 - v^2/c^2}}`}
        />
        <p>
          Taking positions of both ends at <strong>one time of the stationary frame</strong> (
          <LabInlineFormula lab="sr-03" latex="\Delta t = 0" />) yields a measured coordinate
          length:
        </p>
        <LabFormula
          lab="sr-03"
          latex={String.raw`\Delta x = \Delta x' \sqrt{1 - \frac{v^2}{c^2}} = \frac{L_0}{\gamma}`}
        />
        <p>
          Similarly, a rigid sphere of radius <LabInlineFormula lab="sr-03" latex="R" /> at rest in{" "}
          <LabInlineFormula lab="sr-03" latex="k" />, centred at its origin, has the surface{" "}
          <LabInlineFormula lab="sr-03" latex="\xi^2 + \eta^2 + \zeta^2 = R^2" />. Measured at{" "}
          <LabInlineFormula lab="sr-03" latex="t = 0" /> from the stationary system, it is an
          ellipsoid of revolution with semi-axes:
        </p>
        <LabFormula
          lab="sr-03"
          latex={String.raw`R \sqrt{1 - \frac{v^2}{c^2}}, \qquad R, \qquad R`}
        />

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
          This is a later way of stating the same facts, from Minkowski&rsquo;s lecture of 1908
          rather than the paper. Between any two events <LabInlineFormula lab="sr-03" latex="E_1" />{" "}
          and <LabInlineFormula lab="sr-03" latex="E_2" />, the squared interval is the same in
          every inertial frame:
        </p>
        <LabFormula
          lab="sr-03"
          latex={String.raw`\begin{aligned}s^2 &= \Delta x^2 + \Delta y^2 + \Delta z^2 - c^2 \Delta t^2 \\ &= \Delta x'^2 + \Delta y'^2 + \Delta z'^2 - c^2 \Delta t'^2\end{aligned}`}
        />
        <p>
          When <LabInlineFormula lab="sr-03" latex="s^2 < 0" /> (timelike) or{" "}
          <LabInlineFormula lab="sr-03" latex="s^2 = 0" /> (lightlike), a subluminal or light signal
          can causally connect the events, and their chronological order is invariant across all
          inertial frames. When <LabInlineFormula lab="sr-03" latex="s^2 > 0" /> (spacelike), no
          signal can connect them, and observers in different states of relative motion disagree on
          which event occurred first.
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
