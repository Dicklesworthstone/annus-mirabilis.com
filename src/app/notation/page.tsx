import type { Metadata } from "next";
import { preload } from "react-dom";
import "./notation.css";
import "../../components/home/wideProse.css";
// Each formula is drawn in its paper's colours (colouredGlyphs.ts, dispatch 275): the rule that
// turns a marked term its colour, and each paper's colour for each of its quantities.
import "../../equations/equations.css";
import "../../generated/quantity-colours-by-paper.css";
import { CollisionClusterView } from "./CollisionClusterView.tsx";
import { loadFirstUseTargets, resolveFirstUse } from "./firstUseTargets.ts";
import { GlyphNav } from "./GlyphNav.tsx";
import {
  KATEX_PRELOAD_FONTS,
  katexPreloadHref,
  NEWSREADER_PRELOAD_FONTS,
  siteFontPreloadHref,
} from "./katexPreload.ts";
import { NotationPageClient } from "./NotationPageClient.tsx";
import { loadNotationPageData } from "./notationData.ts";
import { UnlistedQuantities } from "./UnlistedQuantities.tsx";

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
  // The lead's roman and italic Newsreader, together, so its italic letters do not rewrap it a
  // fifth line after load (katexPreload.ts: CLS 0.0975 at 1440).
  for (const file of NEWSREADER_PRELOAD_FONTS) {
    preload(siteFontPreloadHref(file), { as: "font", type: "font/ttf", crossOrigin: "anonymous" });
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
      </header>

      <GlyphNav glyphs={data.uniqueGlyphs} />

      {/* Without JavaScript the catalogue below is already in the page, rendered on the server;
          what a reader cannot reach is the symbols-with-several-meanings view, which only its
          toggle shows. So that is all this adds. It used to repeat the whole catalogue as well:
          measured on live 2026-09-24 with JavaScript off, 387 entry cards instead of 199, 376
          duplicated ids, and a page 50,373px tall instead of 24,271. */}
      <noscript>
        <div className="no-js-concordance-view">
          <CollisionClusterView clusters={data.collisionClusters} />
        </div>
      </noscript>

      {/* Interactive Client Component */}
      <NotationPageClient initialData={data} />

      {/* The quantities a printed display's term chip links to when they have no entry above
          (dispatch 254): the chips are real links without JavaScript, so each needs a place. */}
      <UnlistedQuantities />
    </div>
  );
}
