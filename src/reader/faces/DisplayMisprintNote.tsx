import { notesForDisplay } from "../../content/provenance/misprints.ts";

/**
 * One quiet line under a printed display that carries a recorded misprint (dispatch 266): the
 * record's proposed reading, the first sentence of its reasoning, and a link to its entry in the
 * correction log. The display above it is left exactly as printed; the misprint inline (262) marks
 * words, and wrapping a coloured display's mathematics would disturb it.
 *
 * A server component with no script: the line is ordinary text and a real link, so a reader
 * without JavaScript reads it too. It renders nothing for a display no live record names, which
 * includes every display whose record was retracted. It is a span, because a display claimed by a
 * paragraph is set inside that paragraph (inlines.tsx), where a block element may not stand;
 * reader.css sets it on a line of its own.
 */
export function DisplayMisprintNote({
  paper,
  displayId,
}: Readonly<{ paper: string; displayId: string | undefined }>) {
  if (!displayId) return null;
  const notes = notesForDisplay(paper, displayId);
  if (notes.length === 0) return null;
  return (
    <>
      {notes.map((note) => (
        <span
          key={note.recordId}
          className="display-misprint-note"
          data-display-misprint={note.recordId}
          data-display-id={displayId}
          lang="en"
        >
          {/* A display ends in its own "," or ";"; the note's sentence ends in a full stop. */}
          So printed. Read: {note.proposed.replace(/\s*[;,]\s*$/, "")}. {note.reason}{" "}
          <a href={`/sources/#${note.recordId}`}>The record in the correction log</a>
        </span>
      ))}
    </>
  );
}
