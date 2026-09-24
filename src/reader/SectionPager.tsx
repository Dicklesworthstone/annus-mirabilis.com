import { paperPath } from "./paperRoutes.ts";

type Section = Readonly<{ id: string; title: string }>;

/**
 * THE SECTION BEFORE AND AFTER, AT THE END OF A SECTION'S OWN PAGE (am-read-shell-routes-3ua: a
 * section page "keeps paper context: the section content, the paper outline, previous and next
 * section navigation, and a link to the same anchor in the full paper").
 *
 * A section page is where search results, lessons and shared links land. Measured on live b2077fc1,
 * none of the 24 section pages linked to a neighbouring section's page: a reader who finished light
 * quanta §5 had to go back to the whole paper to find §6. Nothing renders for a paper with one
 * section.
 */
export function SectionPager({
  paperId,
  sections,
  current,
}: {
  paperId: string;
  sections: readonly Section[];
  current: string;
}) {
  const at = sections.findIndex((s) => s.id === current);
  const previous = at > 0 ? sections[at - 1] : undefined;
  const next = at >= 0 ? sections[at + 1] : undefined;
  if (!previous && !next) return null;
  return (
    <nav className="section-pager" aria-label="Previous and next section">
      {previous ? (
        <a href={paperPath(paperId, previous.id)} rel="prev">
          <span className="section-pager-direction">Previous section</span>
          <span>
            <span aria-hidden="true">←&nbsp;</span>
            {previous.title}
          </span>
        </a>
      ) : null}
      {next ? (
        <a href={paperPath(paperId, next.id)} rel="next">
          <span className="section-pager-direction">Next section</span>
          <span>
            {next.title}
            <span aria-hidden="true">&nbsp;→</span>
          </span>
        </a>
      ) : null}
    </nav>
  );
}
