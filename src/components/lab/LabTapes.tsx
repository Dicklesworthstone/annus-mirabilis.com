import { tapesForExperiment } from "../../content/teachingTapes.ts";
import { tapePath } from "../../reader/sitePaths.ts";

/**
 * A LABORATORY SAYS WHICH RECORDED WALKTHROUGHS IT HAS (am-2rl9).
 *
 * The 21 teaching tapes became pages on 2026-09-27 and are listed at /tapes/ and named on
 * /instruments/. The one place still silent about them was the laboratory a tape actually walks
 * through: a reader could work bm-01 for an hour without learning that Einstein's own 0.8 micron
 * figures have a walkthrough on this very instrument.
 *
 * WHY A COMPONENT ON EVERY PAGE RATHER THAN A LINE ON EIGHTEEN. The laboratory routes are one
 * directory each, so src/app/lab/layout.tsx cannot know which instrument it wraps and a client
 * component that read the pathname would ship the tape map to all 44 pages. This renders NOTHING
 * for a laboratory with no tape, so it can sit on every page and a laboratory that gains one later
 * gains the link with it, rather than waiting for somebody to remember. labTapeLinks.test.tsx
 * asserts that every laboratory with a tape renders a link to it, which is what makes "did I miss
 * one" a question with an answer.
 *
 * It reads records at build time and computes nothing: a server component, no JavaScript shipped.
 */
export function LabTapes({ lab }: { lab: string }) {
  const tapes = tapesForExperiment(lab);
  if (tapes.length === 0) return null;
  return (
    <nav className="actions no-print" aria-label="Recorded walkthroughs of this instrument">
      {/* "of this instrument", because the layout's block for ALL the walkthroughs sits directly
          below and both read "Recorded walkthroughs" until 2026-09-27. */}
      <span className="eyebrow">
        {tapes.length === 1
          ? "A walkthrough of this instrument"
          : "Walkthroughs of this instrument"}
      </span>
      {tapes.map((tape) => (
        <a className="button secondary" key={tape.tapeId} href={tapePath(tape.tapeId)}>
          {tape.title}
        </a>
      ))}
    </nav>
  );
}
