export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Annalen der Physik · 1905</p>
        <h1>Einstein&rsquo;s four papers of 1905</h1>
        <p className="lead">
          In seven months one journal received four papers from the same author. Each takes up a
          question its century had not settled: whether light gives up its energy in whole pieces,
          whether a visible speck in still water is being shoved by molecules, whether two observers
          can disagree about what happened at the same moment, and whether a body that radiates
          energy weighs less afterwards.
        </p>
        <p>
          This edition puts four things beside one another: the German page as it was printed, an
          English rendering checked against it, an explanation at whatever depth you ask for, and an
          instrument you can operate yourself.
        </p>
        <div className="actions">
          <a className="button" href="/papers/">
            Read the papers
          </a>
          <a href="/discover/brownian-motion/">Work out the Brownian argument yourself</a>
        </div>
      </section>

      <section className="paper-catalogue">
        <article>
          <p className="eyebrow">Received 18 March · Ann. Phys. 17, 132</p>
          <h2>
            <a href="/papers/light-quanta/">Light quanta</a>
          </h2>
          <p className="german-title">
            Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen
            Gesichtspunkt
          </p>
          <p>
            Einstein offers what his own title calls a heuristic viewpoint: in how light is produced
            and absorbed, its energy behaves as though it sits in separate pieces rather than
            spreading continuously. He does not claim the wave theory is wrong. It keeps everything
            it had already explained about interference and diffraction, and he says exactly where
            he thinks it stops being the useful description.
          </p>
          <div className="actions">
            <a href="/lab/lq-01/">Compare interference with a spreading shell</a>
            <a href="/lab/lq-06/">Match radiation entropy against a gas</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Received 11 May · Ann. Phys. 17, 549</p>
          <h2>
            <a href="/papers/brownian-motion/">Brownian motion</a>
          </h2>
          <p className="german-title">
            Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in
            ruhenden Flüssigkeiten suspendierten Teilchen
          </p>
          <p>
            If heat really is molecular motion, then a particle small enough to see under a
            microscope has to be knocked about hard enough to watch. Einstein works out how far it
            should wander, and turns that into a number a laboratory can check. He adds that this
            may be the motion already named after Brown, but that the reports available to him were
            too imprecise to say. He also names the stake: if the wandering is not there, the
            molecular account of heat is in serious trouble.
          </p>
          <div className="actions">
            <a href="/lab/bm-01/">Watch the wandering</a>
            <a href="/lab/bm-07/">Weigh a molecule from it</a>
            <a href="/lab/bm-08/">Separate real motion from a blurred photograph</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Received 30 June · Ann. Phys. 17, 891</p>
          <h2>
            <a href="/papers/special-relativity/">On the electrodynamics of moving bodies</a>
          </h2>
          <p className="german-title">Zur Elektrodynamik bewegter Körper</p>
          <p>
            The paper opens with a magnet and a coil of wire. Move either one and you measure the
            same current, yet the textbook account of 1905 told two quite different stories
            depending on which was said to be moving. Einstein takes that mismatch seriously enough
            to rebuild the measurement of time around it, starting from what it actually takes to
            set two distant clocks and agree that they read alike.
          </p>
          <div className="actions">
            <a href="/lab/sr-02/">Tell both stories about the magnet</a>
            <a href="/lab/sr-03/">Set a distant clock and watch simultaneity go</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Received 27 September · Ann. Phys. 18, 639</p>
          <h2>
            <a href="/papers/mass-energy/">Does inertia depend on energy content?</a>
          </h2>
          <p className="german-title">Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?</p>
          <p>
            Three pages, and the title is a question rather than a claim. Einstein writes down the
            energy of one body twice, once from rest and once from a frame gliding past, lets it
            give off light in both accounts, and subtracts. What survives the subtraction is that
            the body has less mass afterwards, by the energy it shed divided by the square of the
            speed of light.
          </p>
          <div className="actions">
            <a href="/lab/me-02/">Follow the subtraction</a>
          </div>
        </article>
      </section>

      <section className="reading">
        <h2>Where this edition has got to</h2>
        <p>
          The explanations, the instruments and the discovery routes are written and working. The
          German source faces and the English translation aligned to them are not: what you read on
          a paper page today is explanatory text written for this edition, and every face that has
          no source behind it yet says so rather than leaving you to guess.
        </p>
        <p>
          Numbers carry their origins with them. A curve computed here is labelled as computed here,
          a measured value carries its citation, and a modern constant names the set it came from.
        </p>
        <p>
          <a href="/papers/">See all five records, including the dissertation</a>
        </p>
      </section>
    </>
  );
}
