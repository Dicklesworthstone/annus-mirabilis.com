/**
 * SUPERSEDED BY A RICHER OUTLINE, NO PRODUCTION CALLER (am-50bk triage, 2026-10-24).
 *
 * `PaperPage.tsx` renders the reader's outline inline, under the same `.reader-outline` class, and
 * it does strictly more than this component can: argument sub-entries beneath each section,
 * `UnexplainedOutlineEntry` rows for parts with no explanation yet, `aria-current="page"` on the
 * section in view, and `data-reader-anchor` so `ReaderController` can track it. This component
 * takes only `{id, label}` sections, so delegating that markup to it would LOSE those four things.
 *
 * That is why this is not repaired by delegation the way `alignmentHighlight.ts` was: there the
 * island had reimplemented a pure module's logic and the pure one was the better home. Here the
 * live implementation is the more capable one, and the duplication is this file. Kept under RULE 1.
 * `ReaderLayout.tsx` takes its outline as a slot, so if a second shell ever needs a plain list,
 * read `PaperPage.tsx`'s version first and extract from that.
 *
 * ---- as authored ----
 *
 * The section outline for am-read-anchors-navigation-a6o: a list of a
 * paper's sections, the current one indicated, real `#s<n>` links so it
 * works as plain HTML with no JavaScript. Keyboard operability comes free
 * from using real `<a>` elements rather than a custom widget.
 *
 * Page layout (never a third full column on desktop; collapsing into a
 * menu on phones) is `am-read-page-anatomy-l0b`'s CSS, not this
 * component's concern -- this renders the same markup at every viewport
 * and lets that bead's stylesheet decide how it is presented.
 */

export interface OutlineSection {
  /** The bare content id (no leading `#`), e.g. "s3". */
  readonly id: string;
  readonly label: string;
}

export interface OutlineProps {
  readonly sections: readonly OutlineSection[];
  /** The bare content id of the section currently in view, or undefined before one is known. */
  readonly currentSectionId?: string | undefined;
}

export function Outline({ sections, currentSectionId }: OutlineProps) {
  return (
    <nav className="reader-outline" aria-label="Section outline">
      <ol>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={section.id === currentSectionId ? "location" : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
