import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { RodSimultaneityLab } from "../../../components/lab/RodSimultaneityLab.tsx";
import { validateSr03Parameters } from "../../../experiments/sr03/parameters.ts";
import example from "../../../generated/sr03-example.json";

export const metadata: Metadata = {
  title: "SR-03: Rod Measurement and Simultaneity",
};

export default function RodSimultaneityPage() {
  const checked = validateSr03Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared rod simultaneity parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special Relativity · Kinematics §2 &amp; §4</p>
        <h1>
          Simultaneity is relative;
          <br />
          moving bodies contract.
        </h1>
        <p className="lead">
          How does relative motion affect the synchronization of clocks, the coordinate measurement
          of moving rods, and the shape of moving spheres?
        </p>
        <p>
          <a href="/papers/special-relativity/#s2">
            Read §2 (On the Relativity of Lengths and Times) of Einstein’s 1905 paper
          </a>
        </p>
      </header>

      <RodSimultaneityLab example={{ ...example, parameters: checked.data }} />

      <section className="reading" id="simultaneity-theory">
        <p className="eyebrow">The Physical Context</p>
        <h2>§2: The Relativity of Simultaneity</h2>
        <p>
          In §2 of <em>Zur Elektrodynamik bewegter Körper</em>, Einstein investigates a rigid rod of
          length <Formula latex="r_{AB}" /> moving with velocity <Formula latex="v" /> relative to a
          stationary frame <Formula latex="K" />. Clocks mounted at the two ends{" "}
          <Formula latex="A" /> and <Formula latex="B" /> are synchronized by light signals emitted
          from <Formula latex="A" /> at time <Formula latex="t_A" />, reflected at{" "}
          <Formula latex="B" /> at time <Formula latex="t_B" />, and returning to{" "}
          <Formula latex="A" /> at <Formula latex="t'_A" />.
        </p>
        <p>
          From the perspective of stationary observers in <Formula latex="K" />, light travels
          forward with speed <Formula latex="c - v" /> relative to the rod, and backward with speed{" "}
          <Formula latex="c + v" />:
        </p>
        <Formula
          latex={String.raw`t_B - t_A = \frac{r_{AB}}{c - v}, \qquad t'_A - t_B = \frac{r_{AB}}{c + v}`}
        />
        <p>
          Because <Formula latex="t_B - t_A \neq t'_A - t_B" />, observers in <Formula latex="K" />{" "}
          judge the moving clocks to be desynchronized:
        </p>
        <blockquote>
          &ldquo;We see that we cannot attach any absolute meaning to the concept of simultaneity,
          but that two events which, viewed from a system of coordinates, are simultaneous, can no
          longer be viewed as simultaneous events when viewed from a system which is in motion
          relative to that system.&rdquo;
        </blockquote>

        <h2>§4: Physical Meaning of Moving Rods and Spheres</h2>
        <p>
          In §4, Einstein uses the Lorentz transformation to determine the coordinate dimensions of
          moving bodies measured simultaneously in the observer’s frame:
        </p>
        <Formula latex={String.raw`x' = \gamma (x - v t) = \frac{x - v t}{\sqrt{1 - v^2/c^2}}`} />
        <p>
          Taking positions of both ends at <strong>one time of the stationary frame</strong> (
          <Formula latex="\Delta t = 0" />) yields a measured coordinate length:
        </p>
        <Formula
          latex={String.raw`\Delta x = \Delta x' \sqrt{1 - \frac{v^2}{c^2}} = \frac{L_0}{\gamma}`}
        />
        <p>
          Similarly, a rigid sphere of radius <Formula latex="R" /> at rest in <Formula latex="k" />{" "}
          whose surface satisfies <Formula latex="(\xi - \xi_0)^2 + \eta^2 + \zeta^2 = R^2" />, when
          measured at <Formula latex="t = 0" /> from the stationary system, is an ellipsoid of
          revolution with semi-axes:
        </p>
        <Formula latex={String.raw`a = R \sqrt{1 - \frac{v^2}{c^2}}, \qquad b = R, \qquad c = R`} />

        <h2>Coordinate Measurement Versus Visual Appearance</h2>
        <p>
          Einstein’s length contraction describes <em>coordinate measurement</em> (positions
          recorded simultaneously in the measuring frame by a network of synchronized clocks). It is
          not what a human eye or camera sees. An optical image collects light rays that arrive at
          the shutter at the same instant, which left different parts of the moving object at
          different past times (Terrell-Penrose effect, 1959), causing a moving sphere to appear
          visually rotated rather than flattened.
        </p>

        <h2>Invariant Spacetime Intervals and Causal Order</h2>
        <p>
          Between any two events <Formula latex="E_1" /> and <Formula latex="E_2" />, the squared
          spacetime interval is strictly invariant under all Lorentz transformations:
        </p>
        <Formula
          latex={String.raw`s^2 = \Delta x^2 + \Delta y^2 + \Delta z^2 - c^2 \Delta t^2 = \Delta x'^2 + \Delta y'^2 + \Delta z'^2 - c^2 \Delta t'^2`}
        />
        <p>
          When <Formula latex="s^2 < 0" /> (timelike) or <Formula latex="s^2 = 0" /> (lightlike), a
          subluminal or light signal can causally connect the events, and their chronological order
          is invariant across all inertial frames. When <Formula latex="s^2 > 0" /> (spacelike), no
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
