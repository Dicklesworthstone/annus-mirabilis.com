import type { Metadata } from "next";
import { ExercisePart } from "../../../components/discover/ExercisePart.tsx";
import { ExplanationPart } from "../../../components/discover/ExplanationPart.tsx";
import { MassEnergyWorldCheck } from "../../../components/discover/MassEnergyWorldCheck.tsx";
import { NumericPart } from "../../../components/discover/NumericPart.tsx";
import { ThreeBoundaries } from "../../../components/discover/ThreeBoundaries.tsx";
import {
  MASS_ENERGY_LATER_EVIDENCE,
  MASS_ENERGY_SHELF_CARDS,
} from "../../../content/massEnergyShelf.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import { Doors } from "../../../discovery/Doors.tsx";
import { Fork } from "../../../discovery/Fork.tsx";
import { JourneyFormula } from "../../../discovery/JourneyFormula.tsx";
import { PAGE_FORMULAS } from "../../../discovery/journeyFormulaList.ts";
import { JourneyNotebook } from "../../../discovery/journeys/JourneyNotebook.tsx";
import { MoveMarker } from "../../../discovery/MoveMarker.tsx";
import {
  DOORS,
  FIRST_HONEST_QUESTION,
  FORK_FIELD_MASS,
  FORK_POINCARE,
  MOVE,
  MOVE_HREF,
  NAGGING_FACT,
  PPE_TASK,
  SOURCE_JUMPS,
  WORLD_CHECK,
} from "../../../discovery/massEnergy/journeyIV.ts";
import { MassEnergyStage } from "../../../discovery/massEnergy/MassEnergyStage.tsx";
import {
  EQUAL_AND_OPPOSITE_EXPLANATION,
  MASS_GIVEN_UP_EXERCISE,
  PULSE_SUM_EXERCISE,
} from "../../../discovery/massEnergy/massExercise.ts";
import {
  BOX_RECOIL,
  PROXY_AT_SIX_TENTHS,
  SEALED_LAMP_YEAR,
} from "../../../discovery/massEnergy/numericExercises.ts";
import {
  COEFFICIENT_STAGE,
  PREDICTION_STAGE,
  SUBTRACTION_STAGE,
  SYMMETRIC_EMISSION_STAGE,
  TWO_LEDGERS_STAGE,
} from "../../../discovery/massEnergy/stages.ts";
import { DiscoveryNotebookControls } from "../../../discovery/notes/NotebookControls.tsx";
import { PpeTask } from "../../../discovery/PpeTask.tsx";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { SourceJump } from "../../../discovery/SourceJump.tsx";
import { StepDoor, StepDoors } from "../../../discovery/StepDoor.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/me03/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";

export const metadata: Metadata = {
  title: "A body gives off light. What does it lose?",
  description:
    "A reconstruction of the September 1905 argument: write one body's energy twice, let it emit, subtract, and see what the subtraction leaves behind.",
};

/**
 * The mass-energy discovery route.
 *
 * A reconstruction, not a biography. Every step is a move a reader can make from the shelf
 * below; none of it claims to be what Einstein thought.
 *
 * ON THE SHELF CARDS. Eight are pre-1905 and carry status "available". The ninth is the
 * light-complex transformation from section 8 of the June relativity paper, which is 1905 and
 * therefore NOT on a 1904 shelf. AGENTS.md permits exactly this one import for this journey
 * provided its provenance is shown, so it is declared `admittedImport` and cardRules requires
 * such a card to carry latestYear 1905. The route names the import at the step that uses it
 * rather than letting it arrive unannounced.
 *
 * NONE OF THESE CARDS CARRIES A `verification` RECORD, deliberately. VerificationMethod is
 * "library scan" | "bound volume" | "publisher facsimile" | "comparison edition", and I
 * performed none of those: these dates come from standard bibliography, not from my having
 * opened the volumes. Supplying a method I did not use would be the fabricated-evidence
 * failure the verification field exists to prevent. The missing record is the audit trail's, in
 * the data: since dispatch 243 no card says "Awaiting verification" or "Verified", under the
 * owner's D-2026-09-25-no-review-status-banners. The build's shelf gate
 * (scripts/check-shelf-publication.ts, run by prepare:content) refuses a card whose rendering
 * shows verification status either way, and one that carries half a record.
 */

export default function MassEnergyRoute() {
  // The example names its host source by digest, as /lab/me-03/ does (scripts/generate-lab-digests.mjs).
  const ledgerExample = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };
  return (
    <JourneyNotebook paper="mass-energy">
      <article className="reading encounter">
        <header>
          <p className="eyebrow">Discover · A route you could take</p>
          <h1>
            A body gives off light.
            <br />
            What does it lose?
          </h1>
          <p className="lead">
            A body at rest gives off two flashes of light. Its energy has gone down, and nothing you
            can see about it has changed. The shortest of the four papers asks what has, and answers
            with a number. You can reach it yourself in five moves and then check the number against
            the world.
          </p>
          <p className="fine">
            A route you could take, not a transcript of Einstein&rsquo;s private thoughts. Every
            step can be read without running anything.
          </p>
        </header>
        <RouteMap slug="mass-energy" />
        <DiscoveryNotebookControls />

        <section id="shelf">
          <h2>The 1904 shelf, and the one thing that is not on it</h2>
          <p>
            Eight of the nine results below were available to a careful reader at the end of 1904.
            The ninth is the June 1905 transformation used at step 3, and it is marked as an import
            because it is one.
          </p>
          <Shelf cards={MASS_ENERGY_SHELF_CARDS} />
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

        <MassEnergyStage stage={SYMMETRIC_EMISSION_STAGE}>
          <StepDoors>
            <StepDoor href="/papers/mass-energy/#arg-me-symmetric-emission">
              Go straight to the explanation: why the light leaves in two equal, opposite flashes
            </StepDoor>
          </StepDoors>
        </MassEnergyStage>

        <MassEnergyStage stage={PREDICTION_STAGE}>
          <StepDoors>
            <StepDoor href="/papers/mass-energy/#arg-me-mass-change">
              Go straight to the explanation: what the argument identifies, and which way the change
              points
            </StepDoor>
          </StepDoors>
        </MassEnergyStage>

        <MassEnergyStage stage={TWO_LEDGERS_STAGE}>
          <StepDoors>
            <StepDoor href="/papers/mass-energy/#arg-me-two-ledgers">
              Go straight to the explanation: two accounts of the same loss
            </StepDoor>
            <StepDoor href="/lab/sr-10/">
              Transform a finite light complex and watch its energy change
            </StepDoor>
          </StepDoors>
        </MassEnergyStage>

        <MassEnergyStage stage={SUBTRACTION_STAGE}>
          <StepDoors>
            <StepDoor href="/papers/mass-energy/#arg-me-subtraction">
              Go straight to the explanation: which difference survives the subtraction
            </StepDoor>
            <StepDoor href="/discover/mass-energy/investigate/">
              Assemble the argument yourself and take that premise out
            </StepDoor>
          </StepDoors>
        </MassEnergyStage>

        <MassEnergyStage
          stage={COEFFICIENT_STAGE}
          afterFirstParagraph={<JourneyFormula {...PAGE_FORMULAS.meKineticDrop} />}
        >
          <p>First write the result as the paper prints it, in its own letters.</p>
          <ExercisePart part={MASS_GIVEN_UP_EXERCISE} />
          <p>
            Now put a number to it. The coefficient is small in the units of everyday things, and
            working one case shows how small.
          </p>
          <NumericPart part={SEALED_LAMP_YEAR} />
          <StepDoors>
            <StepDoor href="/papers/mass-energy/#arg-me-small-speed">
              Go straight to the explanation: why the slow-speed coefficient is the one to read
            </StepDoor>
            <StepDoor href="/lab/me-02/">
              Compare the finite-speed proxy with the limit that identifies the mass
            </StepDoor>
          </StepDoors>
        </MassEnergyStage>
        <MoveMarker move={MOVE} href={MOVE_HREF} />
        <Fork fork={FORK_POINCARE} />
        <Fork fork={FORK_FIELD_MASS} />

        <section id="step-06">
          <p className="step-number">06 / Check it against the world</p>
          <h2>Where the paper says to look</h2>
          <p>
            What the result says depends on what you weigh. In the ledger below one joule of light
            leaves a body: draw the boundary around the body alone, around the light, or around
            both, and read the mass that goes with it. Its cards put the same rule to radium, the
            Sun, coal, a candle and a year of a light bulb.
          </p>
          <ThreeBoundaries />
          <MassEnergyWorldCheck
            example={ledgerExample}
            check={WORLD_CHECK}
            laterEvidence={MASS_ENERGY_LATER_EVIDENCE}
          />
          <p>
            The paper says only that a test is not ruled out for bodies whose energy content changes
            a great deal, and names radium salts. The cards above are later tests of another kind:
            in 1932 Cockcroft and Walton set the energy released when lithium nuclei break apart
            beside the mass lost, and in 1933 Bainbridge weighed those nuclei with a mass
            spectrograph. They test the result, and they were on no one&rsquo;s shelf when the paper
            was written.
          </p>
        </section>
        <section id="step-07">
          <p className="step-number">07 / Try it yourself</p>
          <h2>Four pieces of the argument to work by hand</h2>
          <p>
            First the step that makes the direction of the light irrelevant. Any correct form is
            accepted: the checker compares your expression with the answer at sample values of L, v
            and V, not by matching text.
          </p>
          <ExercisePart part={PULSE_SUM_EXERCISE} />
          <p>
            Next the 1906 route, the side door below. The number is small enough that the sign is
            the only thing you could see.
          </p>
          <NumericPart part={BOX_RECOIL} />
          <p>
            Then the step that decides where the mass is read: at a finite speed the quotient is not
            yet the mass.
          </p>
          <NumericPart part={PROXY_AT_SIX_TENTHS} />
          <p>Last, the choice the whole argument rests on, in your own words.</p>
          <ExplanationPart part={EQUAL_AND_OPPOSITE_EXPLANATION} />
          <PpeTask task={PPE_TASK} />
        </section>

        <aside className="notice">
          <h2>What this argument does not establish</h2>
          <p>
            It does not show that mass and energy are the same thing. It shows that a body which
            gives off energy <em>L</em> as light behaves afterwards as though its mass were smaller
            by <em>L</em>/<em>V</em>&sup2;, under the premises named at steps 3 and 4. The paper
            then generalises in one sentence: it calls it evident that nothing depends on the energy
            leaving as radiation, and concludes that the mass of a body is a measure of its energy
            content. That last step is a stated inference, not a further derivation, and the
            familiar equation is printed nowhere in the paper.
          </p>
          <p>
            Nor is any of this an experiment. Every number on the instruments linked above is
            calculated by this site from the model just described. A calculation shows you what the
            premises imply; it cannot tell you whether the premises describe the world.
          </p>
        </aside>

        <section id="in-the-paper">
          <h2>Where this enters the paper</h2>
          <p>
            The paper is three pages and its title is a question rather than a claim. It sets out
            the two accounts, performs the subtraction, takes the slow-speed limit, and states the
            conclusion in a single sentence. Its German text and an English translation are on this
            site.
          </p>
          {SOURCE_JUMPS.map((jump) => (
            <SourceJump key={jump.id} jump={jump} />
          ))}
          <Doors doors={DOORS} />
          <p>
            The argument is short enough to rebuild from its parts. The capstone sets out this
            paper&rsquo;s claims in an order that does not work, states the premises the subtraction
            leans on separately from the steps that use them, and asks you to find an order that
            does: <a href="/capstones/mass-energy/">Rebuild the September argument</a>. It is
            optional, and nothing above depends on it.
          </p>
          <div className="actions">
            <a className="button" href="/papers/mass-energy/">
              Read the argument as the paper makes it
            </a>
            <a href="/discover/">Back to the discovery routes</a>
          </div>
        </section>
      </article>
    </JourneyNotebook>
  );
}
