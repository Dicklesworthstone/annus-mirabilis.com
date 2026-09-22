import type { CSSProperties } from "react";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import "./connectionMap.css";

type Kind = "borrows" | "same-number" | "same-maths" | "later";

interface Connection {
  readonly anchor: string;
  readonly kind: Kind;
  readonly label: string;
  readonly what: string;
  /** Paper slugs the connection joins, in received order. */
  readonly papers: readonly string[];
}

/*
 * The four connections the page describes, ordered from evidence to resemblance, which is the
 * distinction the page exists to draw: a premise one paper takes from another, separate routes to
 * one number, a shared piece of mathematics, and a link made by later physics. Each row says in
 * words which papers it joins; the line only draws it, and its style (solid with an arrow, dotted,
 * dashed, double) carries the kind without colour.
 */
const CONNECTIONS: readonly Connection[] = [
  {
    anchor: "energy-transformation",
    kind: "borrows",
    label: "Uses a result",
    what: "The September paper takes the light-energy transformation from relativity §8.",
    papers: ["special-relativity", "mass-energy"],
  },
  {
    anchor: "molecular-number",
    kind: "same-number",
    label: "Separate routes to one number",
    what: "Radiation constants and Brownian displacement each give a molecular number.",
    papers: ["light-quanta", "brownian-motion"],
  },
  {
    anchor: "counting",
    kind: "same-maths",
    label: "Shares a mathematical pattern",
    what: "Counting independent configurations: light-quanta §5 and Brownian motion §2.",
    papers: ["light-quanta", "brownian-motion"],
  },
  {
    anchor: "light-thread",
    kind: "later",
    label: "Later modern synthesis",
    what: "Light as the instrument across three papers, a link drawn after 1905.",
    papers: ["light-quanta", "special-relativity", "mass-energy"],
  },
];

export function ConnectionMap() {
  const papers = loadFirstPages();
  const column = new Map(papers.map((p, i) => [p.slug, i + 1]));
  return (
    <nav className="connection-map" aria-label="The connections on this page, by kind">
      <ol className="connection-map-papers" aria-hidden="true">
        {papers.map((p) => (
          <li key={p.slug}>{p.title}</li>
        ))}
      </ol>
      <ol className="connection-map-rows">
        {CONNECTIONS.map((c) => {
          const cols = c.papers.map((slug) => column.get(slug) ?? 0);
          const names = c.papers.map((slug) => papers.find((p) => p.slug === slug)?.title ?? slug);
          return (
            <li
              key={c.anchor}
              className={`connection-map-row connection-map-${c.kind}`}
              style={{ "--from": Math.min(...cols), "--to": Math.max(...cols) } as CSSProperties}
            >
              <a href={`#${c.anchor}`}>
                <span className="connection-map-kind">{c.label}</span>
                <span className="connection-map-what">
                  {c.what} <span className="connection-map-joins">({names.join(", ")})</span>
                </span>
              </a>
              <span className="connection-map-track" aria-hidden="true">
                <span className="connection-map-line" />
                {cols.map((col) => (
                  <span
                    key={col}
                    className="connection-map-dot"
                    style={{ "--col": col } as CSSProperties}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
