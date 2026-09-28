import { tapesForPassage } from "../content/teachingTapes.ts";
import { tapePath } from "./sitePaths.ts";

/**
 * A SECTION SAYS WHICH RECORDED WALKTHROUGHS LEAD BACK TO IT (am-2rl9).
 *
 * The arrow existed in one direction only. A tape page resolves its instrument's declared
 * sourceRefs into "Where this is in the paper"; nothing went the other way, so the reader who was
 * actually in the paper could not find the walkthrough. Measured on live 2026-09-28, the relativity
 * paper page carried 23 links into /lab/ and 71 into /foundations/ and none at all into /tapes/.
 *
 * This renders NOTHING for a section with no walkthrough, which is most of them, so it is safe at
 * the foot of every section and a section that gains a tape later gains the link with it. It is a
 * server component that reads records at build time and computes nothing: no JavaScript ships, and
 * every control is a real anchor, so it works with script off exactly as it does with script on.
 *
 * WHY THE FOOT OF THE SECTION AND NOT THE HEAD. A walkthrough is somewhere to go once the argument
 * has been read, not an interruption before it. This is the same placement, and the same reasoning,
 * as the ways onward in src/app/lab/layout.tsx, which were moved below the instrument after they
 * were measured pushing it 808 to 1008px down a 390px screen.
 */
export function SectionTapes({
  paperId,
  sectionId,
  sectionTitle,
}: {
  readonly paperId: string;
  readonly sectionId: string;
  /**
   * The section's own title, which is what makes this landmark's accessible name unique.
   *
   * A page renders one of these per section with a walkthrough, and src/testing/a11y/
   * navLandmarkNames.test.tsx requires every nav landmark on the page to carry a DISTINCT
   * accessible name: two navs both called "Recorded walkthroughs of this section" are two
   * landmarks a screen-reader user cannot tell apart in a landmark list. The visible eyebrow
   * still says "this section", because a sighted reader has the heading above it.
   */
  readonly sectionTitle: string;
}) {
  const tapes = tapesForPassage(paperId, sectionId);
  if (tapes.length === 0) return null;
  return (
    <nav
      className="actions section-tapes no-print"
      aria-label={`Recorded walkthroughs of ${sectionTitle}`}
    >
      <span className="eyebrow">
        {tapes.length === 1
          ? "A recorded walkthrough of this section"
          : "Recorded walkthroughs of this section"}
      </span>
      {tapes.map((tape) => (
        <a className="button secondary" key={tape.tapeId} href={tapePath(tape.tapeId)}>
          {tape.title}
          <span className="section-tape-instrument">
            {" "}
            · {tape.instrument?.id ?? tape.experimentId}
          </span>
        </a>
      ))}
    </nav>
  );
}
