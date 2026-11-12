import type { Metadata } from "next";
import { BrownianWorldCheck } from "../../../components/discover/BrownianWorldCheck.tsx";
import { ExercisePart } from "../../../components/discover/ExercisePart.tsx";
import { ExplanationPart } from "../../../components/discover/ExplanationPart.tsx";
import { NumericPart } from "../../../components/discover/NumericPart.tsx";
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "../../../content/brownianShelf.ts";
import { BrownianStage } from "../../../discovery/brownian/BrownianStage.tsx";
import {
  DISPLACEMENT_SCALE_EXERCISE,
  SQUARE_ROOT_IN_WORDS,
} from "../../../discovery/brownian/journeyExercises.ts";
import {
  DOORS,
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
import { MOLECULAR_NUMBER_EXERCISE } from "../../../discovery/brownian/molecularNumberExercise.ts";
import { EINSTEIN_ONE_SECOND } from "../../../discovery/brownian/numericExercises.ts";
import {
  DRAG_BALANCE_STAGE,
  INFERENCE_STAGE,
  INTERVAL_STAGE,
  OBSERVABLE_STAGE,
  OSMOTIC_STAGE,
  TIME_SCALING_STAGE,
} from "../../../discovery/brownian/stages.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import { Doors } from "../../../discovery/Doors.tsx";
import { Fork } from "../../../discovery/Fork.tsx";
import { JourneyFormula } from "../../../discovery/JourneyFormula.tsx";
import { PAGE_FORMULAS } from "../../../discovery/journeyFormulaList.ts";
import { JourneyNotebook } from "../../../discovery/journeys/JourneyNotebook.tsx";
import { MoveMarker } from "../../../discovery/MoveMarker.tsx";
import { DiscoveryNotebookControls } from "../../../discovery/notes/NotebookControls.tsx";
import { PpeTask } from "../../../discovery/PpeTask.tsx";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { SourceJump } from "../../../discovery/SourceJump.tsx";
import { StepDoor, type StepDoorHref, StepDoors } from "../../../discovery/StepDoor.tsx";
import { loadPerrinRecord } from "../../../experiments/bm01/perrinRecord.ts";
import { BM04_PRESETS } from "../../../experiments/bm04/definition.ts";
import { encodeBm04Settings } from "../../../experiments/bm04/permalink.ts";
import tracerExample from "../../../generated/bm01-example.json";

/** Nägeli's world in BM-04: kicks off, no force, a step profile. Loads as a draft to apply. */
const NAEGELI_WORLD: StepDoorHref = `/lab/bm-04/${encodeBm04Settings(BM04_PRESETS["naegeli-zero-force"].parameters)}`;

export const metadata: Metadata = { title: "A first encounter with Brownian motion" };

export default function BrownianEncounter() {
  return (
    <JourneyNotebook paper="brownian-motion">
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
            microscope has to be shoved about hard enough to watch. Einstein turned that thought
            into a number a laboratory could go and check. You can arrive at the same number here,
            deciding at each step what is worth measuring.
          </p>
          <p className="fine">
            A route you could take, not a transcript of Einstein’s private thoughts. Every step can
            be read without running a simulation.
          </p>
        </header>
        <RouteMap slug="brownian-motion" />
        <DiscoveryNotebookControls />
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
        <BrownianStage stage={OBSERVABLE_STAGE}>
          <details>
            <summary>Why use the squared displacement?</summary>
            <p>
              Squaring makes leftward and rightward displacements alike positive. It also has a
              property the absolute value lacks: for independent steps with zero mean, the mean
              squares add. That is why the square, and not the absolute value, carries the
              derivation.
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
        </BrownianStage>
        <BrownianStage stage={OSMOTIC_STAGE}>
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
              Here ν is the number of particles per unit volume, and N is the number of molecules in
              a gram-molecule: the number this route ends by estimating.
            </p>
          </details>
          <StepDoors>
            <StepDoor href="/lab/bm-02/">
              Change the particle count, the volume and the radius, and see what the pressure
              depends on
            </StepDoor>
            <StepDoor href="/lab/bm-03/">
              See where the volume factor comes from without solving any motion
            </StepDoor>
          </StepDoors>
        </BrownianStage>
        <Fork fork={FORK_NAEGELI} />
        <StepDoors>
          <StepDoor href={NAEGELI_WORLD}>
            Turn the kicks off in the laboratory, and watch a step in the concentration never relax
          </StepDoor>
        </StepDoors>
        <BrownianStage stage={DRAG_BALANCE_STAGE}>
          <details>
            <summary>The coefficient, in the paper’s letters and in today’s</summary>
            <JourneyFormula {...PAGE_FORMULAS.bmDiffusionPrinted} />
            <p>
              Einstein writes k for the viscosity and P for the radius. In today’s letters the same
              relation reads as below, with Boltzmann’s constant k<sub>B</sub> = R/N. The paper’s k
              is not Boltzmann’s constant.
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
            <StepDoor href="/papers/brownian-motion/s3/#arg-bm-diffusivity">
              Go straight to the explanation: what fixes D for a small sphere
            </StepDoor>
          </StepDoors>
        </BrownianStage>
        <BrownianStage stage={TIME_SCALING_STAGE}>
          <details>
            <summary>Why a randomly kicked particle goes only twice as far</summary>
            <p>
              Four times the observation time gives four times the mean square displacement. Taking
              its square root gives twice the RMS displacement. The square grows linearly with time;
              its square root does not.
            </p>
            <JourneyFormula {...PAGE_FORMULAS.bmMeanSquare} />
            <p>
              The laboratory’s one-second, ten-second and one-minute comparison is calculated from
              one diffusion coefficient. It is not three independent measurements.
            </p>
          </details>
          <ExplanationPart
            part={SQUARE_ROOT_IN_WORDS}
            notebook={{
              title: "Why the spread grows as the square root of time",
              sourceAnchor: "arg-bm-gaussian",
            }}
          />
          <StepDoors>
            <StepDoor href="/papers/brownian-motion/s4/#arg-bm-gaussian">
              Go straight to the explanation: why the spread grows as the square root of time
            </StepDoor>
            <StepDoor href="/lab/bm-06/">Compare the observation times in the laboratory</StepDoor>
            <StepDoor href="/lab/bm-05/">
              Build the argument from coin, uniform and Gaussian steps
            </StepDoor>
          </StepDoors>
        </BrownianStage>
        <MoveMarker move={MOVE} href={MOVE_HREF} />
        <Fork fork={FORK_EXNER} />
        <StepDoors>
          <StepDoor href="/lab/bm-01/">
            See the apparent speed change with the interval, in the tracer ensemble
          </StepDoor>
        </StepDoors>
        <BrownianStage stage={INTERVAL_STAGE}>
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
        </BrownianStage>
        <section id="step-06">
          <p className="step-number">06 / Check it against the world</p>
          <h2>A number a microscope can follow.</h2>
          <p>
            Everything in the displacement is something a laboratory can set or read: the
            temperature, the viscosity of the liquid, the radius of the particle, and how long you
            wait. Give the ensemble below Einstein’s inputs and it gives his numbers. Give it your
            own and it gives theirs.
          </p>
          <BrownianWorldCheck
            example={tracerExample}
            check={WORLD_CHECK}
            laterEvidence={BROWNIAN_LATER_EVIDENCE}
            perrin={loadPerrinRecord()}
          />
          <p>
            Perrin's suspensions had their own measured radius, temperature and viscosity. Those
            conditions let us compare the displacement scale directly. Turning the relation around
            asks a further question: what molecular number do the observations imply, and how much
            does that answer depend on the measurements of radius and viscosity?
          </p>
        </section>
        <BrownianStage stage={INFERENCE_STAGE}>
          <ExercisePart part={MOLECULAR_NUMBER_EXERCISE} />
          <StepDoors>
            <StepDoor href="/papers/brownian-motion/s5/#arg-bm-inference">
              Go straight to the explanation: what would let us count molecules
            </StepDoor>
            <StepDoor href="/lab/bm-07/">Estimate the number and repeat the experiment</StepDoor>
          </StepDoors>
        </BrownianStage>
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
            Perrin's measured displacements above carry their own source and precision limits; they
            can test the prediction without becoming premises of the 1905 argument.
          </p>
        </aside>
        <section id="in-the-paper">
          <h2>Where this enters the paper</h2>
          <p>
            The Brownian-motion paper’s §§4–5 connect irregular displacements to diffusion and then
            to a measurable displacement scale. The German text and an English translation are on
            this site. This route is new explanation written for this edition, not a translation of
            the paper.
          </p>
          {SOURCE_JUMPS.map((jump) => (
            <SourceJump key={jump.id} jump={jump} />
          ))}
          <p>
            Two doors lead to the same coefficient: the paper&rsquo;s balance of a crowd, and one
            particle&rsquo;s walk followed step by step. The route takes both, and they meet.
          </p>
          <Doors doors={DOORS} />
          <p>
            The two doors can also be taken apart and put back together. The capstone separates what
            the balance of a crowd establishes from what one particle&rsquo;s walk establishes, and
            asks which of them has to come before which:{" "}
            <a href="/capstones/brownian-motion/">Rebuild the argument for the spread</a>. It is
            optional, and nothing above depends on it.
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
    </JourneyNotebook>
  );
}
