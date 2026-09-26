import type { CSSProperties } from "react";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { loadConnections } from "../../content/connections/connections.ts";
import "./connectionMap.css";

/*
 * The connections the page describes, from content/connections/connections.yaml (dispatch 253),
 * ordered from evidence to resemblance, which is the distinction the page exists to draw: a premise
 * one paper takes from another, separate routes to one number, a shared piece of mathematics, and a
 * link made by later physics. Each row says in words which papers it joins; the line only draws
 * it, and its style (solid with an arrow, dotted, dashed, double) carries the kind without colour.
 * The result cards read the same record for "Where this is used later", so the two cannot disagree.
 */

export function ConnectionMap() {
  const papers = loadFirstPages();
  const connections = loadConnections();
  const column = new Map(papers.map((p, i) => [p.slug, i + 1]));
  return (
    <nav className="connection-map" aria-label="The connections on this page, by kind">
      <ol className="connection-map-papers" aria-hidden="true">
        {papers.map((p) => (
          <li key={p.slug}>{p.title}</li>
        ))}
      </ol>
      <ol>
        {connections.map((c) => {
          const cols = c.papers.map((slug) => column.get(slug) ?? 0);
          const names = c.papers.map((slug) => papers.find((p) => p.slug === slug)?.title ?? slug);
          return (
            <li
              key={c.id}
              className="connection-map-row"
              data-kind={c.kind}
              style={{ "--from": Math.min(...cols), "--to": Math.max(...cols) } as CSSProperties}
            >
              <a href={`#${c.id}`}>
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
