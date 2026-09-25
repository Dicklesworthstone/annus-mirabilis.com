import { contentIndex, loadFoundation, loadPaper } from "../../content/server";
import "../../reader/reader.css";
import "../../components/foundations/foundations.css";
import { lessonsNamedBy, PAPER_ORDER, paperName } from "../../components/foundations/lessonUses";

export const metadata = {
  title: "Foundation lessons",
  description:
    "Short lessons on the mathematics and physics that Einstein's four 1905 papers take for granted, each with one question, one worked example and a stated stopping point.",
  alternates: { canonical: "https://annus-mirabilis.com/foundations/" },
};

/**
 * The index groups lessons by what a reader is missing, and lists each group in the order the
 * lessons build on one another. Until 2026-09-22 it was one flat grid in id order under the
 * title "Foundations for the Brownian argument", although 24 of the 27 lessons are linked from
 * arguments in all four papers. A lesson in no group still renders, under "More lessons", so a
 * new record can never disappear from the index.
 */
const GROUPS: readonly { title: string; note: string; ids: readonly string[] }[] = [
  {
    title: "No algebra needed",
    note: "Arithmetic, a ruler and a little patience are enough.",
    ids: [
      "bridge-sum-average",
      "bridge-negative-numbers-direction",
      "bridge-fractions-ratios",
      "bridge-equals-sign-relationship",
      "bridge-letter-for-quantity",
      "bridge-squaring-square-roots",
      "bridge-scientific-notation-units",
      "bridge-a-graph",
      "bridge-mathematical-punctuation",
      "bridge-probability-notation",
    ],
  },
  {
    title: "Units and sizes",
    note: "What a number means once it carries a unit, and how big the quantities of 1905 are.",
    ids: ["quantities-units", "ratios-scaling", "orders-of-magnitude", "unit-system-1905"],
  },
  {
    title: "Rates, curves and sums",
    note: "The calculus the papers use, one tool at a time.",
    ids: [
      "functions-graphs",
      "derivatives",
      "partial-derivatives",
      "integration",
      "taylor-expansion",
      "exponentials",
      "logarithms",
    ],
  },
  {
    title: "Vectors, matrices and changing frame",
    note: "The geometry of arrows and of changing coordinates that the relativity paper works in.",
    ids: [
      "vectors-components",
      "dot-cross-products",
      "matrices-linear-maps",
      "hyperbolic-functions-rapidity",
    ],
  },
  {
    title: "Chance and spread",
    note: "What an average hides, and how a random walk spreads.",
    ids: [
      "probability-independence",
      "distributions",
      "mean-variance-rms",
      "random-walks",
      "gaussian-distributions",
      "error-and-inference",
      "two-measurements-two-unknowns",
    ],
  },
  {
    title: "Physics the papers take for granted",
    note: "Ideas a reader of the Annalen in 1905 was expected to know.",
    ids: [
      "work-energy",
      "conservation-symmetry",
      "temperature-thermal-energy",
      "entropy-temperature",
      "entropy-multiplicity",
      "flux-continuity",
      "diffusion-equation",
      "viscosity-stokes-drag",
      "free-energy-osmotic-pressure",
      "frames-events",
      "fields-waves",
      "electromagnetism-charges",
      "momentum-energy-light",
    ],
  },
];

export default async function Page() {
  const index = await contentIndex(),
    lessons = await Promise.all(
      index.payloads.filter((p) => p.kind === "foundation").map((p) => loadFoundation(p.id)),
    ),
    papers = await Promise.all(
      index.payloads.filter((p) => p.kind === "paper").map((p) => loadPaper(p.id)),
    );

  // Which papers send a reader to each lesson, measured from the compiled arguments.
  const usedIn = new Map<string, Set<string>>();
  for (const { paper, arguments: args } of papers)
    for (const argument of args)
      for (const id of lessonsNamedBy(argument))
        usedIn.set(id, (usedIn.get(id) ?? new Set()).add(paper.id));
  const paperNames = new Map(papers.map(({ paper }) => [paper.id, paperName(paper.title)]));
  const rank = (id: string) => (PAPER_ORDER.includes(id) ? PAPER_ORDER.indexOf(id) : 99);

  const byId = new Map(lessons.map((f) => [f.id, f]));
  const grouped = new Set(GROUPS.flatMap((g) => g.ids));
  const groups = [
    ...GROUPS.map((g) => ({
      ...g,
      lessons: g.ids.flatMap((id) => {
        const lesson = byId.get(id);
        return lesson ? [lesson] : [];
      }),
    })),
    {
      title: "More lessons",
      note: "",
      ids: [],
      lessons: lessons.filter((f) => !grouped.has(f.id)),
    },
  ].filter((g) => g.lessons.length > 0);
  /** "Rates, curves and sums" -> "lessons-rates-curves-and-sums": the group's heading id. */
  const groupId = (title: string) =>
    `lessons-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  return (
    <div className="foundations-index">
      <header className="page-intro">
        <p className="eyebrow">Foundation lessons</p>
        <h1>Start with the idea that is missing.</h1>
        <p className="lead">
          {lessons.length} short lessons on the mathematics and physics the four papers take for
          granted. Each asks one question, works one example, and says where it stops, so you can go
          back to the passage you came from.
        </p>
        <p className="fine">Written for this edition.</p>
      </header>
      {/* The groups by name, each with its count, so a reader looking for calculus reaches it
          without scrolling past twenty arithmetic cards: on a 390px phone the page is 9,212px
          long and the calculus group began at y=3,000. */}
      <nav className="lesson-group-nav" aria-label="Lesson groups">
        <ul>
          {groups.map((group) => (
            <li key={group.title}>
              <a href={`#${groupId(group.title)}`}>
                {group.title}{" "}
                <span className="lesson-group-count">
                  {group.lessons.length}
                  <span className="visually-hidden"> lessons</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {groups.map((group) => (
        <section className="lesson-group" key={group.title} aria-labelledby={groupId(group.title)}>
          <header className="lesson-group-head">
            <h2 id={groupId(group.title)}>{group.title}</h2>
            {group.note && <p>{group.note}</p>}
          </header>
          <ul className="lesson-list">
            {group.lessons.map((f) => {
              const uses = [...(usedIn.get(f.id) ?? [])].sort((a, b) => rank(a) - rank(b));
              return (
                <li className="lesson-card" key={f.id}>
                  <h3>
                    <a href={`/foundations/${f.id}/`}>{f.title}</a>
                  </h3>
                  <p className="lesson-card-question">{f.question}</p>
                  {uses.length > 0 && (
                    <p className="lesson-card-uses">
                      Used in {uses.map((id) => paperNames.get(id) ?? id).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
