import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPaper } from "../../../content/server.ts";
import {
  CATALOGUE_GROUPS,
  cataloguePapers,
  equationCatalogue,
} from "../../../equations/printed/catalogue.ts";
import "../equations.css";

/**
 * ONE PAPER'S EQUATIONS, LISTED (am-9p8v).
 *
 * `/equations/<paper>/` was a dead end with between 40 and 122 routes beneath it, four of the 43
 * the trimmed-URL ratchet measured on 2026-10-21 (`src/testing/trimmedUrlParents.test.ts`). It is
 * also the page that was missing for a reader who wants the equation that states a claim and does
 * not know its number: 195 of the built pages carry a link into one explanation, and nothing
 * listed them.
 *
 * EVERY WORD ON THIS PAGE EXCEPT THE GROUP HEADINGS IS A RECORD'S. A row's sentence is the
 * explanation's own `inWords`, which says what the equation claims in ordinary language; the paper
 * titles are the compiled paper record's; the groups are the explanations' own `source.label`. The
 * catalogue module says why the formula itself is drawn one click away rather than here, with the
 * measurement that decided it.
 *
 * The id is shown beside each sentence because it is the address: it is the last segment of the
 * link, and `#eq-s3-d7` is how the same equation is cited on every face.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return cataloguePapers().map(({ paper }) => ({ paper }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string }>;
}): Promise<Metadata> {
  const { paper } = await params;
  const rows = equationCatalogue(paper);
  if (rows.length === 0) return {};
  const record = await loadPaper(paper);
  return {
    title: `${record.paper.title}: the equations`,
    description: `Every equation the edition explains for ${record.paper.title}, ${rows.length} of them, each named by what it says in ordinary language.`,
  };
}

export default async function PaperEquations({ params }: { params: Promise<{ paper: string }> }) {
  const { paper } = await params;
  const rows = equationCatalogue(paper);
  if (rows.length === 0) notFound();
  const record = await loadPaper(paper);
  const groups = CATALOGUE_GROUPS.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.kind === group.kind),
  })).filter((group) => group.rows.length > 0);

  return (
    <main className="equation-catalogue">
      <p className="eyebrow">
        <a href={`/papers/${paper}/`}>{record.paper.title}</a>
      </p>
      <h1>The equations</h1>
      <p className="equation-catalogue-lede">
        {rows.length} equations from this paper carry an explanation of their own: what the equation
        says in ordinary language, then the reading at the depth you ask for. Each is listed here by
        what it says.
      </p>
      <p className="equation-catalogue-german">{record.paper.germanTitle}</p>

      {groups.map((group) => (
        <section key={group.kind} className="equation-catalogue-group">
          <h2>
            {group.heading} <span className="equation-catalogue-count">{group.rows.length}</span>
          </h2>
          <p className="equation-catalogue-clause">{group.clause}</p>
          <ol className="equation-catalogue-rows">
            {group.rows.map((row) => (
              <li key={row.display}>
                <a href={row.href}>
                  <span className="equation-catalogue-id">{row.display}</span>
                  <span className="equation-catalogue-words">{row.words}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="equation-catalogue-elsewhere">
        <a href="/equations/">The other papers&rsquo; equations</a>, or{" "}
        <a href={`/papers/${paper}/`}>the paper itself</a>, where each display is drawn in its place
        with its terms live.
      </p>
    </main>
  );
}
