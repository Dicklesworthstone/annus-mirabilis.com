import type { Metadata } from "next";
export const metadata: Metadata = { title: "The four papers" };
const papers = [
  { title: "Light quanta", german: "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt", locator: "Annalen der Physik (4), 17, 132–148 (1905)", status: "Critical edition in preparation" },
  { title: "Brownian motion", german: "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen", locator: "Annalen der Physik (4), 17, 549–560 (1905)", status: "Explanatory reader and laboratories available; source edition in preparation" },
  { title: "Special relativity", german: "Zur Elektrodynamik bewegter Körper", locator: "Annalen der Physik (4), 17, 891–921 (1905)", status: "Critical edition in preparation" },
  { title: "Mass and energy", german: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?", locator: "Annalen der Physik (4), 18, 639–641 (1905)", status: "Critical edition in preparation" },
];
export default function Papers() {
  return <><header className="page-intro"><p className="eyebrow">The corpus</p><h1>Four arguments.<br />Not four summaries.</h1><p className="lead">The planned edition gives every paragraph, equation and qualification a place. Its source-ledger and translation review is still in progress.</p></header><div className="paper-catalogue">{papers.map((paper, i) => <article key={paper.title}><p className="eyebrow">Paper {i + 1} · 1905</p><h2>{paper.title}</h2><p lang="de" className="german-title">{paper.german}</p><p className="fine">{paper.locator}</p><p className="badge">{paper.status}</p>{i === 1 && <div className="actions"><a href="/papers/brownian-motion/">Read the displacement argument →</a><a href="/discover/brownian-motion/">First encounter →</a><a href="/lab/bm-06/">Spreading laboratory →</a></div>}</article>)}</div><section className="reading"><h2>A companion, not a fifth flagship</h2><p>The molecular-dimensions dissertation is a planned companion record. It is not presented as an available reading or included in the four papers above.</p></section></>;
}
