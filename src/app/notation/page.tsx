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
        <p className="eyebrow">Notation</p>
        <h1>One letter, several meanings</h1>
        <p className="lead">
          Einstein reused letters. In the relativity paper <i>β</i> is the factor a modern reader
          writes <i>γ</i>; in the light-quanta paper it is Wien&rsquo;s constant, the modern{" "}
          <i>h</i>/<i>k</i>
          <sub>B</sub>. In the Brownian paper <i>k</i> is the viscosity of the liquid, not
          Boltzmann&rsquo;s constant. Each entry below gives a symbol as it was printed, what it
          means in the sections where it appears, the symbol a modern reader would use where that
          differs, and the first place the paper uses it.
        </p>
        <p className="callout-note notation-status">{data.honestyNotice.message}</p>
      </header>

      {/* Every printed symbol, set as printed, each linking to the first entry that uses it.
          Plain links, so the index works without JavaScript. */}
      <nav className="glyph-nav" aria-labelledby="glyph-nav-title">
        <h2 className="glyph-nav-title" id="glyph-nav-title">
          Go to a symbol
        </h2>
        <ul className="glyph-nav-list">
          {data.uniqueGlyphs.map((g) => (
            <li key={g.key} className="glyph-nav-item">
              <a href={g.href} {...{ dangerouslySetInnerHTML: { __html: g.html } }} />
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
