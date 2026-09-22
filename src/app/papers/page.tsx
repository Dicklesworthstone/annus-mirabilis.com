import type { Metadata } from "next";
import Image from "next/image";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import "../../components/home/firstPages.css";
import "./papersIndex.css";
export const metadata: Metadata = { title: "The four papers" };
const papers = [
  {
    slug: "light-quanta",
    title: "Light quanta",
    german:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    received: "Received 18 March 1905",
    locator: "Annalen der Physik (4), 17, 132–148 (1905)",
    status: "German text set · English translation not started",
    scope:
      "Light behaves, in how it is produced and absorbed, as though its energy sits in separate pieces. Einstein calls this a heuristic viewpoint in the title itself, and says where he thinks the wave description stops being the useful one.",
  },
  {
    slug: "brownian-motion",
    title: "Brownian motion",
    german:
      "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
    received: "Received 11 May 1905",
    locator: "Annalen der Physik (4), 17, 549–560 (1905)",
    status: "German text set · English translation not started",
    plainScope:
      "A paper about tiny particles suspended in a liquid that nobody is stirring or heating unevenly, and what the ceaseless motion of heat should make them do.",
    workingTitle:
      "On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat",
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
    slug: "special-relativity",
    title: "Special relativity",
    german: "Zur Elektrodynamik bewegter Körper",
    received: "Received 30 June 1905",
    locator: "Annalen der Physik (4), 17, 891–921 (1905)",
    status: "German text in transcription · English translation not started",
    scope:
      "Move a magnet past a coil, or the coil past the magnet, and you measure the same current; the textbook account of the day told two different stories. Einstein rebuilds the measurement of time around that mismatch, beginning with what it takes to set two distant clocks.",
  },
  {
    slug: "mass-energy",
    title: "Mass and energy",
    german: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    received: "Received 27 September 1905",
    locator: "Annalen der Physik (4), 18, 639–641 (1905)",
    status: "German text set · English translation not started",
    scope:
      "Three pages that follow from the June paper. One body's energy is written down twice, from rest and from a frame gliding past, and the two accounts are subtracted. A body that gives off energy has less mass afterwards.",
  },
];
export default function Papers() {
  const plates = loadFirstPages();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">The corpus</p>
        <h1>The four papers of 1905</h1>
        <p className="lead">
          Four papers, sent to Annalen der Physik between March and September, in the order the
          journal received them. The last of them is a three-page consequence of the third, so the
          order is worth keeping.
        </p>
      </header>
      <ol className="paper-index">
        {papers.map((paper) => {
          const plate = plates.find((p) => p.slug === paper.slug);
          return (
            <li key={paper.title} className="paper-entry">
              {plate && (
                <div className="paper-entry-plate">
                  <a href={`/papers/${paper.slug}/`}>
                    <Image
                      src={`/figures/plates/${plate.key}-first-page-400.webp`}
                      width={400}
                      height={662}
                      alt={`First page of ${paper.title}, as printed`}
                    />
                  </a>
                  <p className="fine">
                    <span className="first-page-marks" aria-hidden="true">
                      {Array.from({ length: plate.pages }, (_, n) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: the marks are identical and never reorder
                        <i key={n} />
                      ))}
                    </span>
                    {plate.pages} pages, pp. {plate.firstPage}&ndash;{plate.lastPage}
                  </p>
                </div>
              )}
              <div className="paper-entry-body">
                <p className="eyebrow">{paper.received}</p>
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
                  <>
                    <h2>{paper.title}</h2>
                    <p>{paper.scope}</p>
                  </>
                )}
                <p className="fine">{paper.locator}</p>
                <p className="badge">{paper.status}</p>
                {paper.title === "Light quanta" && (
                  <div className="actions">
                    <a href="/papers/light-quanta/">Read the argument</a>
                    <a href="/papers/light-quanta/#entry-light-quanta">
                      Start with a counting example
                    </a>
                    <a href="/lab/lq-01/">Compare interference with a spreading shell</a>
                    <a href="/lab/lq-06/">Match radiation entropy against a gas</a>
                  </div>
                )}
                {paper.title === "Brownian motion" && (
                  <div className="actions">
                    <a href="/papers/brownian-motion/">Read the argument</a>
                    {paper.firstEncounterAnchor && (
                      <a href={paper.firstEncounterAnchor}>Start with one worked example</a>
                    )}
                    <a href="/discover/brownian-motion/">Work it out yourself</a>
                    <a href="/lab/bm-06/">Watch a distribution spread</a>
                  </div>
                )}
                {paper.title === "Special relativity" && (
                  <div className="actions">
                    <a href="/papers/special-relativity/">Read the argument</a>
                    <a href="/papers/special-relativity/#entry-special-relativity">
                      Start by setting a distant clock
                    </a>
                    <a href="/lab/sr-02/">Tell both stories about the magnet</a>
                    <a href="/lab/sr-03/">Change the speed and watch rods and clocks disagree</a>
                    <a href="/lab/sr-10/">Transform a finite light complex</a>
                  </div>
                )}
                {paper.title === "Mass and energy" && (
                  <div className="actions">
                    <a href="/papers/mass-energy/">Read the argument</a>
                    <a href="/papers/mass-energy/#entry-mass-energy">
                      Start with one worked example
                    </a>
                    <a href="/lab/me-01/">Keep both ledgers at once</a>
                    <a href="/lab/me-02/">Follow the subtraction</a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <section className="reading">
        <h2>The molecular-dimensions companion</h2>
        <p>
          Einstein&rsquo;s doctoral dissertation,{" "}
          <span lang="de">Eine neue Bestimmung der Moleküldimensionen</span>, belongs beside the
          Brownian paper: it gets at the same molecular quantities by a different route. It is a
          planned companion record and there is nothing to read here yet.
        </p>
      </section>
    </>
  );
}
