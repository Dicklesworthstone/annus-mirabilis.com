/**
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
