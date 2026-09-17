import type { Metadata } from "next";
export const metadata: Metadata = { title: "The four papers" };
const papers = [
  {
    title: "Light quanta",
    german:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    locator: "Annalen der Physik (4), 17, 132–148 (1905)",
    status: "Critical edition in preparation",
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
    status: "Critical edition in preparation",
  },
  {
    title: "Mass and energy",
    german: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    locator: "Annalen der Physik (4), 18, 639–641 (1905)",
    status: "Critical edition in preparation",
  },
];
export default function Papers() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The corpus</p>
        <h1>
          Four arguments.
          <br />
          Not four summaries.
        </h1>
        <p className="lead">
          The planned edition gives every paragraph, equation and qualification a place. Its
          source-ledger and translation review is still in progress.
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
                <a href="/lab/lq-01/">Wave description & energy spreading →</a>
                <a href="/lab/lq-06/">Derive the light quantum from entropy matching →</a>
              </div>
            )}
            {i === 1 && (
              <div className="actions">
                <a href="/papers/brownian-motion/">Read the displacement argument →</a>
                {paper.firstEncounterAnchor && (
                  <a href={paper.firstEncounterAnchor}>Show me one example first →</a>
                )}
                <a href="/discover/brownian-motion/">First encounter →</a>
                <a href="/lab/bm-06/">Spreading laboratory →</a>
              </div>
            )}
            {i === 2 && (
              <div className="actions">
                <a href="/lab/sr-02/">Magnet and conductor →</a>
                <a href="/lab/sr-03/">Rod measurement & simultaneity →</a>
                <a href="/lab/sr-10/">Finite light complex →</a>
                <a href="/lab/sr-13/">Electron dynamics & mass conventions →</a>
              </div>
            )}
            {i === 3 && (
              <div className="actions">
                <a href="/lab/me-02/">Inertia from the small-speed coefficient →</a>
              </div>
            )}
          </article>
        ))}
      </div>
      <section className="reading">
        <h2>A companion, not a fifth flagship</h2>
        <p>
          The molecular-dimensions dissertation is a planned companion record. It is not presented
          as an available reading or included in the four papers above.
        </p>
      </section>
    </>
  );
}
