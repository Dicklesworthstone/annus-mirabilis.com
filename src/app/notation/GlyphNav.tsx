import type { NotationPageData } from "./notationData.ts";

/**
 * Every printed symbol, set as printed, each linking to the first entry that uses it. Plain links,
 * so the index works without JavaScript. Each link is named by aria-label, because its only
 * content is KaTeX and no browser names a link from the MathML half (see `name` in notationData).
 */
export function GlyphNav({ glyphs }: { glyphs: NotationPageData["uniqueGlyphs"] }) {
  return (
    <nav className="glyph-nav" aria-labelledby="glyph-nav-title">
      <h2 className="glyph-nav-title" id="glyph-nav-title">
        Go to a symbol
      </h2>
      <ul className="glyph-nav-list">
        {glyphs.map((g) => (
          <li
            key={g.key}
            className="glyph-nav-item"
            data-paper={g.paper}
            data-formula-plain={g.plain}
          >
            <a
              href={g.href}
              aria-label={g.name}
              {...{ dangerouslySetInnerHTML: { __html: g.html } }}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
