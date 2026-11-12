import type { Metadata } from "next";
import { loadEssays } from "../../content/essays/load.ts";
import { ESSAY_LABEL } from "../../content/schemas/essay.ts";
import "./essays.css";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Reading the reasoning",
  description:
    "Contemporary essays connecting the arguments of the 1905 papers to measurement, controlled comparisons and other ways of reasoning.",
  alternates: { canonical: "/essays/" },
};

export default function EssaysPage() {
  const essays = loadEssays();
  return (
    <article className="essays-page" data-edition-status="explanatory-preview">
      <header className="page-intro">
        <p className="eyebrow">Across the papers</p>
        <h1>Reading the reasoning</h1>
        <p className="lead">
          Follow a move in an argument, try it in an instrument, then ask how far it travels.
        </p>
        <p className="essay-label">{ESSAY_LABEL}</p>
        <p>
          These essays connect specific passages to contemporary examples in other fields.
          They are interpretations of published arguments; they do not claim to recover
          Einstein's private route to discovery.
        </p>
      </header>
      <ol className="essay-catalogue">
        {essays.map((essay) => <li key={essay.slug} value={essay.number}>
          <p className="eyebrow">Essay {essay.number}</p>
          <h2><a href={"/essays/" + essay.slug + "/"}>{essay.title}</a></h2>
          <p>{essay.r0Summary}</p>
          <p className="fine">
            {essay.transferExamples.map((example) => example.domain).join(" · ")}
          </p>
          <a href={"/essays/" + essay.slug + "/"}>Read this essay</a>
        </li>)}
      </ol>
      <p className="essay-series-note">
        All readings in the planned series are available here as drafts of contemporary
        interpretations. Source passages and model equations retain their own edition notices.
      </p>
      <nav className="essay-related" aria-label="Related reading">
        <a href="/connections/">Connections among the papers</a>
        <a href="/tours/full-course/">The full course</a>
        <a href="/discover/">Follow a discovery route</a>
      </nav>
    </article>
  );
}
