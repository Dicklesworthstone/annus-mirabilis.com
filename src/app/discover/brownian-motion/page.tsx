import type { Metadata } from "next";
import {
  ExercisePart,
  type ExpressionExercisePart,
} from "../../../components/discover/ExercisePart.tsx";
import { Formula } from "../../../components/edition/Formula.tsx";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import type { KnowledgeCard } from "../../../discovery/cards/types.ts";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { StepDoor, StepDoors } from "../../../discovery/StepDoor.tsx";

export const metadata: Metadata = { title: "A first encounter with Brownian motion" };

const BROWNIAN_SHELF_CARDS: readonly KnowledgeCard[] = [
  {
    id: "brown-1828-microscopical-observations",
    proposition:
      "Fragments from within pollen grains, and inorganic particles suspended in water, move irregularly without dying away.",
    status: "available",
    sources: [
      {
        title: "A brief account of microscopical observations",
        date: "1828",
        locator: "Phil. Mag. 4 (1828) 161",
      },
    ],
    date: {
      earliest: "1828",
      latest: "1828",
      precision: "year",
      latestYear: 1828,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "performed",
      earliest: "1827",
      latest: "1827",
      precision: "year",
    },
    admittedStages: ["stage-01", "stage-02"],
  },
  {
    id: "stokes-1851-sphere-drag",
    proposition:
      "A sphere of radius a moving slowly at speed v through a liquid of viscosity η is held back by a force F = 6πηav.",
    status: "available",
    sources: [{ title: "Trans. Camb. Phil. Soc. 9", locator: "p. 8", date: "1851" }],
    date: {
      earliest: "1851",
      latest: "1851",
      precision: "year",
      latestYear: 1851,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "fick-1855-diffusion-equation",
    proposition:
      "Dissolved matter moves down its concentration gradient at a rate proportional to the gradient; with conservation of matter this gives a diffusion equation for the concentration.",
    status: "available",
    sources: [{ title: "Ann. Phys. (Pogg.) 94", locator: "p. 59", date: "1855" }],
    date: {
      earliest: "1855",
      latest: "1855",
      precision: "year",
      latestYear: 1855,
      eventKind: "published",
    },
    admittedStages: ["stage-03"],
  },
  {
    id: "maxwell-1860-equipartition",
    proposition:
      "In a gas in thermal equilibrium every kind of molecule has the same mean kinetic energy of translation, whatever its mass, and that mean is proportional to the absolute temperature.",
    status: "available",
    sources: [{ title: "Phil. Mag. 19", locator: "p. 19", date: "1860" }],
    date: {
      earliest: "1860",
      latest: "1879",
      precision: "range",
      latestYear: 1879,
      eventKind: "published",
    },
    admittedStages: ["stage-01", "stage-02"],
  },
  {
    id: "gouy-1888-brownian-motion",
    proposition:
      "The motion is intrinsic and persistent; faster for smaller particles and in warmer, less viscous liquids.",
    status: "available",
    sources: [{ title: "J. Phys. Théor. Appl. (2) 7", locator: "p. 561", date: "1888" }],
    date: {
      earliest: "1888",
      latest: "1888",
      precision: "year",
      latestYear: 1888,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "exner-1900-particle-speeds",
    proposition:
      "Exner timed the particles over short intervals; their apparent speeds came out far below the speeds kinetic theory gives molecules.",
    status: "available",
    sources: [{ title: "Ann. Phys. (4) 2", locator: "p. 843", date: "1900" }],
    date: {
      earliest: "1900",
      latest: "1900",
      precision: "year",
      latestYear: 1900,
      eventKind: "published",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "siedentopf-1903-ultramicroscope",
    proposition:
      "Siedentopf and Zsigmondy's ultramicroscope lights colloidal particles from the side, so particles smaller than a micron show as bright points on a dark field.",
    status: "available",
    sources: [{ title: "Ann. Phys. (4) 10", locator: "p. 1", date: "1903" }],
    date: {
      earliest: "1903",
      latest: "1903",
      precision: "year",
      latestYear: 1903,
      eventKind: "published",
    },
    priorEvent: {
      eventKind: "performed",
      earliest: "1902",
      latest: "1902",
      precision: "year",
    },
    admittedStages: ["stage-01"],
  },
  {
    id: "sutherland-1904-dunedin",
    proposition:
      "William Sutherland presents a formula for the diffusion of a sphere through a liquid, with a correction for slip at its surface, at Dunedin in January 1904.",
    status: "available",
    sources: [
      {
        title: "Australasian Association for the Advancement of Science",
        locator: "Dunedin Meeting",
        date: "1904",
      },
    ],
    date: {
      earliest: "1904-01",
      latest: "1904-01",
      precision: "month",
      latestYear: 1904,
      eventKind: "presented",
    },
    relatedCardId: "sutherland-1905-phil-mag",
    admittedStages: ["stage-03"],
  },
  {
    id: "sutherland-1905-phil-mag",
    proposition:
      "Sutherland's diffusion formula, with its slip correction, is published in the Philosophical Magazine.",
    status: "parallel-work",
    parallelWorkBasis:
      "The June 1905 Philosophical Magazine publication falls between Annalen's receipt of Einstein's paper on 11 May 1905 and its publication on 18 July 1905.",
    sources: [{ title: "Phil. Mag. (6) 9", locator: "p. 781", date: "1905" }],
    date: {
      earliest: "1905-06",
      latest: "1905-06",
      precision: "month",
      latestYear: 1905,
      eventKind: "published",
    },
    relatedCardId: "sutherland-1904-dunedin",
    admittedStages: ["stage-03"],
  },
];

const DISPLACEMENT_SCALE_EXERCISE: ExpressionExercisePart = {
  id: "bm-displacement-scale-rewrite",
  prompt:
    "Along one axis the mean square displacement is 2·D·t. Watch the same particle in the plane, moving along x and y independently. What is its root mean square distance from the start?",
  declaredNames: ["D", "t"],
  domains: {
    D: { min: 1e-14, max: 1e-10, scale: "log" },
    t: { min: 0.1, max: 100, scale: "log" },
  },
  referenceSource: "2*sqrt(D*t)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  workedExplanation:
    "The squared distance from the start is x² + y². Each axis contributes a mean square of 2·D·t, independently, so the mean square distance is 4·D·t, and its root is sqrt(4·D·t) = 2·sqrt(D·t). That is sqrt(2) times the one-axis value, sqrt(2·D·t), not twice it: the two mean squares add, not the two distances.",
};
export default function BrownianEncounter() {
  return (
    <article className="reading encounter">
      <header>
        <p className="eyebrow">Discover · No algebra required</p>
        <h1>
          A particle wanders.
          <br />
          What should you measure?
        </h1>
        <p className="lead">
          If heat really is the motion of molecules, then something small enough to see under a
          microscope has to be shoved about hard enough to watch. Einstein turned that thought into
          a number a laboratory could go and check. You can arrive at the same number here, deciding
          at each step what is worth measuring.
        </p>
        <p className="fine">
          A route you could take, not a transcript of Einstein’s private thoughts. Every step can be
          read without running a simulation.
        </p>
      </header>
      <RouteMap slug="brownian-motion" />
      <section id="step-01">
        <p className="step-number">01 / Choose a quantity</p>
        <h2>Averages can hide motion.</h2>
        <p>
          Imagine marking each particle’s starting point and looking again after one second. A
          movement to the right is positive; a movement to the left is negative. In a symmetric
          model, these signed displacements cancel on average even though the particles have spread
          out.
        </p>
        <p>
          Before you read on, choose what you would measure: the signed displacement, its size
          regardless of sign, or its square. The last two both keep the information about the
          spread.
        </p>
        <details>
          <summary>Why use the squared displacement?</summary>
          <p>
            Squaring makes leftward and rightward displacements alike positive. It also has a
            property the absolute value lacks: for independent steps with zero mean, the mean
            squares add. That is why the square, and not the absolute value, carries the derivation.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/papers/brownian-motion/s4/?open=derivation-step:bm-variance-cross#arg-bm-independent-steps">
            See the step where the cross terms drop out
          </StepDoor>
        </StepDoors>
        <StepDoors>
          <StepDoor href="/lab/bm-01/">
            Compare signed means and mean squares in the tracer ensemble
          </StepDoor>
        </StepDoors>
      </section>
      <section id="step-02">
        <p className="step-number">02 / Make a prediction</p>
        <h2>Four times as long. Four times as far?</h2>
        <p>
          Try three possibilities: no change, twice the typical displacement, or four times the
          typical displacement. A fixed-velocity model and an independent-step diffusion model do
          not make the same prediction.
        </p>
        <details>
          <summary>Follow the independent-step argument</summary>
          <p>
            Four times the observation time gives four times the mean square displacement. Taking
            its square root gives twice the RMS displacement. The square grows linearly with time;
            its square root does not.
          </p>
          <Formula latex={String.raw`\langle x^2\rangle=2Dt \qquad \lambda_x=\sqrt{2Dt}`} />
          <p>
            The laboratory’s one-second, ten-second and one-minute comparison is calculated from one
            diffusion coefficient. It is not three independent measurements.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/lab/bm-06/">Compare the observation times in the laboratory</StepDoor>
          <StepDoor href="/lab/bm-05/">
            Build the argument from coin, uniform and Gaussian steps
          </StepDoor>
        </StepDoors>
      </section>
      <section id="step-03">
        <p className="step-number">03 / Ask an interval question</p>
        <h2>A curve’s height is not a probability.</h2>
        <p>
          “How likely is the displacement to lie between −1 and +1 micrometres?” is an interval
          question. The model answers with an area, a dimensionless probability. The height of the
          density is measured per micrometre.
        </p>
        <p>
          At the initial instant, all probability is at the starting point. An interval containing
          that point has probability one. At positive times, the continuous model assigns
          probability zero to one exact coordinate, but a finite interval can have positive
          probability.
        </p>
        <details>
          <summary>What happens in a more viscous liquid?</summary>
          <p>
            Keeping temperature and radius fixed, doubling viscosity halves the diffusion
            coefficient. It does not halve the RMS displacement: the square-root relationship
            reduces that displacement by a factor of the square root of two.
          </p>
          <p>
            Try changing viscosity from 1 to 2 mPa·s. The laboratory does not silently change
            viscosity when you edit temperature; they are separate settings.
          </p>
        </details>
      </section>
      <section id="step-04">
        <p className="step-number">04 / Turn the question around</p>
        <h2>What can a finite sample tell you?</h2>
        <p>
          In the next laboratory, the number used to generate a synthetic path is hidden. Its
          displacements fix how fast the particles spread, but not the radius and the molecular
          number separately: a larger radius with a smaller number spreads at the same rate. Supply
          the radius independently, estimate the number, and repeat the experiment to see how often
          a confidence interval misses.
        </p>
        <StepDoors>
          <StepDoor href="/lab/bm-07/">Estimate the number and repeat the experiment</StepDoor>
        </StepDoors>
      </section>
      <section id="step-05">
        <p className="step-number">05 / Try it yourself</p>
        <h2>From one axis to two</h2>
        <p>
          A microscope sees the plane, not one axis. Work out how far a particle gets in two
          dimensions from what one axis gives you. Any correct form is accepted: the checker
          compares your expression with the answer at sample values of D and t across the tracer
          laboratory's ranges, not by matching text.
        </p>
        <ExercisePart part={DISPLACEMENT_SCALE_EXERCISE} />
      </section>
      <section id="shelf">
        <h2>The 1904 shelf</h2>
        <Shelf cards={BROWNIAN_SHELF_CARDS} />
        <p className="fine">
          The dates on these cards come from standard bibliographies. No one here has checked them
          against the volumes, and the shelf marks each card as awaiting verification.
        </p>
      </section>
      <aside className="notice">
        <h2>The model is not the evidence.</h2>
        <p>
          Agreement between a numerical grid and an analytic curve checks their calculation under
          stated assumptions. It does not establish that real tracers obey those assumptions.
          Measurements, their uncertainty and their provenance are a separate part of the planned
          edition.
        </p>
      </aside>
      <section id="in-the-paper">
        <h2>Where this enters the paper</h2>
        <p>
          The Brownian-motion paper’s §§4–5 connect irregular displacements to diffusion and then to
          a measurable displacement scale. The German text is on this site, not yet reviewed; the
          English translation is not written yet. This route is new explanation written for this
          edition, not a translation of the paper.
        </p>
        <div className="actions">
          <a className="button" href="/papers/brownian-motion/">
            Read the argument and open its missing steps
          </a>
          <a href="/foundations/">Open the foundations library</a>
          <a href="/papers/">Back to the paper catalogue</a>
        </div>
      </section>
    </article>
  );
}
