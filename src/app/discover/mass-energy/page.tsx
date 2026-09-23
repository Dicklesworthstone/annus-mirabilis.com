import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { MASS_ENERGY_SHELF_CARDS } from "../../../content/massEnergyShelf.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";
import { RouteMap } from "../../../discovery/RouteMap.tsx";
import { StepDoor, StepDoors } from "../../../discovery/StepDoor.tsx";

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
 * ON THE SHELF CARDS. Five are pre-1905 and carry status "available". The sixth is the
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
 * failure the verification field exists to prevent. Unverified cards render with
 * CardDetail's visible "Awaiting verification" marker, which is the honest state, and
 * publicationGate.ts refuses them in the production and preview profiles until a human
 * verifies them. That refusal is correct and I have not worked around it.
 */

export default function MassEnergyRoute() {
  return (
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
          with a number. You can reach it yourself in five moves; the only hard one is knowing what
          to subtract.
        </p>
        <p className="fine">
          A route you could take, not a transcript of Einstein&rsquo;s private thoughts. Every step
          can be read without running anything.
        </p>
      </header>
      <RouteMap slug="mass-energy" />

      <section id="step-01">
        <p className="step-number">01 / Start with a body that does nothing</p>
        <h2>Where can the energy have gone?</h2>
        <p>
          Put a body at rest in front of you and let it give off light: two equal flashes, one to
          the left and one to the right, at the same moment. Because the flashes are equal and
          opposite, whatever push one gives the body the other takes away. The body does not recoil.
          It sits exactly where it sat, at rest, before and after.
        </p>
        <p>
          Energy is conserved, so the energy carried off by the flashes came out of the body. But
          the body has not slowed down, because it was not moving, and it has not moved. Nothing you
          can see about it has changed. A quantity has left and no visible property has altered to
          account for it.
        </p>
        <details>
          <summary>Why insist on two flashes rather than one?</summary>
          <p>
            One flash would push the body the other way, and then some of the bookkeeping would be
            about the recoil rather than about the body itself. The symmetric pair is a device for
            keeping the speed fixed so that only one unknown is left. It is a choice made to isolate
            a question, not a fact about how bodies emit light.
          </p>
        </details>
      </section>

      <section id="step-02">
        <p className="step-number">02 / Make a prediction</p>
        <h2>Is the body lighter, or is that a category error?</h2>
        <p>
          Before going on, commit to an answer. After the flashes have left, is the body&rsquo;s
          mass the same as before, smaller, or is the question malformed because mass is not the
          sort of thing energy can be taken out of? There is a respectable case for each in 1904,
          and the argument below only decides between them under premises you will be able to see.
        </p>
        <details>
          <summary>The case for &ldquo;the question is malformed&rdquo;</summary>
          <p>
            Mass in 1904 is the measure of how hard a body is to accelerate, fixed by the body and
            not by its history. Energy is a quantity of account that bodies exchange. On that
            reading, asking whether emitting light changes the mass is like asking whether paying a
            bill changes your height. There is a serious case for it, and nothing in the argument
            that follows refutes it directly. What the argument does is produce a number where that
            position predicts none.
          </p>
        </details>
      </section>

      <section id="step-03">
        <p className="step-number">03 / Describe the same event twice</p>
        <h2>Two accounts of one emission</h2>
        <p>
          This is the move, and the only one in the route that is not bookkeeping. Describe the same
          emission a second time, from a frame gliding steadily past at speed <em>v</em>. Nothing
          about the body changes; you have changed only where you are standing. Write down the
          body&rsquo;s energy before and after in each account, four quantities in all.
        </p>
        <p>
          You cannot evaluate any of the four, because each contains the body&rsquo;s absolute
          energy content, which no one knows, in 1904 or now. That is why the second account earns
          its place: the quantity you cannot supply appears in both accounts, so a subtraction
          removes it.
        </p>
        <p>
          The two accounts do not agree about the light, though. A given pair of flashes is measured
          to carry different total energy depending on the frame it is measured in, and by how much
          is fixed by the speed and the direction. <strong>That is the imported step.</strong> It
          comes from section 8 of the relativity paper, received in June of the same year, and it is
          the one thing in this route that a reader standing at the end of 1904 could not reach for.
          It is on the shelf below, marked as an import, with where it came from.
        </p>
        <details>
          <summary>Why the import is declared rather than absorbed</summary>
          <p>
            A reconstruction that quietly used a 1905 result while claiming to start from 1904 would
            be telling you the argument is cheaper than it is. The September paper openly rests on
            the June one. Naming the debt is the difference between a route and a conjuring trick.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/lab/sr-10/">
            Transform a finite light complex and watch its energy change
          </StepDoor>
        </StepDoors>
      </section>

      <section id="step-04">
        <p className="step-number">04 / Subtract</p>
        <h2>What survives when the unknowns cancel</h2>
        <p>
          Take the difference between the two accounts before the emission, take it again after, and
          subtract one from the other. Every absolute body energy disappears, because each appears
          once in each account. What is left on one side is a difference of differences, and on the
          other side the light energy multiplied by a factor that depends only on the speed.
        </p>
        <p>
          The quantity that survives is the difference between what the moving observer and the
          resting observer say the body&rsquo;s energy is, and how that difference changed when the
          light left. For a body whose speed never changed, that is its energy of motion, plus
          whatever fixed offset separates the two accounts.
        </p>
        <details>
          <summary>The premise hiding in &ldquo;whatever fixed offset&rdquo;</summary>
          <p>
            Identifying the surviving quantity as a change in energy of motion requires that the
            offset is the same before and after. Nothing so far forces that. If the offset shifted
            when the light left, the subtraction still holds but it no longer isolates the energy of
            motion, and the route stops here with a constraint rather than a result. This is the
            premise worth arguing about, and the workbench below lets you remove it and see what
            survives.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/discover/mass-energy/investigate/">
            Assemble the argument yourself and take that premise out
          </StepDoor>
        </StepDoors>
      </section>

      <section id="step-05">
        <p className="step-number">05 / Read the coefficient</p>
        <h2>A number where a category error predicted none</h2>
        <p>
          Let the second observer glide past slowly and the speed factor simplifies. The paper
          prints the result on its last page, in the notation it was set in, where <em>L</em> is the
          energy given off and <em>V</em> is the speed of light:
        </p>
        <Formula latex={String.raw`K_0 - K_1 = \frac{L}{V^2}\,\frac{v^2}{2}`} />
        <p>
          Now put that beside the energy of motion you already had on the shelf, one half of the
          mass times the speed squared. The two expressions have the same shape, and in the place
          where a mass belongs stands the energy given off divided by the square of the speed of
          light. The body behaves, for every purpose that mass is measured by, as though it lost
          that much of it.
        </p>
        <details>
          <summary>Why the slow-speed limit and not the exact factor</summary>
          <p>
            At a finite speed you get a coefficient that depends on the speed, which is a proxy and
            not an identification: you would be reading a mass off a quantity that still remembers
            how fast you happened to be gliding. The identification is made in the limit as the
            speed goes to zero, which is where the comparison with one half m v squared is exact.
            Running the instrument at zero speed instead gives zero on both sides and settles
            nothing, which is a different thing from taking the limit.
          </p>
        </details>
        <StepDoors>
          <StepDoor href="/lab/me-02/">
            Compare the finite-speed proxy with the limit that identifies the mass
          </StepDoor>
        </StepDoors>
      </section>

      <section id="shelf">
        <h2>The 1904 shelf, and the one thing that is not on it</h2>
        <p>
          Five of the six results below were available to a careful reader at the end of 1904. The
          sixth is the June 1905 transformation used at step 3, and it is marked as an import
          because it is one.
        </p>
        <Shelf cards={MASS_ENERGY_SHELF_CARDS} />
        <p className="fine">
          The dates on these cards come from standard bibliographies. No one here has checked them
          against the volumes, and the shelf marks each card as awaiting verification.
        </p>
      </section>

      <aside className="notice">
        <h2>What this argument does not establish</h2>
        <p>
          It does not show that mass and energy are the same thing. It shows that a body which gives
          off energy <em>L</em> as light behaves afterwards as though its mass were smaller by{" "}
          <em>L</em>/<em>V</em>&sup2;, under the premises named at steps 3 and 4. The paper then
          generalises in one sentence: it calls it evident that nothing depends on the energy
          leaving as radiation, and concludes that the mass of a body is a measure of its energy
          content. That last step is a stated inference, not a further derivation, and the familiar
          equation is printed nowhere in the paper.
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
          The paper is three pages and its title is a question rather than a claim. It sets out the
          two accounts, performs the subtraction, takes the slow-speed limit, and states the
          conclusion in a single sentence. Its German text is on this site, not yet reviewed; the
          English translation is not written yet.
        </p>
        <div className="actions">
          <a className="button" href="/papers/mass-energy/">
            Read the argument as the paper makes it
          </a>
          <a href="/discover/">Back to the discovery routes</a>
        </div>
      </section>
    </article>
  );
}
