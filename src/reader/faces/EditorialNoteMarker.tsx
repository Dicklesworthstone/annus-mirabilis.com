import React from "react";
import type { EditorialNote, EditorialNoteKind } from "../../content/schemas/source.ts";

const NOTE_KIND_LABELS: Readonly<Record<EditorialNoteKind, string>> = {
  "historian-margin": "Historian’s Margin",
  correction: "Correction",
  typographical: "Typographical Note",
  dispute: "Scholarly Dispute",
  "side-note": "Editorial Note",
};

export interface EditorialNoteMarkerProps {
  readonly note: EditorialNote;
  readonly inline?: boolean | undefined;
}

/**
 * Renders an editorial note (historian's margin, correction, dispute, typographical, side note).
 * Distinctly labels original vs proposed readings for corrections so errors are never misattributed to Einstein.
 */
export function EditorialNoteMarker({ note, inline = false }: EditorialNoteMarkerProps) {
  const kindLabel = NOTE_KIND_LABELS[note.kind] ?? "Note";
  const authorName = note.author?.name || note.author?.id || "Editor";

  return (
    <aside
      id={`note-${note.id}`}
      className={`editorial-note-marker note-kind-${note.kind} ${inline ? "note-inline" : "note-margin"}`}
      data-note-id={note.id}
      data-note-kind={note.kind}
      data-review-state={note.reviewState}
      role="note"
      aria-label={`${kindLabel}: ${note.claim}`}
    >
      <div className="note-header">
        <span className="note-badge">{kindLabel}</span>
        <span className="note-author">By {authorName}</span>
      </div>

      <p className="note-claim">{note.claim}</p>

      {(note.kind === "correction" || note.kind === "typographical") && (
        <div className="note-correction-details">
          {note.originalReading && (
            <div className="note-reading original-reading">
              <strong>Original reading:</strong> <code>{note.originalReading}</code>
            </div>
          )}
          {note.proposedReading && (
            <div className="note-reading proposed-reading">
              <strong>Proposed reading:</strong> <code>{note.proposedReading}</code>
            </div>
          )}
          {note.reasoning && (
            <p className="note-reasoning">
              <em>Reasoning:</em> {note.reasoning}
            </p>
          )}
          {note.evidence && (
            <p className="note-evidence">
              <em>Evidence:</em> {note.evidence}
            </p>
          )}
        </div>
      )}

      {note.kind === "dispute" && note.sourceSupport.length > 0 && (
        <div className="note-dispute-sources">
          <strong>Primary & comparison sources:</strong>
          <ul>
            {note.sourceSupport.map((src, i) => (
              <li key={`${src.citationId}-${i}`}>
                {src.role ? <span className="source-role">[{src.role}] </span> : null}
                <cite>{src.citationId}</cite>
                {src.locator ? ` (${src.locator})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
