import type { Metadata } from "next";
import { preload } from "react-dom";
import "./notation.css";
import "../../components/home/wideProse.css";
import { CollisionClusterView } from "./CollisionClusterView.tsx";
import { loadFirstUseTargets, resolveFirstUse } from "./firstUseTargets.ts";
import { GlyphNav } from "./GlyphNav.tsx";
import { KATEX_PRELOAD_FONTS, katexPreloadHref } from "./katexPreload.ts";
import { NotationEntryCard } from "./NotationEntryCard.tsx";
import { NotationPageClient } from "./NotationPageClient.tsx";
import { loadNotationPageData } from "./notationData.ts";

export const metadata: Metadata = {
  title: "Notation concordance",
  description:
    "The letters Einstein reused across the 1905 papers, what each one means where it appears, and the symbol a modern reader would use: in the relativity paper his β is the modern γ, and in the Brownian paper his k is the viscosity.",
};

export default async function NotationPage() {
  // The symbol index's KaTeX faces, fetched with the page instead of after the stylesheet names
  // them (katexPreload.ts: CLS at 1440 0.235 -> 0.097).
  for (const file of KATEX_PRELOAD_FONTS) {
    preload(katexPreloadHref(file), { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  const targets = await loadFirstUseTargets();
  const data = loadNotationPageData(undefined, (paper, anchor) =>
    resolveFirstUse(paper, anchor, targets),
  );

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

      <GlyphNav glyphs={data.uniqueGlyphs} />

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
