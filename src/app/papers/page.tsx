import type { Metadata } from "next";
export const metadata: Metadata = { title: "The four papers" };
const papers = [
  {
    title: "Light quanta",
    german:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    locator: "Annalen der Physik (4), 17, 132–148 (1905)",
    status: "Explanatory reader and laboratories available; source edition in preparation",
  },
  {
    title: "Brownian motion",
    german:
      "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
    locator: "Annalen der Physik (4), 17, 549–560 (1905)",
    status: "Explanatory reader and laboratories available; source edition in preparation",
    workingTitle:
      "On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat",
    plainScope:
      "The document about tiny particles suspended in a liquid that is not being stirred or heated unevenly, and what the ceaseless motion of heat should make them do.",
    editorialAdditions: [
      {
        phrase: "Small",
        reason:
          'Names the scale of the particles for a reader who has not yet met the term "Brownian motion", before the argument itself establishes why size matters.',
        germanBasis: "no-direct-basis",
      },
    ],
    firstEncounterAnchor: "/papers/brownian-motion#entry-brownian-motion",
  },
  {
    title: "Special relativity",
    german: "Zur Elektrodynamik bewegter Körper",
    locator: "Annalen der Physik (4), 17, 891–921 (1905)",
    status: "Explanatory reader and laboratories available; source edition in preparation",
  },
  {
    title: "Mass and energy",
    german: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    locator: "Annalen der Physik (4), 18, 639–641 (1905)",
    status: "Explanatory reader and laboratories available; source edition in preparation",
  },
];
export default function Papers() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The corpus</p>
        <h1>The four papers of 1905</h1>
        <p className="lead">
          Every paragraph, equation and qualification in these papers has a place in the planned
          edition. The source ledgers and the translation review are still in progress.
        </p>
      </header>
      <div className="paper-catalogue">
        {papers.map((paper, i) => (
          <article key={paper.title}>
            <p className="eyebrow">Paper {i + 1} · 1905</p>
            <p lang="de" className="german-title">
              {paper.german}
            </p>
            {paper.workingTitle && paper.plainScope ? (
              <>
                <h2>{paper.workingTitle}</h2>
                {paper.editorialAdditions && paper.editorialAdditions.length > 0 && (
                  <details className="editorial-additions">
                    <summary>Editorial: this working title adds a word to the German</summary>
                    {paper.editorialAdditions.map((addition) => (
                      <p key={addition.phrase} className="fine">
                        "{addition.phrase}": {addition.reason}
                      </p>
                    ))}
                  </details>
                )}
                <p>{paper.plainScope}</p>
                <p className="fine">Also known as: {paper.title}.</p>
              </>
            ) : (
              <h2>{paper.title}</h2>
            )}
            <p className="fine">{paper.locator}</p>
            <p className="badge">{paper.status}</p>
            {i === 0 && (
              <div className="actions">
                <a href="/papers/light-quanta/">Read the entropy and light-quantum argument</a>
                <a href="/papers/light-quanta/#entry-light-quanta">Start with a counting example</a>
                <a href="/lab/lq-01/">Compare wave interference with spherical spreading</a>
                <a href="/lab/lq-06/">Match radiation entropy to gas entropy</a>
              </div>
            )}
            {i === 1 && (
              <div className="actions">
                <a href="/papers/brownian-motion/">Read the displacement argument</a>
                {paper.firstEncounterAnchor && (
                  <a href={paper.firstEncounterAnchor}>Start with one worked example</a>
                )}
                <a href="/discover/brownian-motion/">Open the Brownian motion journey</a>
                <a href="/lab/bm-06/">Open the spreading laboratory</a>
              </div>
            )}
            {i === 2 && (
              <div className="actions">
                <a href="/papers/special-relativity/">Read from clocks to electrodynamics</a>
                <a href="/papers/special-relativity/#entry-special-relativity">
                  Start by setting a distant clock
                </a>
                <a href="/lab/sr-02/">Compare both descriptions of the magnet and conductor</a>
                <a href="/lab/sr-03/">Measure moving rods, simultaneity, and causal order</a>
                <a href="/lab/sr-10/">Transform the energy and volume of a finite light complex</a>
                <a href="/lab/sr-13/">Examine electron dynamics under both force conventions</a>
              </div>
            )}
            {i === 3 && (
              <div className="actions">
                <a href="/papers/mass-energy/">Read the two-account argument</a>
                <a href="/papers/mass-energy/#entry-mass-energy">Start with one worked example</a>
                <a href="/lab/me-01/">Open the two-ledger laboratory</a>
                <a href="/lab/me-02/">Trace inertia from a drop in energy of motion</a>
              </div>
            )}
          </article>
        ))}
      </div>
      <section className="reading">
        <h2>The molecular-dimensions companion</h2>
        <p>
          The molecular-dimensions dissertation is a planned companion record. It is not presented
          as an available reading or included in the four papers above.
        </p>
      </section>
    </>
  );
}
