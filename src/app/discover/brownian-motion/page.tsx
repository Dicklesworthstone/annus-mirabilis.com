import type { Metadata } from "next";
import { BrownianWorldCheck } from "../../../components/discover/BrownianWorldCheck.tsx";
import {
  ExercisePart,
  type ExpressionExercisePart,
} from "../../../components/discover/ExercisePart.tsx";
import {
  type ExplanationExercisePart,
  ExplanationPart,
} from "../../../components/discover/ExplanationPart.tsx";
import { NumericPart } from "../../../components/discover/NumericPart.tsx";
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "../../../content/brownianShelf.ts";
import {
  FIRST_HONEST_QUESTION,
  FORK_EXNER,
  FORK_NAEGELI,
  MOVE,
  MOVE_HREF,
  NAGGING_FACT,
  PPE_TASK,
  SOURCE_JUMPS,
  WORLD_CHECK,
} from "../../../discovery/brownian/journeyII.ts";
import { EINSTEIN_ONE_SECOND } from "../../../discovery/brownian/numericExercises.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import { Fork } from "../../../discovery/Fork.tsx";
import { JourneyFormula } from "../../../discovery/JourneyFormula.tsx";
import { PAGE_FORMULAS } from "../../../discovery/journeyFormulaList.ts";
import { MoveMarker } from "../../../discovery/MoveMarker.tsx";
import { PpeTask } from "../../../discovery/PpeTask.tsx";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { SourceJump } from "../../../discovery/SourceJump.tsx";
import { StepDoor, type StepDoorHref, StepDoors } from "../../../discovery/StepDoor.tsx";
import { BM04_PRESETS } from "../../../experiments/bm04/definition.ts";
import { encodeBm04Settings } from "../../../experiments/bm04/permalink.ts";
import tracerExample from "../../../generated/bm01-example.json";

/** Nägeli's world in BM-04: kicks off, no force, a step profile. Loads as a draft to apply. */
const NAEGELI_WORLD: StepDoorHref = `/lab/bm-04/${encodeBm04Settings(BM04_PRESETS["naegeli-zero-force"].parameters)}`;

export const metadata: Metadata = { title: "A first encounter with Brownian motion" };

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
  // Length, mass, time, temperature, current, amount: D in m²/s and t in s, so an answer with the
  // wrong dimension, such as D*t, is told so before any numbers are compared.
  dimensions: { D: ["2", "0", "-1", "0", "0", "0"], t: ["0", "0", "1", "0", "0", "0"] },
  workedExplanation:
    "The squared distance from the start is x² + y². Each axis contributes a mean square of 2·D·t, independently, so the mean square distance is 4·D·t, and its root is sqrt(4·D·t) = 2·sqrt(D·t). That is sqrt(2) times the one-axis value, sqrt(2·D·t), not twice it: the two mean squares add, not the two distances.",
};
const SQUARE_ROOT_IN_WORDS: ExplanationExercisePart = {
  id: "bm-square-root-in-words",
  prompt:
    "Put it in your own words. In four times as long, a particle kicked about at random typically gets only twice as far. Why not four times as far, as a particle drifting at a steady speed would?",
  criteria: [
    "Each kick is independent of the last, so a step one way is as likely to be undone by the next step as to be continued.",
    "What grows in proportion to time is the mean square displacement, because the mean squares of independent steps add.",
    "The typical distance is the square root of the mean square, so four times the time gives the square root of four: twice as far.",
    "A drifting particle’s steps all point the same way, so nothing cancels and its distance grows in proportion to time.",
  ],
  workedExplanation:
    "Split the time into many short intervals. In each one the particle is kicked one way or the other, independently of every earlier kick, and its displacement is the sum of these steps. The average of that sum is zero, because each direction is equally likely, but the average of its square is not. Squaring the sum gives each step’s own square plus products of pairs of different steps, and because the steps are independent each of those products averages to zero. What is left is the sum of the steps’ own squares, which grows with the number of steps, and so in proportion to time. Four times as long gives four times the mean square, and the typical distance, its square root, is the square root of four times as large: twice. A particle drifting at a steady speed takes steps that all point the same way. Nothing cancels, and four times the time carries it four times as far.",
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
      <section id="shelf">
        <h2>The 1904 shelf</h2>
        <p>
          What a careful reader of the literature had by the end of 1904, and nothing later unless
          it is marked as parallel work. The route uses nothing else.
        </p>
        <Shelf cards={BROWNIAN_SHELF_CARDS} />
      </section>
      <section id="nagging-fact" aria-labelledby="nagging-fact-title">
        <p className="eyebrow" id="nagging-fact-title">
          The nagging fact
        </p>
        <p className="lead">{NAGGING_FACT}</p>
      </section>
      <section id="first-question" aria-labelledby="first-question-title">
        <p className="eyebrow" id="first-question-title">
          The first honest question
        </p>
        <p className="lead">{FIRST_HONEST_QUESTION}</p>
      </section>
      <section id="step-01">
        <p className="step-number">01 / Choose a quantity</p>
        <h2>Averages can hide motion.</h2>
        <p>
          Imagine marking each particle’s starting point and looking again after one second. A
          movement to the right is positive; a movement to the left is negative. When left and right
          are equally likely, these signed displacements cancel on average, even though the
          particles have spread out.
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
            Go straight to the explanation: the step where the cross terms drop out
          </StepDoor>
        </StepDoors>
        <StepDoors>
          <StepDoor href="/lab/bm-01/">
            Compare signed means and mean squares in the tracer ensemble
          </StepDoor>
        </StepDoors>
      </section>
      <section id="step-02">
        <p className="step-number">02 / Ask whether it presses</p>
        <h2>Does a particle you can see push like a molecule?</h2>
        <p>
          In 1887 van ’t Hoff showed that a substance dissolved in a dilute solution presses on a
          membrane that lets only the water through, and that this osmotic pressure follows the gas
          law. The law counts molecules. Nothing in it says how big a molecule is.
        </p>
        <p>
          So take the nagging fact at its word. If a particle a micron across is only a very large
          molecule, the same law should hold for it, with the number of particles in place of the
          number of molecules. The usual view in 1904 said otherwise: a membrane holding back
          suspended particles should feel no force at all, because their free energy did not seem to
          depend on where they are. The kinetic theory says it must feel one. Both cannot be right,
          and the particles’ wandering is where they part.
        </p>
        <details>
          <summary>Why the particle’s size drops out</summary>
          <p>
            The paper’s §2 finds the free energy of the suspension without solving any molecule’s
            motion. All it needs is how the particles share the volume that holds them, and that
            brings in how many there are, not how big they are. The pressure comes out as the gas
            law for that many particles:
          </p>
          <JourneyFormula {...PAGE_FORMULAS.bmOsmoticPressure} />
          <p>
            Here ν is the number of particles per unit volume, and N is the number of molecules in a
            gram-molecule: the number this route ends by estimating.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/lab/bm-02/">
            Change the particle count, the volume and the radius, and see what the pressure depends
            on
          </StepDoor>
          <StepDoor href="/lab/bm-03/">
            See where the volume factor comes from without solving any motion
          </StepDoor>
        </StepDoors>
      </section>
      <Fork fork={FORK_NAEGELI} />
      <StepDoors>
        <StepDoor href={NAEGELI_WORLD}>
          Turn the kicks off in the laboratory, and watch a step in the concentration never relax
        </StepDoor>
      </StepDoors>
      <section id="step-03">
        <p className="step-number">03 / Balance a force against drag</p>
        <h2>Pull on the particles, and see what holds them back.</h2>
        <p>
          Suppose a force pulls every particle the same way, toward the bottom say. In equilibrium
          the particles crowd together until their osmotic pressure pushes back as hard as the force
          pulls. That is one account of the crowd.
        </p>
        <p>
          Here is another. Under the force each particle drifts through the water, held back by
          Stokes’s drag, while the crowding makes the particles diffuse back from more to fewer, as
          Fick’s law says. In equilibrium the drift one way and the diffusion the other carry equal
          numbers across each second.
        </p>
        <p>
          Put the two accounts side by side and the force cancels: a stronger force makes a steeper
          crowd in exactly the proportion that it makes a faster drift. What is left fixes the
          diffusion coefficient by the temperature, the viscosity of the liquid and the radius of
          the particle alone.
        </p>
        <details>
          <summary>The coefficient, in the paper’s letters and in today’s</summary>
          <JourneyFormula {...PAGE_FORMULAS.bmDiffusionPrinted} />
          <p>
            Einstein writes k for the viscosity and P for the radius. In today’s letters the same
            relation reads as below, with Boltzmann’s constant k<sub>B</sub> = R/N. The paper’s k is
            not Boltzmann’s constant.
          </p>
          <JourneyFormula {...PAGE_FORMULAS.bmDiffusionModern} />
        </details>
        <p>
          This is a side door into the paper: it reaches D without following any one particle. The
          next steps follow one particle, and they reach the same D.
        </p>
        <StepDoors>
          <StepDoor href="/lab/bm-04/">
            Balance the drift against the spreading, and watch the force drop out
          </StepDoor>
          <StepDoor href="/papers/brownian-motion/s5/#arg-bm-diffusivity">
            Go straight to the explanation: what fixes D for a small sphere
          </StepDoor>
        </StepDoors>
      </section>
      <section id="step-04">
        <p className="step-number">04 / Make a prediction</p>
        <h2>Four times as long. Four times as far?</h2>
        <p>
          Wait four times as long. Does a particle get no farther, twice as far, or four times as
          far? It depends on how it moves. A particle drifting at a steady speed would go four times
          as far. A particle kicked about at random, each kick independent of the last, would not.
          Choose before you open the argument.
        </p>
        <details>
          <summary>Why a randomly kicked particle goes only twice as far</summary>
          <p>
            Four times the observation time gives four times the mean square displacement. Taking
            its square root gives twice the RMS displacement. The square grows linearly with time;
            its square root does not.
          </p>
          <JourneyFormula {...PAGE_FORMULAS.bmMeanSquare} />
          <p>
            The laboratory’s one-second, ten-second and one-minute comparison is calculated from one
            diffusion coefficient. It is not three independent measurements.
          </p>
        </details>
        <ExplanationPart part={SQUARE_ROOT_IN_WORDS} />
        <StepDoors>
          <StepDoor href="/papers/brownian-motion/s4/#arg-bm-gaussian">
            Go straight to the explanation: why the spread grows as the square root of time
          </StepDoor>
          <StepDoor href="/lab/bm-06/">Compare the observation times in the laboratory</StepDoor>
          <StepDoor href="/lab/bm-05/">
            Build the argument from coin, uniform and Gaussian steps
          </StepDoor>
        </StepDoors>
      </section>
      <MoveMarker move={MOVE} href={MOVE_HREF} />
      <Fork fork={FORK_EXNER} />
      <StepDoors>
        <StepDoor href="/lab/bm-01/">
          See the apparent speed change with the interval, in the tracer ensemble
        </StepDoor>
      </StepDoors>
      <section id="step-05">
        <p className="step-number">05 / Ask an interval question</p>
        <h2>A curve’s height is not a probability.</h2>
        <p>
          “How likely is the displacement to lie between −1 and +1 micrometres?” is an interval
          question. The model answers with an area, a dimensionless probability. The height of the
          density is measured per micrometre.
        </p>
        <p>
          At the very start every particle sits at the starting point, so any stretch that includes
          it holds all of them. After that, the chance of being at one exact point is zero, however
          crowded its neighbourhood: only a stretch of some width has a chance, and that chance is
          the area under the curve across it.
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
        <StepDoors>
          <StepDoor href="/foundations/distributions/">
            Go straight to the explanation: why a curve’s height is not a probability
          </StepDoor>
        </StepDoors>
      </section>
      <section id="step-06">
        <p className="step-number">06 / Check it against the world</p>
        <h2>A number a microscope can follow.</h2>
        <p>
          Everything in the displacement is something a laboratory can set or read: the temperature,
          the viscosity of the liquid, the radius of the particle, and how long you wait. Give the
          ensemble below Einstein’s inputs and it gives his numbers. Give it your own and it gives
          theirs.
        </p>
        <BrownianWorldCheck
          example={tracerExample}
          check={WORLD_CHECK}
          laterEvidence={BROWNIAN_LATER_EVIDENCE}
        />
        <p>
          The later evidence is not a displacement for these particles. Perrin measured suspensions
          of his own, and what he reported was the number of molecules that makes the formulas fit
          them. It came out close to the 6 × 10<sup>23</sup> Einstein took from gas theory, and that
          number is what sets the size of the displacements he printed.
        </p>
      </section>
      <section id="step-07">
        <p className="step-number">07 / Turn the question around</p>
        <h2>What can a finite sample tell you?</h2>
        <p>
          In the next laboratory, the molecular number behind a made-up set of paths is hidden. How
          fast the particles spread fixes the radius and the number only together: a larger radius
          with a smaller number spreads at the same rate. So give it the radius from a separate
          measurement, estimate the number, and run it again and again to see how often the range
          you quote misses the true number.
        </p>
        <StepDoors>
          <StepDoor href="/papers/brownian-motion/s5/#arg-bm-inference">
            Go straight to the explanation: what would let us count molecules
          </StepDoor>
          <StepDoor href="/lab/bm-07/">Estimate the number and repeat the experiment</StepDoor>
        </StepDoors>
      </section>
      <section id="step-08">
        <p className="step-number">08 / Try it yourself</p>
        <h2>From one axis to two</h2>
        <p>
          A microscope sees the plane, not one axis. Work out how far a particle gets in two
          dimensions from what one axis gives you. Any correct form is accepted: the checker
          compares your expression with the answer at sample values of D and t across the tracer
          laboratory's ranges, not by matching text.
        </p>
        <ExercisePart part={DISPLACEMENT_SCALE_EXERCISE} />
        <p>
          Now the number itself. With Einstein’s own inputs the formula gives a distance a
          laboratory could go and measure. Type it in the unit you prefer.
        </p>
        <NumericPart part={EINSTEIN_ONE_SECOND} />
        <PpeTask task={PPE_TASK} />
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
          a measurable displacement scale. The German text and an English translation are on this
          site. This route is new explanation written for this edition, not a translation of the
          paper.
        </p>
        {SOURCE_JUMPS.map((jump) => (
          <SourceJump key={jump.id} jump={jump} />
        ))}
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
