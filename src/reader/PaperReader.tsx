import { EquationScope } from "../equations/EquationScope";
import { SemanticEquation } from "../equations/SemanticEquation";
import equationPayload from "../generated/brownian-equations.json";
import type { CompiledEquation } from "../equations/viewTypes";
import { loadPaper } from "../content/server";
import { ReadingBlocks, FoundationBody, FoundationLink } from "./Blocks";
import { ReaderController } from "./ReaderController";
import { TracerLab } from "../components/lab/TracerLab";
import tracerExample from "../generated/bm01-example.json";
import type { PreparedBm01Example } from "../experiments/bm01/session";
import "./reader.css";
const labNames: Record<string, string> = { "bm-01": "Tracer ensemble", "bm-05": "Random steps", "bm-06": "Spreading probability", "bm-07": "Molecular-number inference" };
export async function PaperReader({ section }: { section?: string }) {
  const payload = await loadPaper("brownian-motion"), { paper, foundations } = payload;
  const sections = section ? paper.sections.filter(s => s.id === section) : paper.sections;
  if (!sections.length) throw new Error("Section is not in the compiled outline.");
  const args = payload.arguments.filter(a => sections.some(s => s.id === a.section));
  const anchors = [...args.map(a => a.id), ...sections.map(s => s.id)];
  const registry = { paperId: paper.id, anchors, foundations: foundations.map(f => f.id) };
  const titles = Object.fromEntries(foundations.map(f => [f.id, f.title]));
  const questions = Object.fromEntries(args.map(a => [a.id, a.question]));
  return <div data-reader-root className="reader-root">
    <header className="page-intro"><p className="eyebrow">Read · Brownian motion · Explanation preview</p><h1>{section ? sections[0]!.title : paper.title}</h1><p className="lead">{paper.description}</p><p className="notice" data-source-status>{paper.sourceNotice}</p><p className="fine">New explanatory text authored with AI assistance. Mathematical and editorial review remains pending; none of these passages is presented as Einstein’s wording.</p>{section && <a href="/papers/brownian-motion/">Read the whole available argument →</a>}</header>
    <ReaderController registry={registry} titles={titles} questions={questions}/>
    <noscript><p className="notice">JavaScript is off. The full explanation is shown. Each passage’s “Show every step here” disclosure works without scripts, and foundation links open complete reading pages. The embedded laboratory remains a static worked example.</p></noscript>
    <div className="reader-layout"><aside className="reader-outline"><h2>Follow the argument</h2><nav aria-label="Argument outline">{sections.map(s => <div key={s.id}><a data-reader-anchor={s.id} href={`#${s.id}`}>{s.title}</a>{args.filter(a => a.section === s.id).map(a => <a key={a.id} data-reader-anchor={a.id} href={`#${a.id}`}>{a.title}</a>)}<a className="fine" href={`/papers/${paper.id}/${s.id}/`}>Section-only reading →</a></div>)}</nav><p className="fine">These are explanatory anchors, not invented source-sentence identifiers.</p></aside>
    <div className="reader-body">{sections.map(s => <section key={s.id} id={s.id} tabIndex={-1} className="reader-section"><h2>{s.title}</h2>{args.filter(a => a.section === s.id).map(a => <article key={a.id} id={a.id} tabIndex={-1} className="reader-passage">
      <p className="eyebrow">{a.meaning.logicalRole} · {a.meaning.modelStatus === "approximation" ? "Model approximation" : "Within the stated model"}</p><h3>{a.title}</h3><p className="passage-question">{a.question}</p>
      <div data-face-reading>{(["overview", "full", "steps"] as const).map((reading, i) => <div data-reading={i} hidden={i !== 1} className="reading-version" key={reading}><ReadingBlocks blocks={a.readings[reading]} foundations={foundations} embed={reading === "steps"}/></div>)}
        <EquationScope>{(equationPayload.equations as readonly CompiledEquation[]).filter(e=>e.argument===a.id).map(e=><SemanticEquation key={e.id} equation={e}/>)}</EquationScope>
        <details className="local-steps"><summary>Show every step here: {a.title}</summary><ReadingBlocks blocks={a.readings.steps} foundations={foundations} embed/></details>
        <aside className="modern-margin" data-reading="3" hidden><h4>Modern qualifications</h4><ReadingBlocks blocks={a.readings.margin} foundations={foundations}/></aside>
      </div>
      <div data-face-results hidden><p>{a.recap}</p><h4>What this relies on</h4><ul>{a.premises.map(x => <li key={x}>{x}</li>)}</ul></div>
      <div data-face-source hidden><p className="notice">The reviewed German, aligned English, gloss and facsimile for this passage are not yet available. The explanation does not stand in for those source layers.</p></div>
      <details className="model-limits"><summary>Assumptions and limits: {a.title}</summary><h4>Assumed here</h4><ul>{a.premises.map(x => <li key={x}>{x}</li>)}</ul><h4>What this does not establish</h4><ul>{a.limitations.map(x => <li key={x}>{x}</li>)}</ul>{a.prerequisites.length > 0 && <p>Earlier step: {a.prerequisites.map(x => <a key={x.id} href={`/papers/${paper.id}/#${x.id}`}>{payload.arguments.find(p => p.id === x.id)!.title}</a>)}</p>}</details>
      <nav className="passage-actions" aria-label={`Actions for ${a.title}`}><FoundationLink id={a.help.why} title="Why?" caption={`Return to ${a.title}.`}/><FoundationLink id={a.help.missingStep} title="Show the missing step" caption={`Return to ${a.title}.`}/><FoundationLink id={a.help.example} title="Show me one example first" caption={`Return to ${a.title}.`}/>{a.experiments.map(id => <a key={id} href={`/lab/${id}/`}>Try it: {labNames[id]}</a>)}<a href={`/papers/${paper.id}/#${a.id}`}>Link to this passage</a><button className="secondary enhanced-only" data-copy-passage={a.id}>Copy passage link</button></nav>
      <p className="fine">Source context: {a.citations.map(id => { const c = payload.citations.find(c => c.id === id)!; return <a key={id} href={c.url}>{c.locator}</a>; })}</p>
    </article>)}</section>)}</div></div>
    <section id="lab-bm-01" className="reader-inline-lab"><h2>Keep the experiment beside the argument</h2><p>This laboratory stays mounted while you change detail or open a foundation. Applying its controls explicitly starts a host calculation; opening an explanation never starts or restarts a trial.</p><details><summary>Open the tracer ensemble in this reading</summary><TracerLab example={tracerExample as PreparedBm01Example} title="Investigate the displacement argument"/></details></section>
    <section className="reader-downloads"><h2>Read in another form</h2><p><a href={payload.exports.markdown}>Download the full explanation as Markdown</a> · <a href={payload.exports.json}>Structured reading records</a> · <a href="/foundations/">Browse the foundation library</a></p></section>
    <dialog className="clarification-dialog" data-clarification-dialog aria-modal="true"><nav className="reader-compass" aria-label="Explanation compass"><p><strong>The question we were answering:</strong> <span data-compass-question/></p><p><strong>The idea we opened:</strong> <span data-compass-idea/></p><div className="reader-options"><label>Passage detail<select data-detail-control defaultValue="1" disabled><option value="0">Overview</option><option value="1">Full explanation</option><option value="2">Show every step</option></select></label><label className="check"><input type="checkbox" data-lens-control disabled/>Show modern qualifications</label></div><p><a href="?view=reading" data-view-link="reading">Explanation</a> · <a href="?view=results" data-view-link="results">Argument synopsis</a></p><div className="actions"><button className="secondary" data-reader-back>Back one step</button><button data-reader-close>Return to the exact step</button></div></nav>{foundations.map(f => <section key={f.id} data-foundation-panel={f.id} hidden><h2 id={`clarification-${f.id}`} tabIndex={-1}>{f.title}</h2><FoundationBody foundation={f} foundations={foundations}/><p><a href={`/foundations/${f.id}/`}>Open this as a full reading page →</a></p></section>)}</dialog>
  </div>;
}
