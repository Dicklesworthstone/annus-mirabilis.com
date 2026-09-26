import type { Metadata } from "next";
import { ExercisePart } from "../../../components/discover/ExercisePart.tsx";
import { NumericPart } from "../../../components/discover/NumericPart.tsx";
import { SPECIAL_RELATIVITY_SHELF_CARDS } from "../../../content/specialRelativityShelf.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { MOVING_CLOCK_EXERCISE } from "../../../discovery/relativity/clockExercise.ts";
import { MOVING_ROD } from "../../../discovery/relativity/numericExercises.ts";
import { StepDoor, StepDoors } from "../../../discovery/StepDoor.tsx";

export const metadata: Metadata = {
  title: "One current, two stories. Which one is the moving one?",
  description:
    "A reconstruction of the June 1905 argument: start from a magnet and a coil, keep two principles that look incompatible, and find out what has to give.",
};

/**
 * The special-relativity discovery route. The last of the four.
 *
 * A reconstruction, not a biography.
 *
 * THIS ROUTE CARRIES THE ARGUMENT BUT CANNOT CARRY THE SOURCE, and says so rather than working
 * around it. Measured 2026-09-22: the German face of this paper renders 1,060 characters and the
 * not-yet-available notice, because the ledger stands at 22 of 31 pages. The other three routes
 * can send a reader to a set German text; this one cannot, and step 9 tells the reader that
 * instead of linking them to a stub.
 *
 * NO ADMITTED IMPORT. Every card is pre-1905, as with light-quanta.
 *
 * THREE ANACHRONISMS AGENTS.md NAMES ARE LIVE ON THIS PAPER AND ARE REFUSED HERE:
 *   - Michelson-Morley as the sole documented cause. The card carries the limit; the route
 *     treats it as one of several failed attempts, which is how the paper refers to them.
 *   - Spacetime diagrams as the paper's presentation. Minkowski is 1908 and appears nowhere.
 *   - The train and the embankment, which is Einstein's 1917 popular illustration, not the
 *     1905 argument. The route uses the magnet and the coil, which is what the paper opens on.
 * Lorentz gets a step of his own rather than a dismissal, because within the scope of these
 * experiments his account is empirically equivalent and AGENTS.md forbids calling that refuted.
 */
export default function SpecialRelativityRoute() {
  return (
    <article className="reading encounter">
      <header>
        <p className="eyebrow">Discover · A route you could take</p>
        <h1>
          One current, two stories.
          <br />
          Which one is the moving one?
        </h1>
        <p className="lead">
          It starts with a magnet, a coil of wire and a needle that moves, all of it ordinary in
          1904, and asks why the textbook needs two different explanations for one reading.
          Following that question through means giving up the idea that “at the same time” needs no
          definition.
        </p>
        <p className="fine">
          A route you could take, not a transcript of Einstein&rsquo;s private thoughts. Every step
          can be read without running anything.
        </p>
      </header>
      <RouteMap slug="special-relativity" />

      <section id="step-01">
        <p className="step-number">01 / Start where the paper starts</p>
        <h2>A magnet, a coil, and a needle that moves</h2>
        <p>
          Hold a coil of wire still and push a magnet into it: the needle deflects. Now hold the
          magnet still and move the coil over it instead, at the same relative speed: the needle
          deflects by the same amount. Every measurement you can make on the two arrangements
          agrees.
        </p>
        <p>
          The accepted theory of 1904 does not describe them the same way. In the first case the
          moving magnet is said to produce an electric field in the space around it, and that field
          drives the current. In the second the field around the magnet is said to be unchanging,
          and the current arises instead because the wire is moving through it. Two mechanisms, two
          descriptions, one needle that cannot tell them apart.
        </p>
        <StepDoors>
          <StepDoor href="/lab/sr-02/">
            Tell both stories about the magnet and compare them
          </StepDoor>
        </StepDoors>
      </section>

      <section id="step-02">
        <p className="step-number">02 / Decide whether that bothers you</p>
        <h2>An asymmetry in the telling, not in the measuring</h2>
        <p>
          This is not a crisis. Nothing is predicted wrongly. The two accounts agree on every
          number, and a physicist who shrugs and uses whichever is convenient will never be caught
          out by an experiment.
        </p>
        <p>
          What is odd is that the theory distinguishes two situations that no measurement
          distinguishes. To tell the stories apart you have to say which object is really moving,
          and the only thing that could settle that is motion relative to the medium light travels
          in. Attempts to detect that motion had been made, with increasing care, and had found
          nothing.
        </p>
        <details>
          <summary>How much the null results are worth here</summary>
          <p>
            Less than the usual telling suggests, and the route does not lean on them. They say that
            one route to distinguishing the two cases did not work, not that no route could. The
            paper refers to failed attempts to detect motion relative to the light medium in general
            terms, and nothing in it says which experiment mattered to its author; the shelf card
            says the same.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/papers/special-relativity/s0/#arg-sr-magnet-conductor">
            Go straight to the explanation: one apparatus, two descriptions
          </StepDoor>
        </StepDoors>
      </section>

      <section id="step-03">
        <p className="step-number">03 / Make a prediction</p>
        <h2>Can you keep both of these at once?</h2>
        <p>
          Here are two statements. First: the laws of physics look the same to anyone moving
          steadily, so there is no experiment that reveals who is really at rest. Second: light
          travels through empty space at a definite speed that does not depend on how fast its
          source was moving when it left.
        </p>
        <p>
          Before reading on, decide whether they are compatible. If I am gliding past you at half
          the speed of light and we both watch the same flash, the ordinary way of adding speeds
          says we must get different answers for how fast it travels. Either one of the two
          statements is wrong, or something in the ordinary way of adding speeds is.
        </p>
        <details>
          <summary>Why the third option is easy to miss</summary>
          <p>
            Adding speeds is not a law anybody tested. It follows from something more basic that has
            never needed defending: that you and I agree on what time it is, so we agree on how long
            the flash took, and we already agree on how far it went. That agreement is the
            assumption in the room, and it is invisible precisely because nothing has ever asked for
            it.
          </p>
        </details>
      </section>

      <section id="step-04">
        <p className="step-number">04 / Find the assumption</p>
        <h2>What does it take to say two distant things happened at once?</h2>
        <p>
          Stop and ask what the claim even means. Two events at the same place happening together is
          something you can see. Two events far apart happening together is not: you have to compare
          two clocks, and to compare them you have to have set them, and to set them you have to
          send something between them that takes time to arrive.
        </p>
        <p>
          So &ldquo;at the same time&rdquo; for distant events is not something you observe. It is
          something you establish, by a procedure you choose. Write the procedure down and the
          consequence follows at once: two observers moving relative to each other, each setting
          their clocks by the same rule, do not end up agreeing about which distant events are
          simultaneous. Neither has made a mistake.
        </p>
        <StepDoors>
          <StepDoor href="/papers/special-relativity/s1/#arg-sr-synchronization">
            Go straight to the explanation: how distant clocks come to share a time
          </StepDoor>
          <StepDoor href="/lab/sr-01/">
            Set two distant clocks and watch what the procedure commits you to
          </StepDoor>
          <StepDoor href="/lab/sr-03/">See simultaneity and length come apart together</StepDoor>
        </StepDoors>
      </section>

      <section id="step-05">
        <p className="step-number">05 / Build the map</p>
        <h2>The move</h2>
        <p>
          Now the work is mechanical, and this is the step that the story usually skips. Take the
          two statements from step 3 as given, take the clock-setting procedure from step 4, and ask
          what relation must hold between one observer&rsquo;s coordinates and the other&rsquo;s.
          Add that space and time are the same everywhere and in every direction, and the answer is
          forced: only one set of relations keeps both principles and reduces to the familiar one at
          everyday speeds.
        </p>
        <p>
          Work it through rather than read it. The result is often presented as a formula handed
          down; here it is built from a measurement procedure you can carry out, and nothing enters
          it beyond the two principles, the clock-setting rule, and that sameness of space and time.
        </p>
        <StepDoors>
          <StepDoor href="/papers/special-relativity/s3/#arg-sr-lorentz-map">
            Go straight to the explanation: the map that respects light in both directions
          </StepDoor>
          <StepDoor href="/lab/sr-04/">Build the map rather than receive it</StepDoor>
        </StepDoors>
      </section>

      <section id="step-06">
        <p className="step-number">06 / Read off the consequences</p>
        <h2>Moving clocks, moving rods, and added speeds</h2>
        <p>
          A clock moving past you reads less elapsed time than yours between the same two events. A
          rod moving past you measures shorter along its direction of travel. And speeds no longer
          add the way they used to, which is the answer to the puzzle in step 3: the flash comes out
          at the same speed for both of us. Neither measurement is wrong; we disagree about the
          times and distances that go into it.
        </p>
        <details>
          <summary>What the moving clock reading means</summary>
          <p>
            The claim is about what the clock itself reads when it arrives, compared with what your
            clocks read, both measured in the ordinary way. A camera is a separate question: what it
            records also involves how long the light took to reach it, and that contribution can be
            calculated on its own. Keeping the two apart is the whole of the distinction.
          </p>
        </details>
        <p>First the clock, as a formula.</p>
        <ExercisePart part={MOVING_CLOCK_EXERCISE} />
        <p>Then the rod, on numbers.</p>
        <NumericPart part={MOVING_ROD} />
        <StepDoors>
          <StepDoor href="/papers/special-relativity/s4/#arg-sr-clock-and-length">
            Go straight to the explanation: what a moving clock and rod actually report
          </StepDoor>
          <StepDoor href="/lab/sr-05/">
            Separate what the clock reads from what a camera sees
          </StepDoor>
          <StepDoor href="/lab/sr-06/">Add two speeds and fail to exceed the light speed</StepDoor>
        </StepDoors>
      </section>

      <section id="step-07">
        <p className="step-number">07 / Meet the serious rival</p>
        <h2>Lorentz gets the same formulas, and is not refuted</h2>
        <p>
          Keep the light medium. Say that a body moving through it genuinely contracts, and that a
          clock moving through it genuinely runs slow, and that what a moving observer calls time is
          a bookkeeping device rather than the real thing. Work it through and you reach the same
          equations, and every experiment above comes out the same way.
        </p>
        <p>
          This route does not tell you that account is wrong, and it would be dishonest to. Within
          the scope of these measurements the two are equivalent, and no experiment listed here
          separates them. What differs is the bookkeeping: one account posits a medium nobody can
          detect and then adds contraction and local time as properties of motion through it; the
          other takes the two principles of step 3 and gets the same relations with nothing else
          assumed.
        </p>
        <details>
          <summary>What would it take to prefer one?</summary>
          <p>
            Economy, which is a reason and not a proof, and reach: the same kinematics applies to
            any law whatever, not only to electromagnetism, which is what makes the fourth paper of
            1905 possible three months later. A reader who finds the ether account tidier is not
            making an error that this page can correct with a measurement.
          </p>
        </details>
      </section>

      <section id="step-08">
        <p className="step-number">08 / Check it against the world</p>
        <h2>What had already been measured</h2>
        <p>
          Light in moving water is dragged along, but only partly, by a fraction measured in 1851
          and awkward for the theories of its day. The new way of adding speeds gives that fraction
          with nothing added. A star&rsquo;s apparent position shifts through the year by an amount
          known since 1729, and the same transformation gives the shift and the accompanying change
          of frequency together, from one relation rather than two.
        </p>
        <StepDoors>
          <StepDoor href="/papers/special-relativity/s5/#arg-sr-velocity-composition">
            Go straight to the explanation: why two speeds do not simply add
          </StepDoor>
          <StepDoor href="/papers/special-relativity/s7/#arg-sr-doppler-aberration">
            Go straight to the explanation: why a change of frequency comes with a change of
            direction
          </StepDoor>
          <StepDoor href="/lab/sr-06/">Recover the partial drag from velocity addition</StepDoor>
          <StepDoor href="/lab/sr-09/">Get aberration and Doppler from one transformation</StepDoor>
          <StepDoor href="/lab/sr-08/">
            Watch electric and magnetic fields change into each other
          </StepDoor>
        </StepDoors>
      </section>

      <section id="shelf">
        <h2>The 1904 shelf</h2>
        <p>
          Nothing here is imported from later. The most interesting card is Lorentz&rsquo;s, which
          is on the shelf as a live alternative rather than as a foil.
        </p>
        <Shelf cards={SPECIAL_RELATIVITY_SHELF_CARDS} />
      </section>

      <aside className="notice">
        <h2>What this route cannot show you</h2>
        <p>
          The other three routes end at the paper&rsquo;s German text. This one cannot yet: the
          transcription of the relativity paper is not finished, and until it is, the German face
          shows a notice rather than part of a text. The route carries the argument and the
          instruments on their own.
        </p>
        <p>
          Nor is any instrument here an experiment. Every number on the laboratories linked above is
          calculated by this site from the model just described. A simulator built to obey a
          transformation law cannot be evidence that the world obeys it.
        </p>
      </aside>

      <section id="in-the-paper">
        <h2>Where this enters the paper</h2>
        <p>
          The paper is thirty-one pages in two parts. The magnet and the coil are its opening
          paragraph, the clock-setting procedure is section 1, simultaneity is section 2, the
          construction is section 3, clocks and rods are section 4, velocity addition is section 5,
          and the electrodynamic half from section 6 onwards carries the field transformations,
          Doppler and aberration, and the dynamics of the electron.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/">
            Read the argument as this edition explains it
          </a>
          <a href="/discover/">Back to the discovery routes</a>
        </div>
      </section>
    </article>
  );
}
