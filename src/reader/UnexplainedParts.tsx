/**
 * The parts of a paper this site does not yet explain (unexplainedParts.ts), named in one line
 * near the outline and listed in it, each linked to Einstein's text for that part where the site
 * has it. Server-rendered, so it is in the static HTML with JavaScript off, and computed from the
 * records, so it disappears when a part's passages are written.
 */
import { Fragment } from "react";
import { partLabel } from "./unexplainedParts.ts";

export type PartHref = (part: string) => string | null;

/** "the introduction, §1, §2 and §3", each a link where there is somewhere to go. */
function PartList({ parts, hrefFor }: { parts: readonly string[]; hrefFor: PartHref }) {
  return (
    <>
      {parts.map((part, i) => {
        const href = hrefFor(part);
        const sep = i === 0 ? "" : i === parts.length - 1 ? " and " : ", ";
        return (
          <Fragment key={part}>
            {sep}
            {href ? <a href={href}>{partLabel(part)}</a> : partLabel(part)}
          </Fragment>
        );
      })}
    </>
  );
}

export function UnexplainedPartsLine({
  parts,
  hrefFor,
}: {
  parts: readonly string[];
  hrefFor: PartHref;
}) {
  if (parts.length === 0) return null;
  const linked = parts.some((part) => hrefFor(part) !== null);
  return (
    <p className="fine unexplained-parts" data-unexplained-parts={parts.join(" ")}>
      Not yet explained on this site: <PartList parts={parts} hrefFor={hrefFor} />.
      {linked ? " The links open Einstein's text." : ""}
    </p>
  );
}

/** An outline entry for a part with no explanation: present, marked, and never a 404. */
export function UnexplainedOutlineEntry({ part, href }: { part: string; href: string | null }) {
  const mark = part === "s0" ? "Introduction" : `§${part.slice(1)}`;
  const content = (
    <>
      <span className="outline-section-mark">{mark}</span>
      <span className="outline-section-name"> · not yet explained</span>
    </>
  );
  return (
    <div className="outline-unexplained" data-unexplained-part={part}>
      {href ? (
        <a href={href} aria-label={`${mark}, not yet explained here: read Einstein's text`}>
          {content}
        </a>
      ) : (
        <span>{content}</span>
      )}
    </div>
  );
}
