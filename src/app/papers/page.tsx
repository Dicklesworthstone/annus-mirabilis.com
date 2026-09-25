import type { Metadata } from "next";
import { firstPagePlate, loadFirstPages } from "../../components/home/firstPages.ts";
import "../../components/home/firstPages.css";
import "./papersIndex.css";
import "../../components/home/wideProse.css";
import { type GermanTextState, germanTextState } from "../../content/germanTextState.ts";
import type { RouteSlug } from "../../content/ids.ts";
import { type PaperTranslation, translationState } from "../../content/translationState.ts";

/*
 * A paper's entry names a layer only when it is missing, read from the records at build time
 * (dispatch 153): that is navigation. It carries no review badge ("German text in unreviewed draft
 * · English translation checked by AI agents"), at the owner's word
 * (D-2026-09-25-no-review-status-banners).
 */
function missingLayers(
  german: GermanTextState,
  translation: PaperTranslation | undefined,
): string | null {
  const missing = [
    ...(german === "not-started" ? ["the German text"] : []),
    ...(translation === undefined || translation.units === 0 ? ["the English translation"] : []),
  ];
  return missing.length === 0 ? null : `Not yet available: ${missing.join(" and ")}.`;
}

export const metadata: Metadata = {
  title: "The four papers",
  description:
    "The four papers Einstein sent to the Annalen der Physik in 1905, in the order the journal received them, each under its printed German title.",
};
const papers = [
  {
    slug: "light-quanta",
    title: "Light quanta",
    german:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    received: "Received 18 March 1905",
    locator: "Annalen der Physik (4), 17, 132–148 (1905)",
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
    plainScope:
      "If heat is the motion of molecules, a particle visible under a microscope and suspended in a liquid at rest should never stop moving. Einstein works out how far it should wander in a given time: a number a laboratory can check.",
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
    firstEncounterAnchor: "/papers/brownian-motion/#entry-brownian-motion",
  },
  {
    slug: "special-relativity",
    title: "Special relativity",
    german: "Zur Elektrodynamik bewegter Körper",
    received: "Received 30 June 1905",
    locator: "Annalen der Physik (4), 17, 891–921 (1905)",
    scope:
      "Move a magnet past a coil, or the coil past the magnet, and you measure the same current; the textbook account of the day told two different stories. Einstein rebuilds the measurement of time around that mismatch, beginning with what it takes to set two distant clocks.",
  },
  {
    slug: "mass-energy",
    title: "Mass and energy",
    german: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    received: "Received 27 September 1905",
    locator: "Annalen der Physik (4), 18, 639–641 (1905)",
    scope:
      "Three pages that follow from the June paper. One body's energy is written down twice, from rest and from a frame gliding past, and the two accounts are subtracted. A body that gives off energy has less mass afterwards.",
  },
];
export default function Papers() {
  const plates = loadFirstPages();
  const translations = translationState(process.cwd());
  const missingOf = (slug: string) =>
    missingLayers(
      germanTextState(slug as RouteSlug),
      translations.find((t) => t.slug === slug),
    );
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
                    {/* A plain img with a srcSet, as on the home row (firstPagePlate says why);
                        the plate is 14rem wide from 700px and a third of the row below that. */}
                    <img
                      {...firstPagePlate(plate.key)}
                      sizes="(min-width: 700px) 14rem, calc(33.3vw - 16px)"
                      width={400}
                      height={662}
                      loading="lazy"
                      decoding="async"
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
                {/* Every entry leads with its English working title, then a plain scope sentence,
                    and names the paper the site's way only after them (am-design-papers-index-afnu;
                    TanElk's ruling, dispatch 99). A reader can choose a paper without knowing its
                    conventional name. The Brownian working title is the one the bead specifies;
                    the other three are their receipts' titleEnglishWorking. */}
                <h2 className="paper-entry-title">
                  {paper.workingTitle ?? plate?.workingTitle ?? paper.title}
                </h2>
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
                <p>{paper.plainScope ?? paper.scope}</p>
                <p className="fine">Also known as: {paper.title}.</p>
                <p className="fine">{paper.locator}</p>
                {missingOf(paper.slug) ? (
                  <p className="notice" data-missing-layers>
                    {missingOf(paper.slug)}
                  </p>
                ) : null}
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
      <section className="reading page-flush">
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
