import { Formula } from "../components/edition/Formula.tsx";
import { FirstPages } from "../components/home/FirstPages.tsx";
import "../components/home/wideProse.css";
import { loadFirstPages } from "../components/home/firstPages.ts";
import { germanTextSentences, germanTextState } from "../content/germanTextState.ts";
import type { RouteSlug } from "../content/ids.ts";
import { translationSentence, translationState } from "../content/translationState.ts";
export default function Home() {
  // Counted from content/translation-units, so this line changes when the units do (dispatch 150).
  const papers = loadFirstPages();
  const translationNow = translationSentence(
    translationState(process.cwd()),
    new Map(papers.map((paper) => [paper.slug, paper.title])),
  );
  // Read from the German faces' own loader, so relativity's line changes when its face does.
  const germanNow = germanTextSentences(
    papers.map((paper) => ({
      title: paper.title,
      state: germanTextState(paper.slug as RouteSlug),
    })),
  );
  return (
    <>
      <section className="hero hero-with-plates">
        <div className="hero-with-plates-head">
          <div>
            <p className="eyebrow">Annalen der Physik, 1905</p>
            <h1>Four papers, 1905</h1>
          </div>
          <div>
            <p className="lead">
              The four papers Albert Einstein sent to the Annalen der Physik in 1905, each explained
              at the depth you choose, with instruments that work out what follows when you change
              an assumption.
            </p>
          </div>
        </div>
        <FirstPages invitations />
        <div className="actions">
          <a className="button" href="/papers/">
            Read the papers
          </a>
          <a href="/discover/brownian-motion/">Work out the Brownian argument yourself</a>
        </div>
      </section>

      <p className="lead catalogue-intro">
        Each of them unsettled something that had looked settled: how light carries its energy,
        whether molecules are real, what it means for two events to happen at once, and where a
        body&rsquo;s mass goes when it gives off light.
      </p>

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
            <a href="/lab/bm-07/">Get Avogadro&rsquo;s number out of it</a>
            <a href="/lab/bm-08/">Separate real motion from a blurred photograph</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Received 30 June · Ann. Phys. 17, 891</p>
          <h2>
            <a href="/papers/special-relativity/">Special relativity</a>
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
            <a href="/lab/sr-03/">Change the speed and watch rods and clocks disagree</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Received 27 September · Ann. Phys. 18, 639</p>
          <h2>
            <a href="/papers/mass-energy/">Mass and energy</a>
          </h2>
          <p className="german-title">
            Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?
          </p>
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

      <section className="reading page-flush">
        <h2>What the printed page actually says</h2>
        <p>
          The fourth paper runs to three pages and comes down to one line, in the notation it was
          set in:
        </p>
        <Formula latex={String.raw`K_0 - K_1 = \frac{L}{V^2}\,\frac{v^2}{2}`} />
        <p>
          <em>L</em> is the energy the body has just given off, <em>V</em> is the speed of light,
          and <em>K</em>
          <sub>0</sub>&nbsp;&minus;&nbsp;<em>K</em>
          <sub>1</sub> is the kinetic energy it has lost in doing so. Set that beside the
          schoolroom&rsquo;s <em>½mv</em>
          <sup>2</sup> and the quantity <em>L</em>/<em>V</em>
          <sup>2</sup> is sitting exactly where a mass belongs. That is the argument. The formula
          everyone can recite is not on the page: this paper never writes it.
        </p>
        <p className="fine">
          Ann. Phys. (4) 18, 639&ndash;641 (1905), p. 641, received 27 September. Transcribed here
          from the pinned facsimile; all three pages are set.
        </p>
      </section>

      <section className="reading page-flush">
        <h2>Where this edition has got to</h2>
        <p>
          The explanations, the instruments and the discovery routes are written and working.{" "}
          {germanNow}
        </p>
        <p>
          {translationNow} For a paper with no translation yet, the English, parallel and
          interlinear faces say it is unavailable instead of showing you a paraphrase and letting
          you assume it was checked against the German.
        </p>
        <p>
          The page images come from scans listed, each with its source, its terms and its digest, on
          the <a href="/sources/">sources page</a>. The edition counts four papers and keeps
          Einstein&rsquo;s dissertation beside them; <a href="/about/#count-note">About</a> says
          why.
        </p>
        <p>
          <a href="/papers/">See the four papers in the order they were received</a>
        </p>
      </section>
    </>
  );
}
