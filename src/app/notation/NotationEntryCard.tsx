/**
 * Single Concordance Entry Card Component (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

import type React from "react";
import type { EnrichedConcordanceEntry } from "./notationData.ts";

export interface NotationEntryCardProps {
  readonly entry: EnrichedConcordanceEntry;
}

export function NotationEntryCard({ entry }: NotationEntryCardProps) {
  const hasCollision = entry.collision !== undefined;
  const isDanger = entry.collision?.severity === "danger";
  const isCaution = entry.collision?.severity === "caution";

  const cardClasses = [
    "concordance-card",
    isDanger ? "has-danger" : "",
    isCaution ? "has-caution" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const opKind = entry.operation.kind;
  let opDisplay: React.ReactNode = null;

  if (opKind === "rename") {
    const target = entry.operation.target;
    if (target.form === "symbol") {
      opDisplay = (
        <div className="detail-item">
          <span className="detail-label">Modern symbol</span>
          <span
            className="detail-val inline-math"
            {...{
              dangerouslySetInnerHTML: {
                __html:
                  entry.modernRendered?.html ||
                  (typeof target.modernGlyph === "string"
                    ? target.modernGlyph
                    : target.modernGlyph.latex),
              },
            }}
          />
        </div>
      );
    } else if (target.form === "group") {
      opDisplay = (
        <div className="detail-item">
          <span className="detail-label">Group rename</span>
          <span className="detail-val">
            Printed <code {...{ dangerouslySetInnerHTML: { __html: entry.glyphRendered.html } }} />{" "}
            maps to{" "}
            <span
              className="inline-math"
              {...{
                dangerouslySetInnerHTML: {
                  __html:
                    entry.modernRendered?.html ||
                    (typeof target.modernGlyph === "string"
                      ? target.modernGlyph
                      : target.modernGlyph.latex),
                },
              }}
            />
          </span>
        </div>
      );
    } else if (target.form === "expression" || target.form === "scaled") {
      opDisplay = (
        <div className="detail-item">
          <span className="detail-label">{target.form} rename</span>
          <span className="detail-val">Modernized argument expression</span>
        </div>
      );
    }
  } else if (opKind === "unitConversion") {
    const op = entry.operation;
    opDisplay = (
      <div className="detail-item">
        <span className="detail-label">Unit system conversion</span>
        <span className="detail-val">
          {op.fromSystem.toUpperCase()} → {op.toSystem.toUpperCase()} (factor:{" "}
          {typeof op.factor === "number" ? op.factor : `${op.factor.num}/${op.factor.den}`})
        </span>
      </div>
    );
  } else if (opKind === "modernization") {
    const op = entry.operation;
    opDisplay = (
      <div className="detail-item">
        <span className="detail-label">Substantive modernization</span>
        <span className="detail-val">{op.argumentChangeDescription}</span>
      </div>
    );
  }

  return (
    <article className={cardClasses} id={entry.id} data-entry-id={entry.id}>
      <div className="card-header-row">
        <div className="card-glyph-container">
          <span
            role="img"
            className="card-glyph"
            aria-label={entry.spokenName}
            {...{ dangerouslySetInnerHTML: { __html: entry.glyphRendered.html } }}
          />
          <a
            href={`#${entry.id}`}
            className="card-anchor-link"
            aria-label={`Anchor link for ${entry.id}`}
          >
            #{entry.id}
          </a>
        </div>
        <div className="card-badges">
          <span className="badge-scope">{entry.paperTitle}</span>
          {entry.scope.map((s) => (
            <span key={s} className="badge-scope">
              {s.replace(/^[a-z]+-/, "")}
            </span>
          ))}
          <span className={`badge-op ${opKind}`}>
            {opKind === "rename"
              ? "Rename only"
              : opKind === "unitConversion"
                ? "Unit conversion"
                : "Modernization"}
          </span>
        </div>
      </div>

      <h3 className="card-meaning">{entry.meaning}</h3>

      <div className="card-details-grid">
        {"quantityId" in entry.binding && entry.binding.quantityId && (
          <div className="detail-item">
            <span className="detail-label">Quantity identity</span>
            <span className="detail-val">{entry.binding.quantityId}</span>
          </div>
        )}

        {entry.frameOrReference && (
          <div className="detail-item">
            <span className="detail-label">Reference frame</span>
            <span className="detail-val">{entry.frameOrReference}</span>
          </div>
        )}

        {opDisplay}

        {entry.glyph.variant && entry.glyph.variant !== "plain" && (
          <div className="detail-item">
            <span className="detail-label">Glyph variant</span>
            <span className="detail-val">{entry.glyph.variant}</span>
          </div>
        )}
      </div>

      {hasCollision && entry.collision && (
        <aside
          className={`card-collision-alert ${entry.collision.severity}`}
          role="note"
          aria-label={`${entry.collision.severity} collision notice`}
        >
          <div className="alert-title">
            <span aria-hidden="true">{isDanger ? "⚠️" : "⚡"}</span>
            <span>[{entry.collision.severity.toUpperCase()} COLLISION]</span>
            <span>({entry.collision.kind})</span>
          </div>
          <p>
            Collides with: <strong>{entry.collision.collidesWith.join(", ")}</strong>
            {entry.collision.collidesWithModern && (
              <> (modern: {entry.collision.collidesWithModern.join(", ")})</>
            )}
          </p>
        </aside>
      )}

      {entry.notes && <p className="card-notes">{entry.notes}</p>}

      <footer className="card-footer-row">
        <span className="verification-status">
          <strong>Status:</strong> {entry.verification.checkedAgainst} · Checked{" "}
          {entry.verification.date}
        </span>
        <a
          href={entry.firstUseUrl}
          className="first-use-link"
          data-first-use-anchor={entry.sources.anchor}
        >
          First use in edition: {entry.sources.anchor}
          {entry.sources.facsimilePage ? ` (p. ${entry.sources.facsimilePage})` : ""}
        </a>
      </footer>
    </article>
  );
}
