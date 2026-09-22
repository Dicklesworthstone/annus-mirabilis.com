import { notFound } from "next/navigation";
import { contentIndex, loadFoundation } from "../../../content/server";
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
    );
  return (
    <article className="foundation-page">
      <header>
        <p className="eyebrow">Foundation lesson</p>
        <h1>{foundation.title}</h1>
        <p className="lead">{foundation.summary}</p>
        <p className="fine">
          Written for this edition, not translated from Einstein. Editorial review pending.
        </p>
      </header>
      <FoundationBody foundation={foundation} foundations={lessons} headingLevel={2} />
      <p className="fine">
        If you came here from a passage, Back returns you to the exact place you left.
      </p>
      <p>
        <a href="/foundations/">All foundation lessons</a> ·{" "}
        <a href={foundation.exports.markdown}>Read as Markdown</a>
      </p>
    </article>
  );
}
