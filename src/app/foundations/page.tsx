import { contentIndex, loadFoundation } from "../../content/server";
import "../../reader/reader.css";
export const metadata = { title: "Foundations for the Brownian argument", alternates: { canonical: "https://annus-mirabilis.com/foundations/" } };
export default async function Page() {
  const index = await contentIndex(), lessons = await Promise.all(index.payloads.filter(p => p.kind === "foundation").map(p => loadFoundation(p.id)));
  return <><header className="page-intro"><p className="eyebrow">A finite path through the prerequisites</p><h1>Start with the idea<br/>that is missing.</h1><p className="lead">Each lesson includes a worked example and a stopping point. Follow the prerequisites as far as you need, then return to the argument.</p><p className="fine">Newly authored explanatory previews; editorial review remains pending.</p><a href="/papers/brownian-motion/">Read the Brownian argument →</a></header><div className="foundation-grid">{lessons.map(f => <article key={f.id}><h2><a href={`/foundations/${f.id}/`}>{f.title}</a></h2><p>{f.summary}</p></article>)}</div></>;
}
