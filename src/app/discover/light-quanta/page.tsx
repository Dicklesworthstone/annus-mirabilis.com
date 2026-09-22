import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { LIGHT_QUANTA_SHELF_CARDS } from "../../../content/lightQuantaShelf.ts";
import { Shelf } from "../../../discovery/cards/Shelf.tsx";

export const metadata: Metadata = {
  title: "Waves explain the light you see. What about the moment it is made?",
  description:
    "A reconstruction of the March 1905 argument: keep everything the wave theory explains, then compare two entropies and read the exponent.",
};

/**
 * The light-quanta discovery route.
 *
 * A reconstruction, not a biography. Nothing here claims to be what Einstein thought.
 *
 * THIS ROUTE NEEDS NO ADMITTED IMPORT. Every card on its shelf is pre-1905, unlike the
 * mass-energy route which has to borrow section 8 of the June paper. The whole argument is
 * reachable from 1904.
 *
 * THE MODALITY IS THE POINT AND IS PRESERVED THROUGHOUT. The paper's own title calls this a
 * heuristic viewpoint, and p. 143 states the conclusion as radiation behaving "so, wie wenn" -
 * as if - it consisted of independent quanta, then says it is "natural to investigate" whether
 * the laws of emission follow. The route never upgrades that to a proof, because the paper does
 * not. AGENTS.md's anachronism table forbids three specific slips this route runs close to:
 * describing Einstein as proving light is not a wave, crediting Planck with the light-quantum
 * hypothesis, and opening on the "ultraviolet catastrophe", which is Ehrenfest's phrase from
 * 1911. The wave theory keeps its successes at step 1 and is never refuted; the Planck card
 * carries the resonator/radiation distinction as a stated limit; and the divergence at step 3 is
 * described as what the counting gives, with the later name only in the note that attributes it.
 */
export default function LightQuantaRoute() {
  return (
    <article className="reading encounter">
      <header>
        <p className="eyebrow">Discover · A route you could take</p>
        <h1>
          Waves explain the light you see.
          <br />
          What about the moment it is made?
        </h1>
        <p className="lead">
          The wave theory of light was not in trouble in 1904. It predicted where the fringes fall
          and it was right. This route keeps every one of those successes, and then looks at the one
          place the evidence does not reach: not light travelling, but light being made and taken
          up. Seven moves, and the hard one is noticing what you are allowed to compare.
        </p>
        <p className="fine">
          A route you could take, not a transcript of Einstein&rsquo;s private thoughts. Every step
          can be read without running anything.
        </p>
      </header>

      <section>
        <p className="step-number">01 / Start with what works</p>
        <h2>The wave theory is not the problem</h2>
        <p>
          Send light through two slits and the bright and dark bands land where the wave account
          says they will. Diffraction, interference, polarisation, the whole of optics: the wave
          description predicts them quantitatively and measurement agrees. Nothing in this route
          takes any of that away, and any replacement that cannot reproduce it is not a candidate.
        </p>
        <p>
          The ending is often told as though waves were overthrown. They were not. What follows
          narrows to a region the optical evidence never covered.
        </p>
        <p>
          <a href="/lab/lq-01/">See what continuous waves account for</a>
        </p>
      </section>

      <section>
        <p className="step-number">02 / Find the edge of the evidence</p>
        <h2>Optics measures averages</h2>
        <p>
          The gap is easy to miss, because it is a statement about instruments rather than about
          light. Every optical measurement confirming the wave theory is an average over an enormous
          number of cycles. A fringe pattern is a time-averaged intensity. Nothing in that evidence
          says what happens in a single act of emission or absorption, because no optical
          measurement of the period resolved one.
        </p>
        <p>
          So there is a region where the wave theory is untested rather than confirmed: the moment
          light is produced, and the moment a body takes it up. And there is already an observation
          sitting in that region that does not sit comfortably. Make ultraviolet light brighter and
          more electrons come out of a metal, but they do not come out faster. Brightness buys you
          more of them, not more energetic ones.
        </p>
        <details>
          <summary>Why that is uncomfortable for a wave</summary>
          <p>
            A brighter wave carries more energy through the same area. If an electron is shaken
            loose by the wave arriving at it, a stronger shake should give a more energetic
            electron. Lenard measured it in 1902 and it does not. This is not fatal to the wave
            theory on its own, and the route does not treat it as fatal: it is one observation in
            the region where the evidence for waves runs out.
          </p>
        </details>
      </section>

      <section>
        <p className="step-number">03 / Make a prediction</p>
        <h2>Give every vibration its fair share. What is the total?</h2>
        <p>
          Before going further, commit to an answer. Thermal equilibrium hands every vibrating
          degree of freedom the same average energy, fixed by the temperature. A box of radiation
          has vibrations at every frequency. Add up the energy that rule assigns across all of them:
          does the total come out finite, large but finite, or something else?
        </p>
        <p>
          The sum does not converge. Every frequency is handed the same share and there is no
          highest frequency, so the total energy in the box grows without bound. The paper writes
          the integral out, and it is infinite.
        </p>
        <details>
          <summary>What this does and does not show</summary>
          <p>
            It shows that two things cannot both be applied without limit: the equal-shares rule of
            kinetic theory, and a field with unboundedly many vibrations. It does not say which one
            to give up, and it says nothing about interference. A reader who concludes "so waves are
            wrong" has moved faster than the argument. The name this result is known by, the
            "ultraviolet catastrophe", is Paul Ehrenfest's, from 1911; the paper does not use it.
          </p>
        </details>
        <p>
          <a href="/lab/lq-02/">Watch the total refuse to settle</a>
        </p>
      </section>

      <section>
        <p className="step-number">04 / Work where a law is solid</p>
        <h2>Pick the regime you can trust, then take its entropy</h2>
        <p>
          Rather than argue about the whole spectrum, retreat to ground that holds. Wien&rsquo;s law
          describes the measured distribution well when the frequency is high and the temperature
          low, and in 1904 that is not in dispute. Work only there.
        </p>
        <p>
          In that regime you can write down the entropy of a quantity of monochromatic radiation,
          and then ask a single question about it: if you keep the energy and the frequency band
          fixed and let the radiation occupy a different volume, how does the entropy change? That
          is a question about counting, not about mechanism, and it can be answered.
        </p>
        <p>
          <a href="/lab/lq-03/">Find where Wien&rsquo;s law holds and where it stops</a>{" "}
          <a href="/lab/lq-04/">Take the entropy of a spectrum and change its volume</a>
        </p>
      </section>

      <section>
        <p className="step-number">05 / Do the same sum for something you understand</p>
        <h2>How a gas of independent things behaves</h2>
        <p>
          Now put the radiation aside and take a container of gas with a definite number of
          particles that do not interact. Ask exactly the same question: keep everything else fixed,
          let it occupy a different volume, and see how the entropy changes. The answer comes from
          counting how many ways the particles can be arranged, and it depends on the volume
          logarithmically, with the number of particles as a multiplier out front.
        </p>
        <p>
          You now have two answers to one question, derived independently: one for radiation in a
          regime where a measured law holds, one for a gas of a known number of independent things.
        </p>
        <p>
          <a href="/lab/lq-05/">Count independent configurations in the gas</a>
        </p>
      </section>

      <section>
        <p className="step-number">06 / Compare the two, and read the exponent</p>
        <h2>The move</h2>
        <p>
          The two expressions have the same shape. Set them beside each other and the multiplier
          that counts particles in the gas is matched, in the radiation case, by the total energy
          divided by a quantity built from the frequency. The paper states the conclusion in the
          careful form its title promises: radiation of low density behaves, as far as this
          thermodynamic question goes, <em>as if</em> it consisted of mutually independent energy
          quanta each of size
        </p>
        <Formula latex={String.raw`\frac{R\,\beta\,\nu}{N}`} />
        <p>
          <span lang="de">R</span> is the gas constant and <span lang="de">N</span> the number of
          molecules in a gram-molecule; <em>β</em> here is Wien&rsquo;s constant, and is not the
          <em> β</em> of the relativity paper, where the same letter means something else entirely.
        </p>
        <details>
          <summary>What has and has not been established</summary>
          <p>
            One quantity has been shown to behave, in one regime, in one respect, like a count. That
            is a resemblance in a formula, and a resemblance is not a mechanism. The paper does not
            claim otherwise: having reached this point it says it is natural to go on and ask
            whether the laws of emission and transformation also look as though light were made this
            way. That is an invitation to test, and the last step takes it.
          </p>
          <p>
            One thing is borrowed, and it needs stating exactly. Planck had already let his
            resonators exchange energy in finite elements, and his constants are used here. That is
            a statement about the material oscillators trading energy with the field. It is not the
            statement that free radiation is itself made of independent quanta, which is what this
            step arrives at, and the two should not be run together.
          </p>
        </details>
        <p>
          <a href="/lab/lq-06/">Put the two entropy laws side by side and read the exponent</a>
        </p>
      </section>

      <section>
        <p className="step-number">07 / Check it against the world</p>
        <h2>Three predictions it did not have to get right</h2>
        <p>
          A resemblance found in one thermodynamic calculation earns nothing until it says something
          about a different experiment. Take the picture seriously for a moment and three
          consequences follow, each testable against work already done by 1904.
        </p>
        <p>
          Light re-emitted by a fluorescing substance should not have a higher frequency than the
          light that excited it, because one incoming piece cannot pay for a larger outgoing one.
          Stokes had recorded exactly that in 1852. The electrons driven out of a metal should gain
          energy set by the frequency and not by the brightness, which is what Lenard measured in
          1902 and what the wave account could not place. And ultraviolet light should only ionise a
          gas when its frequency is high enough, whatever its intensity.
        </p>
        <details>
          <summary>How much these three are worth</summary>
          <p>
            They are consistency, not proof, and the paper is careful about it: a rule about the
            energy available per absorption sets a bound and does not fix how often absorption
            happens, so a threshold does not by itself predict a yield. A simulator on this site
            that is built with a threshold in it cannot be evidence that nature has one, and the
            instruments below say so about themselves.
          </p>
        </details>
        <p>
          <a href="/lab/lq-07/">Test the fluorescence budget</a>{" "}
          <a href="/lab/lq-08/">Separate how many electrons from how energetic</a>{" "}
          <a href="/lab/lq-09/">Set a threshold and see what it does not determine</a>
        </p>
      </section>

      <section>
        <h2>The 1904 shelf</h2>
        <p>
          Everything this route uses was available to a careful reader at the end of 1904. There is
          no imported later result: unlike the mass-energy route, which has to borrow from the June
          relativity paper, this argument stands on its own shelf.
        </p>
        <Shelf cards={LIGHT_QUANTA_SHELF_CARDS} />
        <p className="fine">
          These cards carry no verification record. Their dates are from standard bibliography, not
          from anyone here having opened the volumes, and the shelf marks each one as awaiting
          verification rather than implying a check that has not happened.
        </p>
      </section>

      <aside className="notice">
        <h2>What this argument does not establish</h2>
        <p>
          It does not show that light is not a wave, and the paper does not say so. Everything the
          wave account explained at step 1 it still explains, and this route would be worthless if
          it did not. What is offered is a viewpoint for the region the optical evidence never
          reached, held as far as the argument supports and no further.
        </p>
        <p>
          Nor does any instrument here test nature. Every number on the laboratories linked above is
          calculated by this site from the model being described. A model programmed with a
          threshold will show you a threshold; that is a demonstration of the model, and only an
          independent measurement can say whether the world agrees.
        </p>
      </aside>

      <section>
        <h2>Where this enters the paper</h2>
        <p>
          The paper runs to seventeen pages and nine numbered sections. The divergence is section 1,
          the entropy of radiation is sections 3 and 4, the gas comparison is section 5, the
          conclusion this route builds towards is section 6, and the three checks are sections 7 to
          9. Its German text is set in this edition; the English translation is not written yet, and
          the source face says so.
        </p>
        <div className="actions">
          <a className="button" href="/papers/light-quanta/">
            Read the argument as the paper makes it
          </a>
          <a href="/discover/">Back to the discovery routes</a>
        </div>
      </section>
    </article>
  );
}
