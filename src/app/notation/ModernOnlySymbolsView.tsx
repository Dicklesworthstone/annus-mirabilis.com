/**
 * Modern-Only Symbols View Component (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 */

import React from "react";
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
                    dangerouslySetInnerHTML={{ __html: sym.glyphRendered.html }}
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
  );
}
