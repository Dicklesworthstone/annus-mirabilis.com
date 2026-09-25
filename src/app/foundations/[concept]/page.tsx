import { notFound } from "next/navigation";
import {
  groupByPaper,
  lessonsBuildingOn,
  lessonUses,
} from "../../../components/foundations/lessonUses";
import { entranceLessons, passageLessons } from "../../../components/foundations/passageLessons";
import { contentIndex, loadFoundation, loadPaper } from "../../../content/server";
import { FoundationBody } from "../../../reader/Blocks";
import "../../../reader/reader.css";
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await contentIndex()).payloads
    .filter((p) => p.kind === "foundation")
    .map((p) => ({ concept: p.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ concept: string }> }) {
  const { concept } = await params;
  if (!(await contentIndex()).payloads.some((p) => p.kind === "foundation" && p.id === concept))
    notFound();
  const f = await loadFoundation(concept);
  return {
    title: f.title,
    alternates: { canonical: `https://annus-mirabilis.com/foundations/${concept}/` },
  };
}
export default async function Page({ params }: { params: Promise<{ concept: string }> }) {
  const { concept } = await params,
    index = await contentIndex();
  if (!index.payloads.some((p) => p.kind === "foundation" && p.id === concept)) notFound();
  const foundation = await loadFoundation(concept),
    lessons = await Promise.all(
      index.payloads.filter((p) => p.kind === "foundation").map((p) => loadFoundation(p.id)),
    ),
    papers = await Promise.all(
      index.payloads.filter((p) => p.kind === "paper").map((p) => loadPaper(p.id)),
    ),
    uses = groupByPaper(
      lessonUses(
        concept,
        papers,
        passageLessons(papers.flatMap((p) => p.arguments)),
        entranceLessons(),
      ),
    ),
    buildOn = lessonsBuildingOn(concept, lessons);
  return (
    <article className="foundation-page">
      <header>
        <p className="eyebrow">Foundation lesson</p>
        <h1>{foundation.title}</h1>
        <p className="lead">{foundation.summary}</p>
        <p className="fine">Written for this edition, not translated from Einstein.</p>
      </header>
      <div className="foundation-page-text">
        <FoundationBody foundation={foundation} foundations={lessons} headingLevel={2} />
        <p className="fine">
          If you came here from a passage, Back returns you to the exact place you left.
        </p>
        <p className="foundation-page-exit">
          <a href="/foundations/">All foundation lessons</a> ·{" "}
          <a href={foundation.exports.markdown}>Read as Markdown</a>
        </p>
      </div>
      {(uses.length > 0 || buildOn.length > 0) && (
        <aside className="foundation-page-rail" aria-label="Where this lesson leads">
          {uses.length > 0 && (
            <section>
              <h2>Where the papers use it</h2>
              {uses.map((group) => (
                <div className="foundation-use-group" key={group.paper}>
                  <h3>{group.paper}</h3>
                  <ul>
                    {group.uses.map((use) => (
                      <li key={use.href}>
                        <a href={use.href}>
                          {/* The paper is named once, above; a list of links still hears it. */}
                          <span className="visually-hidden">{group.paper} </span>
                          {use.section && (
                            <span className="foundation-use-where">
                              {use.section}
                              <span className="visually-hidden">: </span>
                            </span>
                          )}
                          {use.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {buildOn.length > 0 && (
            <section>
              <h2>Lessons that build on it</h2>
              <ul>
                {buildOn.map((lesson) => (
                  <li key={lesson.href}>
                    <a href={lesson.href}>{lesson.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}
    </article>
  );
}
