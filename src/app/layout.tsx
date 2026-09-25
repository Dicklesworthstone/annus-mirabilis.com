import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./theme/themes.css";
import "../a11y/readingSettings/readingSettings.css";
import "../a11y/modal/modal.css";
import { READING_SETTINGS_PREPAINT } from "../a11y/readingSettings/prepaint";
import { ReadingSettingsPanel } from "../a11y/readingSettings/ReadingSettingsPanel";
import { MenuToggle } from "../components/chrome/MenuToggle.tsx";
import { NOSCRIPT_CONTROLS_CSS } from "../components/chrome/noScriptControls.ts";
import { PrimaryNavLinks } from "../components/chrome/PrimaryNavLinks.tsx";
import { FORMULA_OVERFLOW_SOURCE } from "../components/edition/formulaOverflow.inline";
import { shareImage } from "../components/share/shareImages.ts";
import { GuidedTourTrail } from "../discovery/tours/GuidedTourTrail.tsx";
import { PermalinkRobotsManager } from "../experiments/permalink/PermalinkRobotsManager.tsx";
import { READER_PREPAINT } from "../reader/detail/prepaint";
import { NotebookLauncher } from "../reader/notebook/NotebookLauncher.tsx";
import { SearchLauncher } from "../search/SearchLauncher.tsx";
import { ThemeToggle } from "./theme/ThemeToggle";
import { THEME_INIT_SOURCE } from "./theme/themeInit.inline";

/*
 * EVERY PAGE WITHOUT A CARD OF ITS OWN SHARES THE SITE CARD, AS A .png. Until 2026-09-23 these
 * pages (109 of 334 in the export) took the image from the opengraph-image.tsx convention, whose
 * URL has no extension: on Vercel it answered 308 to a trailing slash and then served the PNG as
 * application/octet-stream, which link previews reject. The same card is published at
 * /share/home.png by the share route, and naming it here sets both tags. Naming it alone did not
 * set og:image: Next attaches a folder's opengraph-image file to the page node as well as the
 * layout, and a file image beats config there (the 19:38 build, 2026-09-23, carried twitter:image
 * /share/home.png beside og:image /opengraph-image?<hash>). So the module is kept as
 * src/app/_opengraph-image.tsx, a name outside the file convention, and this is the only source.
 */
const SITE_CARD = [
  shareImage(
    "home",
    "The first printed pages of Einstein's four papers of 1905, each under the day Annalen der Physik received it",
  ),
];

export const metadata: Metadata = {
  metadataBase: new URL("https://annus-mirabilis.com"),
  title: { default: "Annus Mirabilis: four papers, one year", template: "%s · Annus Mirabilis" },
  description:
    "An edition, in preparation, of the four papers Einstein sent to the Annalen der Physik in 1905: each explained at the depth you choose, with instruments that work out what follows when you change an assumption.",
  openGraph: { images: SITE_CARD },
  twitter: { card: "summary_large_image", images: SITE_CARD },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint detail/theme scripts must run before hydration; hash-based CSP replaces unsafe-inline in am-plat-security-f644 */}
        <script dangerouslySetInnerHTML={{ __html: READER_PREPAINT }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: reading-only and layout preferences must apply before first paint */}
        <script dangerouslySetInnerHTML={{ __html: READING_SETTINGS_PREPAINT }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sets data-theme on <html> before first paint so no wrong theme flashes; source is a tested pure function, never hand-authored HTML */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SOURCE }} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: ensures overflowing formulas are keyboard-reachable with distinct accessible names without bulk-applying tabindex (am-bc6s) */}
        <script dangerouslySetInnerHTML={{ __html: FORMULA_OVERFLOW_SOURCE }} />
        {/* How a page prints: one column, no chrome, no closed drawers. Loaded only for print, so no
            screen waits for it (src/platform/print/sitePrint.css, served by print.css/route.ts). */}
        <link rel="stylesheet" href="/print.css" media="print" />
        {/* Without JavaScript, a button only JavaScript can work is not shown
            (components/chrome/noScriptControls.ts says which, and why not a wrapper). */}
        <noscript>
          <style>{NOSCRIPT_CONTROLS_CSS}</style>
        </noscript>
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the content
        </a>
        <header className="site-header">
          <a className="wordmark" href="/">
            Annus Mirabilis<span>Einstein in 1905</span>
          </a>
          <MenuToggle />
          <nav id="site-nav" aria-label="Main navigation">
            <PrimaryNavLinks />
            <SearchLauncher />
            <NotebookLauncher />
          </nav>
          <div className="header-controls">
            <ReadingSettingsPanel />
            <ThemeToggle />
          </div>
        </header>
        <PermalinkRobotsManager />
        <Suspense fallback={null}>
          <GuidedTourTrail />
        </Suspense>
        {/* The page hydrates in its own boundary. Without it, a page component that suspended on a
            late chunk while <main> was hydrating was retried with React's cursor already inside
            <main>: it found main's first child where it expected <main> and threw React #418,
            about one load in 300 on live (dispatch 171, src/testing/rootLayoutHydration.test.tsx). */}
        <main id="main">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
        <Suspense fallback={null}>
          <GuidedTourTrail compact />
        </Suspense>
        {/*
          THE FOOTER CARRIES THE PAGE THAT EXPLAINS WHAT THE SITE STORES.
          Measured 2026-09-22 across every .tsx in src/: `href="/your-data/"` appeared ZERO times.
          The page existed, was written, and was reachable only by typing the URL. For a site
          whose stated position is no accounts, no tracking and everything kept on the reader's own
          device, the page making that promise being unreachable is the promise going unmade.
          The footer is where a reader looks for it, and it is on every page.
        */}
        <footer className="site-footer">
          <div className="site-footer-about">
            <p className="site-footer-name">Annus Mirabilis</p>
            <p>
              A critical edition of the four papers Einstein sent to the Annalen der Physik in 1905,
              in preparation. Every number an instrument shows is worked out by that instrument and
              labelled as a calculation; none of them is a measurement of nature.
            </p>
          </div>
          {/* The four papers again at the foot, because the end of a long paper is where a reader
              looks for the next one; the guided paths are a way of reading them, so they sit here
              rather than among the pages about the site. */}
          <nav aria-label="The four papers">
            <a href="/papers/light-quanta/">Light quanta</a>
            <a href="/papers/brownian-motion/">Brownian motion</a>
            <a href="/papers/special-relativity/">Special relativity</a>
            <a href="/papers/mass-energy/">Mass and energy</a>
            <a href="/tours/">Guided reading paths</a>
          </nav>
          <nav aria-label="About this site">
            <a href="/about/">About this edition</a>
            <a href="/sources/">Where the scans come from</a>
            <a href="/your-data/">What this site stores</a>
            <a href="/accessibility/">Accessibility</a>
            <a href="/offline/">Read without a connection</a>
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com">
              Source and development plan
            </a>
          </nav>
          <p className="site-footer-colophon">
            Set in Newsreader, Plus Jakarta Sans and JetBrains Mono, all served from this site. The
            1905 pages are scans of the Bell &amp; Howell / UMI microfilm, via the Internet Archive.
          </p>
        </footer>
      </body>
    </html>
  );
}
