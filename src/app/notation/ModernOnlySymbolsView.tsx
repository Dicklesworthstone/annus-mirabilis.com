/**
 * Modern-Only Symbols View Component (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

import type { PaperNotationSection } from "./notationData.ts";

export interface ModernOnlySymbolsViewProps {
  readonly paperTitle: string;
  readonly symbols: PaperNotationSection["modernOnlySymbols"];
}

export function ModernOnlySymbolsView({ paperTitle, symbols }: ModernOnlySymbolsViewProps) {
  if (!symbols || symbols.length === 0) {
    return null;
  }

  return (
    <section className="modern-only-section" aria-labelledby={`modern-symbols-${paperTitle}`}>
      <h3 id={`modern-symbols-${paperTitle}`}>Modern-Layer Symbols in {paperTitle}</h3>
      <p className="disclaimer">
        These symbols appear in modern educational lenses, worked derivations, or explanatory notes.
        <strong> They were never printed by Albert Einstein in the 1905 edition.</strong>
      </p>

      {/*
        A five-column table whose min-content is 463px cannot fit a phone. Unwrapped, it pushed the
        document to 559px at every phone width measured (320, 360, 390), because a table is at least
        its min-content width and `width: 100%` loses to that. `.table-scroll` is the house container
        for exactly this (globals.css, am-14at) and brings the narrow-viewport cell padding with it.

        tabIndex and the name are not decoration, and not a lint appeasement. Containing the
        overflow by letting the region scroll is the move that CREATES a keyboard trap: a pointer
        can drag the region, and without a tab stop a keyboard reader cannot reach the columns that
        are off screen at all. Repairing the visual defect and introducing an access defect is a
        worse trade than the overflow was, so the two land together (am-bc6s).

        The region genuinely overflows at phone widths - 463px of content in a 342px container at
        390px - so RECORDED_NON_OVERFLOWING, the other answer the ratchet accepts, would be false
        here. It is available only to a region measured at diff 0, and this one is not.

        The name says what is in the region rather than that it scrolls, and it carries the paper
        so that four of these on one page are told apart.
      */}
      <section
        className="table-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard, which is the access defect the scroll container would otherwise introduce (am-bc6s). Suppressed inline, at the site, rather than as a fifth per-file override in biome.json: those turn the rule off for a whole file and carry no reason with them.
        tabIndex={0}
        aria-label={`Modern-layer symbols in ${paperTitle}: glyph, meaning, quantity identity, scope, and who introduced each one`}
      >
        <table className="modern-symbols-table">
          <thead>
            <tr>
              <th scope="col">Modern Glyph</th>
              <th scope="col">Label & Meaning</th>
              <th scope="col">Quantity Identity</th>
              <th scope="col">Scope</th>
              <th scope="col">Introduced By</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym) => {
              const qId = "quantityId" in sym.binding ? sym.binding.quantityId : sym.id;
              return (
                <tr key={sym.id}>
                  <td>
                    <span
                      className="inline-math"
                      {...{ dangerouslySetInnerHTML: { __html: sym.glyphRendered.html } }}
                    />
                  </td>
                  <td>{sym.label}</td>
                  <td>
                    <code>{qId}</code>
                  </td>
                  <td>{sym.scope.length > 0 ? sym.scope.join(", ") : "Modern layer"}</td>
                  <td>{sym.introducedBy}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}
