/**
 * Collision Cluster View Component (am-not-notation-page-2us).
 * Specification: AGENTS.md, am-not-concordance-model-uag.
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
          In 1905 physics, identical symbols represent fundamentally different quantities across
          papers, within sections of the same paper, or when switching between historical and modern
          notation. Danger collisions are marked with high-contrast text and icons.
        </p>
      </div>

      <div className="collision-grid">
        {clusters.map((cluster) => {
          const isDanger = cluster.severity === "danger";
          return (
            <article
              key={cluster.glyphKey}
              className={`collision-card ${cluster.severity}`}
              id={`collision-${cluster.glyphKey.replace(/[^a-zA-Z0-9]/g, "_")}`}
            >
              <div className="collision-card-top">
                <span
                  className="collision-glyph"
                  {...{ dangerouslySetInnerHTML: { __html: cluster.glyphRendered.html } }}
                />
                <span className={`collision-severity-tag ${cluster.severity}`}>
                  <span aria-hidden="true">{isDanger ? "⚠️" : "⚡"}</span>
                  <span>[{cluster.severity.toUpperCase()} COLLISION]</span>
                </span>
              </div>

              <p className="collision-card-desc">{cluster.description}</p>

              <div className="collision-entries-list">
                {cluster.entries.map((e) => (
                  <div
                    key={e.id}
                    className="collision-entry-summary"
                    style={{ margin: "0.5rem 0", fontSize: "0.88rem" }}
                  >
                    <strong>
                      {e.paperTitle} ({e.scope.join(", ")}):
                    </strong>{" "}
                    {e.meaning}
                    {" · "}
                    <a href={`#${e.id}`} className="card-anchor-link">
                      View full entry #{e.id}
                    </a>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
