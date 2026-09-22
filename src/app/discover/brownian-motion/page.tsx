import type { Metadata } from "next";
import {
  ExercisePart,
  type ExpressionExercisePart,
} from "../../../components/discover/ExercisePart.tsx";
import { Formula } from "../../../components/edition/Formula.tsx";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import type { KnowledgeCard } from "../../../discovery/cards/types.ts";
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "https://doi.org/10.1080/14786442808674769",
    },
  },
  {
    id: "stokes-1851-sphere-drag",
    proposition:
      "Hydrodynamic drag force on a slowly moving sphere in a viscous fluid is F = 6πηav.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Cambridge Philosophical Society Trans. 9 (1851) 8-106",
    },
  },
  {
    id: "fick-1855-diffusion-equation",
    proposition:
      "Macroscopic diffusion equation relating spatial concentration gradients to matter flux.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Poggendorffs Annalen 94 (1855) 59-86",
    },
  },
  {
    id: "maxwell-1860-equipartition",
    proposition:
      "In thermal equilibrium the mean translational kinetic energy is 3/2 k_B T for every suspended particle.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Phil. Mag. 19 (1860) 19-32",
    },
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Journal de Physique (2) 7 (1888) 561-564",
    },
  },
  {
    id: "exner-1900-particle-speeds",
    proposition:
      "Measured apparent particle speeds over observation intervals, finding values far below kinetic-theory molecular speeds.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Annalen der Physik (4) 2 (1900) 843-847",
    },
  },
  {
    id: "siedentopf-1903-ultramicroscope",
    proposition:
      "The ultramicroscope illuminates colloidal particles from the side, making sub-micron particles visible against a dark field.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Annalen der Physik (4) 10 (1903) 1-39",
    },
  },
  {
    id: "sutherland-1904-dunedin",
    proposition:
      "The same diffusion formula with a slip correction presented at Dunedin in January 1904.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "AAAS 10th Meeting Dunedin (1904)",
    },
  },
  {
    id: "sutherland-1905-phil-mag",
    proposition: "Diffusion formula with slip correction published in Philosophical Magazine.",
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
    verification: {
      verifiedBy: "Editorial Staff",
      verifierKind: "human",
      date: "2026-08-20",
      method: "bound volume",
      evidenceLocator: "Philosophical Magazine (6) 9 (1905) 781-785",
    },
  },
];

const DISPLACEMENT_SCALE_EXERCISE: ExpressionExercisePart = {
  id: "bm-displacement-scale-rewrite",
  prompt:
    "The two-dimensional RMS radial displacement is often written 2·sqrt(D·t). Write it a different way, as sqrt(4·D·t).",
  declaredNames: ["D", "t"],
  domains: {
    D: { min: 1e-14, max: 1e-10, scale: "log" },
    t: { min: 0.1, max: 100, scale: "log" },
  },
  referenceSource: "2*sqrt(D*t)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  workedExplanation:
    "sqrt(4*D*t) = sqrt(4)*sqrt(D*t) = 2*sqrt(D*t), since 4 is a perfect square and the square root of a product is the product of the square roots for nonnegative D and t.",
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
      <section>
        <p className="step-number">01 / Choose a quantity</p>
        <h2>Averages can hide motion.</h2>
        <p>
          Imagine marking each particle’s starting point and looking again after one second. A
          movement to the right is positive; a movement to the left is negative. In a symmetric
          model, these signed displacements cancel on average even though the particles have spread
          out.
        </p>
        <p>
          Before revealing the next step, choose what you would measure: signed displacement,
          absolute displacement, or squared displacement. The last two both retain information about
          the spread; neither is a test of whether a particle moved “correctly.”
        </p>
        <details>
          <summary>Why use the squared displacement?</summary>
          <p>
            Squaring makes both leftward and rightward displacements positive. More importantly,
            independent steps with zero mean have a useful property: their mean squares add.
            Absolute displacements do not have that same additive rule. This gives the square a role
            in the derivation, not just a convenient sign.
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
      <section>
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
            accepted diffusion coefficient. It is not three independent measurements.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/lab/bm-06/">Compare the observation times in the laboratory</StepDoor>
          <StepDoor href="/lab/bm-05/">
            Build the argument from coin, uniform and Gaussian steps
          </StepDoor>
        </StepDoors>
      </section>
      <section>
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
            viscosity when you edit temperature; they are separate declared inputs.
          </p>
        </details>
      </section>
      <section>
        <p className="step-number">04 / Turn the question around</p>
        <h2>What can a finite sample tell you?</h2>
        <p>
          Now hide the number used to generate a synthetic path. Its displacements constrain a
          spreading rate, but radius and molecular number can trade off. Declare an independent
          radius, estimate the number, and repeat the experiment to see why some confidence
          intervals miss.
        </p>
        <StepDoors>
          <StepDoor href="/lab/bm-07/">Estimate the number and repeat the experiment</StepDoor>
        </StepDoors>
      </section>
      <section>
        <p className="step-number">05 / Try it yourself</p>
        <h2>Same quantity, written two ways</h2>
        <p>
          A displacement scale can be written more than one way without changing what it means. Try
          rewriting it yourself; the checker compares your expression to the reference numerically,
          at real sample points across the same ranges the tracer laboratory uses, never by matching
          text.
        </p>
        <ExercisePart part={DISPLACEMENT_SCALE_EXERCISE} />
      </section>
      <section>
        <h2>The 1904 shelf</h2>
        <Shelf cards={BROWNIAN_SHELF_CARDS} />
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
      <section>
        <h2>Where this enters the paper</h2>
        <p>
          The Brownian-motion paper’s §§4–5 connect irregular displacements to diffusion and then to
          a measurable displacement scale. The reviewed source text and aligned translation are not
          yet published here. This first encounter is newly authored explanatory material, not a
          substitute source face.
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
