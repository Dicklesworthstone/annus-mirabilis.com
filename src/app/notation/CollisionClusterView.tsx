/**
 * The symbols printed with more than one meaning (am-not-notation-page-2us), grouped by symbol.
 * Specification: AGENTS.md, am-not-concordance-model-uag.
 *
 * Each group is the symbol, how many meanings it has and where, and each meaning in its entry's
 * own words, linked to the entry. The ones most easily misread (AGENTS.md: beta, and paper 2's
 * k) come first and say so in words. This replaced cards headed "[DANGER COLLISION]" with an
 * emoji, a line per entry of raw section tokens, and links reading "View full entry
 * #lq.beta.wienConstant".
 */

import type { CollisionCluster } from "./notationData.ts";

export interface CollisionClusterViewProps {
  readonly clusters: readonly CollisionCluster[];
}

export function CollisionClusterView({ clusters }: CollisionClusterViewProps) {
  if (clusters.length === 0) {
    return null;
  }

  return (
    <section className="collision-cluster-section" aria-labelledby="collision-section-heading">
      <div className="collision-cluster-header">
        <h2 id="collision-section-heading">Where one symbol means two different things</h2>
        <p>
          The same printed symbol can stand for different quantities in different papers, in
          different sections of one paper, or in the paper and in modern notation. The ones most
          easily misread come first.
        </p>
      </div>

      <div className="collision-grid">
        {clusters.map((cluster) => (
          <article
            key={cluster.glyphKey}
            className={`collision-card ${cluster.severity}`}
            id={`collision-${cluster.glyphKey.replace(/[^a-zA-Z0-9]/g, "_")}`}
          >
            <p className="collision-card-top">
              <span
                className="collision-glyph"
                data-paper={cluster.glyphRendered.paper}
                data-formula-plain={cluster.glyphRendered.plain}
                {...{ dangerouslySetInnerHTML: { __html: cluster.glyphRendered.html } }}
              />
              {cluster.severity === "danger" && (
                <strong className="notation-entry-flag">Easily misread</strong>
              )}
            </p>
            <p className="collision-card-desc">{cluster.description}</p>
            <ul className="collision-entries-list">
              {cluster.entries.map((e) => (
                <li key={e.id}>
                  <a href={`#${e.id}`}>{e.meaning}</a> ({e.paperTitle}, {e.whereLabel})
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
