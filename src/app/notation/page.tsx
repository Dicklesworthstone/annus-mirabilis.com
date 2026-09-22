import type { Metadata } from "next";
import "./notation.css";
import { CollisionClusterView } from "./CollisionClusterView.tsx";
import { NotationEntryCard } from "./NotationEntryCard.tsx";
import { NotationPageClient } from "./NotationPageClient.tsx";
import { loadNotationPageData } from "./notationData.ts";

export const metadata: Metadata = {
  title: "Notation concordance",
  description:
    "Scoped symbol meanings, historical mappings, unit-system conversions, and the collisions between them in the 1905 papers.",
};

export default function NotationPage() {
  const data = loadNotationPageData();

  return (
    <div className="notation-page" data-page="notation">
      <header className="notation-header">
        <p className="eyebrow">Critical Edition · Reference Apparatus</p>
        <h1>Scoped notation concordance</h1>
        <p className="lead">
          In 1905, notation was local. A glyph meant one thing in an electrodynamics derivation,
          another in molecular kinetics, and another in radiation thermodynamics. Here you can
          search every symbol, inspect its section-bounded meaning, and trace historical collisions.
        </p>
      </header>

      {/* Editorial Honesty Notice */}
      <aside className="honesty-banner" role="status" aria-label="Editorial verification status">
        <h2>
          <span aria-hidden="true">📋</span>
          <span>Editorial status: pending facsimile verification</span>
        </h2>
        <p>{data.honestyNotice.message}</p>
      </aside>

      {/* Quick In-Page Glyph Jump Navigation (No-JS Compatible) */}
      <nav className="glyph-nav" aria-label="Quick jump by glyph">
        <div className="glyph-nav-title">Jump to glyph</div>
        <ul className="glyph-nav-list">
          {data.uniqueGlyphs.map((g) => (
            <li key={g.key} className="glyph-nav-item">
              <a
                href={`#glyph-${g.key.replace(/[^a-zA-Z0-9]/g, "_")}`}
                title={`${g.display} (${g.count} entries)`}
              >
                {g.display}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Static Fallback for No-JS Readers & Hydration Anchor */}
      <noscript>
        <section
          className="no-js-concordance-view"
          aria-label="Full concordance catalogue (JavaScript disabled)"
        >
          <CollisionClusterView clusters={data.collisionClusters} />
          {data.papers.map((p) => (
            <div key={p.paperSlug} className="paper-section">
              <h2>{p.paperTitle}</h2>
              <div className="entries-grid">
                {p.entries.map((e) => (
                  <NotationEntryCard key={e.id} entry={e} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </noscript>

      {/* Interactive Client Component */}
      <NotationPageClient initialData={data} />
    </div>
  );
}
