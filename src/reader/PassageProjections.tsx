import type { PassageProjection } from "./projections/passageProjections.ts";
import "./passageProjections.css";

const GROUPS = [
  ["german", "German"],
  ["english", "English"],
  ["explanation", "Explanation"],
  ["instrument", "Experiment"],
  ["journey", "Journey passage"],
] as const;

/** A small, static route from this passage to its other representations (am-projection-bar-1d4l). */
export function PassageProjections({
  projection,
  anchor,
  label,
}: {
  readonly projection: PassageProjection | undefined;
  /** An id actually rendered on this page, also used when returning through browser history. */
  readonly anchor: string;
  readonly label: string;
}) {
  if (!projection) return null;
  return (
    <details className="passage-projections" data-passage-projections={anchor} lang="en">
      <summary aria-label={`Explore this passage: ${label}`}>Explore this passage</summary>
      <ul>
        {GROUPS.map(([key, title]) => (
          <li key={key} data-projection={key}>
            <span className="passage-projection-label">{title}</span>
            {projection[key].length > 0 ? (
              <ul>
                {projection[key].map((link) => (
                  <li key={link.href}>
                    <a href={link.href} data-passage-projection-link>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="passage-projection-unavailable">Not yet available</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The printed paragraph label, without exposing the content-id syntax to a reader. */
export function projectionParagraphLabel(id: string): string {
  const paragraph = /^s(\d+)-p(\d+)$/.exec(id);
  if (!paragraph) return "this part of the paper";
  return paragraph[1] === "0"
    ? `opening paragraph ${paragraph[2]}`
    : `section ${paragraph[1]}, paragraph ${paragraph[2]}`;
}
