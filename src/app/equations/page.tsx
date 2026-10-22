import type { Metadata } from "next";
import { loadPaper } from "../../content/server.ts";
import { CATALOGUE_GROUPS, cataloguePapers } from "../../equations/printed/catalogue.ts";
import "./equations.css";

/**
 * THE EDITION'S EQUATIONS (am-9p8v).
 *
 * `/equations/` was the largest dead end in the edition: 279 routes beneath it, no page, so a
 * reader who trimmed one of those addresses reached a 404, measured 2026-10-21 and declared in
 * `src/testing/trimmedUrlParents.test.ts`. The class is the one `src/app/lab/page.tsx` was written
 * for, and that page's own docblock says so.
 *
 * It is a door onto four catalogues rather than one list of 279, because the paper is the grain a
 * reader is already in: they arrive here from an equation of one paper, or from a paper they are
 * reading. The counts are derived, so a paper whose explanations grow says so without anyone
 * editing this file, and a fifth paper appears here as soon as it has one.
 */

export const metadata: Metadata = {
  title: "The equations",
  description:
    "Every equation the edition explains, by paper: what it says in ordinary language, then the reading at the depth you ask for.",
};

export default async function Equations() {
  const papers = cataloguePapers();
  const entries = await Promise.all(
    papers.map(async (entry) => ({
      ...entry,
      record: (await loadPaper(entry.paper)).paper,
    })),
  );
  const total = papers.reduce((sum, entry) => sum + entry.total, 0);
  const across = CATALOGUE_GROUPS.map((group) => ({
    ...group,
    n: papers.reduce((sum, entry) => sum + entry.byKind[group.kind], 0),
  })).filter((group) => group.n > 0);

  return (
    <main className="equation-catalogue">
      <h1>The equations</h1>
      <p className="equation-catalogue-lede">
        {total} equations in this edition carry an explanation of their own: the equation in
        ordinary language, an overview, the full explanation, every step, and where the argument is
        heuristic. Choose a paper, or go to an equation from the passage that prints it.
      </p>

      <ol className="equation-catalogue-papers">
        {entries.map((entry) => (
          <li key={entry.paper}>
            <a href={`/equations/${entry.paper}/`}>
              <span className="equation-catalogue-paper-title">{entry.record.title}</span>
              <span className="equation-catalogue-paper-count">
                {entry.total} equations, {entry.byKind.printed} of them as printed
              </span>
              <span className="equation-catalogue-paper-german">{entry.record.germanTitle}</span>
            </a>
          </li>
        ))}
      </ol>

      <h2>What is in the catalogue</h2>
      <dl className="equation-catalogue-kinds">
        {across.map((group) => (
          <div key={group.kind}>
            <dt>
              {group.heading} <span className="equation-catalogue-count">{group.n}</span>
            </dt>
            <dd>{group.clause}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
