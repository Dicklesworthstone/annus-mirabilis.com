# The placeholder page, kept as the design reference

This is the source of the static page served at `annus-mirabilis.com` while the edition is in preparation, deployed on 2026-09-14. The owner asked to keep its design as the basis for the real site, so treat it as the reference implementation of the **Annalen** theme rather than as throwaway work. A departure from it in the real site carries a recorded reason.

It is not part of the application build. Nothing here is imported by `src/`; the real site rebuilds these decisions with its own tokens, fonts, and components.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: running head, display title, frontispiece, page marks, the four papers as questions, the in-preparation section, foot |
| `style.css` | The whole design: tokens, type scale, layout, page marks, print-free plain CSS with no build step |
| `404.html` | The not-found page in the same shell |
| `og-card.html` | The 1200 by 630 share card, rendered to `og.png` with headless Chrome |
| `favicon.svg` | The page-count mark: four bars in the proportions 17, 12, 31, and 3 |
| `robots.txt`, `vercel.json` | Serving configuration: security headers, the `www` redirect, `noindex` on `vercel.app` hosts |

Not committed here: the self-hosted Newsreader subsets (from `@fontsource-variable/newsreader` 5.3.0, SIL Open Font License) and the frontispiece crops (from ETH-Bibliothek Zürich, Bildarchiv, Portr_05937, public domain). Both are reproducible, and the real site subsets its own fonts.

## The design in one page

**Palette (Annalen).** Paper `#eee7d7`, ink `#1a1916`, muted `#5c554a`, rule `#cbc1ac`, red `#ae2119`. Red appears only for emphasis: the in-preparation label, link underlines, the focus ring, and the highlight when a paper is pointed at. No gradients, no shadows, no rounded panels.

**Type.** Newsreader for everything, with the optical-size axis: a display title at `clamp(3.3rem, 13.5vw, 7.25rem)` (capped near `6rem` beside the frontispiece), an italic subtitle, body at `1.1875rem` with a `36em` measure, and small letterspaced uppercase for the running head, foot, and locators. Locators use lining tabular figures.

**Structure.** A running head with the site name and `In Vorbereitung`; a frontispiece beside the title on wide screens and above it on phones, with its photograph credit; the sixty-three page marks; the four papers, each a question with the German title in italic, the working English title, and the `Annalen` locator; the in-preparation section with its links; a foot with the domain and the year.

**The signature.** One mark per printed journal page, grouped 17, 12, 31, and 3. It encodes something true (the papers' real lengths, including how short the mass-energy paper is), it reappears as the app icon and the share card, and pointing at a paper lights its own pages in red.

**Honesty.** No script of any kind, no third-party origin, no cookie, no analytics. Everything reads with JavaScript disabled because there is none. The page claims nothing about what is ready: it says the edition is in preparation and links to the plan, the task graph, and the repository.
