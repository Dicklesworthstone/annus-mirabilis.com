/**
 * Symbols this edition uses that the paper does not print (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 *
 * Set as rows in the same form as the printed entries, so a reader compares like with like, and
 * marked "not printed" on every row. This replaced a five-column table whose columns were a
 * quantity id and an internal "introduced by" id ("kinematics-modern-lens"); it needed a
 * scrolling container on a phone, and neither column told a reader anything.
 */

import type { PaperNotationSection } from "./notationData.ts";

export interface ModernOnlySymbolsViewProps {
  readonly paperSlug: string;
  readonly paperTitle: string;
  readonly symbols: PaperNotationSection["modernOnlySymbols"];
}

export function ModernOnlySymbolsView({
  paperSlug,
  paperTitle,
  symbols,
}: ModernOnlySymbolsViewProps) {
  if (!symbols || symbols.length === 0) {
    return null;
  }
  const headingId = `modern-symbols-${paperSlug}`;

  return (
    <section className="modern-only-section" aria-labelledby={headingId}>
      <h3 id={headingId}>Symbols this edition adds</h3>
      <p className="modern-only-intro">
        These appear in the modern explanations and worked examples for {paperTitle}. The paper
        itself does not print them.
      </p>
      <div className="entries-grid">
        {symbols.map((sym) => (
          <article key={sym.id} className="notation-entry" id={sym.id}>
            <span
              className="notation-entry-glyph"
              data-formula-plain={sym.glyphRendered.plain}
              {...{ dangerouslySetInnerHTML: { __html: sym.glyphRendered.html } }}
            />
            <div className="notation-entry-body">
              <p className="notation-entry-meaning">{sym.label}</p>
              <p className="notation-entry-facts">
                <span>Not printed in the paper</span>
                {sym.whereLabel && <span>{sym.whereLabel}</span>}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
