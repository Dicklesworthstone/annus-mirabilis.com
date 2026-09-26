/**
 * One concordance entry (am-not-notation-page-2us), as a row a reader can scan.
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 *
 * The printed symbol, what it means, where that holds, the modern symbol where it differs, and a
 * link to the first use. The other entries printed with the same symbol sit underneath, since
 * they are what the concordance exists to show. Notes, unit conversions and the checking record
 * go in a disclosure. This replaced a card that opened with the entry's internal id
 * ("#lq.R.molarGasConstant"), a "Quantity identity" field, a badge per section token and a
 * "[CAUTION COLLISION] (cross-paper)" banner, which made the page 115,704px tall on a phone.
 */

import type React from "react";
import type { EnrichedConcordanceEntry } from "./notationData.ts";

export interface NotationEntryCardProps {
  readonly entry: EnrichedConcordanceEntry;
}

const FRAME_LABELS: Record<string, string> = {
  "stationary-system": "in the stationary system",
  "moving-system": "in the moving system",
  "object-rest": "in the body's rest frame",
};

const UNIT_SYSTEMS: Record<string, string> = {
  si: "SI",
  cgs: "centimetre-gram-second",
  "gaussian-cgs": "Gaussian",
  "emu-cgs": "electromagnetic (emu)",
};

function modernSymbol(entry: EnrichedConcordanceEntry): string | null {
  if (entry.operation.kind !== "rename") return null;
  const target = entry.operation.target;
  if (target.form !== "symbol" && target.form !== "group") return null;
  if (entry.modernRendered) return entry.modernRendered.html;
  return typeof target.modernGlyph === "string" ? target.modernGlyph : target.modernGlyph.latex;
}

function formatFactor(factor: number | { readonly num: number; readonly den: number }) {
  if (typeof factor !== "number") return `${factor.num}/${factor.den}`;
  const exponent = Math.log10(factor);
  if (Number.isInteger(exponent) && exponent !== 0 && exponent !== 1)
    return (
      <>
        10<sup>{exponent < 0 ? `−${-exponent}` : exponent}</sup>
      </>
    );
  return String(factor);
}

function changeNote(entry: EnrichedConcordanceEntry): React.ReactNode {
  const op = entry.operation;
  // `factor` takes a value in the printed units to the modern ones (1 erg = 1e-7 J). A factor of 1
  // that is not exact marks a conversion that changes the quantity's form, such as a Gaussian
  // field, where no single number carries it.
  if (op.kind === "unitConversion") {
    const from = UNIT_SYSTEMS[op.fromSystem] ?? op.fromSystem;
    const to = UNIT_SYSTEMS[op.toSystem] ?? op.toSystem;
    const f = typeof op.factor === "number" ? op.factor : op.factor.num / op.factor.den;
    if (f === 1 && !op.exact)
      return (
        <p>
          Printed in {from} units. In {to} units the quantity takes a different form, not a simple
          rescaling.
        </p>
      );
    return (
      <p>
        Printed in {from} units. For {to} units, multiply by {formatFactor(op.factor)}
        {op.exact ? ", exactly." : ", a conventional value."}
      </p>
    );
  }
  if (op.kind === "modernization") return <p>{op.argumentChangeDescription}</p>;
  return null;
}

export function NotationEntryCard({ entry }: NotationEntryCardProps) {
  const danger = entry.collision?.severity === "danger";
  const modern = modernSymbol(entry);
  const frame = entry.frameOrReference ? FRAME_LABELS[entry.frameOrReference] : undefined;
  const page = entry.sources.facsimilePage;
  const meaningId = `${entry.id}-meaning`;
  const change = changeNote(entry);

  return (
    <article
      className={danger ? "notation-entry is-danger" : "notation-entry"}
      id={entry.id}
      data-entry-id={entry.id}
      aria-labelledby={meaningId}
    >
      <span
        role="img"
        className="notation-entry-glyph"
        aria-label={entry.spokenName}
        data-formula-plain={entry.glyphRendered.plain}
        {...{ dangerouslySetInnerHTML: { __html: entry.glyphRendered.html } }}
      />
      <div className="notation-entry-body">
        <h3 className="notation-entry-meaning" id={meaningId}>
          {entry.meaning}
        </h3>
        <p className="notation-entry-facts">
          {danger && <strong className="notation-entry-flag">Easily misread</strong>}
          <span>{entry.whereLabel}</span>
          {frame && <span>{frame}</span>}
          {modern && (
            <span>
              today{" "}
              <span
                className="inline-math"
                data-formula-plain={entry.modernRendered?.plain}
                {...{ dangerouslySetInnerHTML: { __html: modern } }}
              />
            </span>
          )}
          {entry.firstUseUrl ? (
            <a
              href={entry.firstUseUrl}
              className="first-use-link"
              data-first-use-anchor={entry.sources.anchor}
            >
              {page ? `first used on p. ${page}` : "first use"}
            </a>
          ) : (
            <span>{page ? `first used on p. ${page}` : "first use"}</span>
          )}
        </p>
        {entry.alsoPrinted.length > 0 && (
          <p className="notation-entry-also">
            The same symbol elsewhere:{" "}
            {entry.alsoPrinted.map((other, i) => (
              <span key={other.id}>
                {i > 0 && "; "}
                <a href={`#${other.id}`}>{other.meaning}</a> ({other.paperTitle}, {other.whereLabel}
                )
              </span>
            ))}
          </p>
        )}
        {/* Who read an entry from the plates, and when, stays in its `verification` record; the
            reader gets the notes only (D-2026-09-25-no-review-status-banners). An entry with no
            notes and no change of units or argument has nothing to disclose, so no disclosure. */}
        {(entry.notes || change) && (
          <details className="notation-entry-more">
            <summary>Notes</summary>
            {entry.notes && <p>{entry.notes}</p>}
            {change}
          </details>
        )}
      </div>
    </article>
  );
}
