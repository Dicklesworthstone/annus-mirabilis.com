import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./theme/themes.css";
import "../a11y/readingSettings/readingSettings.css";
import { READING_SETTINGS_PREPAINT } from "../a11y/readingSettings/prepaint";
import { ReadingSettingsPanel } from "../a11y/readingSettings/ReadingSettingsPanel";
import { FORMULA_OVERFLOW_SOURCE } from "../components/edition/formulaOverflow.inline";
import { PermalinkRobotsManager } from "../experiments/permalink/PermalinkRobotsManager.tsx";
import { READER_PREPAINT } from "../reader/detail/prepaint";
import { NotebookLauncher } from "../reader/notebook/NotebookLauncher.tsx";
import { SearchLauncher } from "../search/SearchLauncher.tsx";
import { ThemeToggle } from "./theme/ThemeToggle";
import { THEME_INIT_SOURCE } from "./theme/themeInit.inline";
export const metadata: Metadata = {
  metadataBase: new URL("https://annus-mirabilis.com"),
  title: { default: "Annus Mirabilis: four papers, one year", template: "%s · Annus Mirabilis" },
  description:
    "An interactive edition in preparation. Begin with an executable Brownian-motion laboratory and a static, accessible first encounter.",
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
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the content
        </a>
        <header className="site-header">
          <a className="wordmark" href="/">
            Annus Mirabilis<span>Einstein in 1905</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="/papers/">Papers</a>
            <a href="/discover/">Discovery routes</a>
            <a href="/instruments/">Instruments</a>
            <a href="/connections/">Across the papers</a>
            <SearchLauncher />
            <NotebookLauncher />
          </nav>
          <div className="header-controls">
            <ReadingSettingsPanel />
            <ThemeToggle />
          </div>
        </header>
        <PermalinkRobotsManager />
        <main id="main">{children}</main>
        {/*
          THE FOOTER CARRIES THE PAGE THAT EXPLAINS WHAT THE SITE STORES.
          Measured 2026-09-22 across every .tsx in src/: `href="/your-data/"` appeared ZERO times.
          The page existed, was written, and was reachable only by typing the URL. For a site
          whose stated position is no accounts, no tracking and everything kept on the reader's own
          device, the page making that promise being unreachable is the promise going unmade.
          The footer is where a reader looks for it, and it is on every page.
        */}
        <footer className="site-footer">
          <p>
            A critical edition in preparation. The instruments here work out their own numbers and
            say so where each one appears; none of them is a measurement of nature.
          </p>
          <nav aria-label="About this site">
            <a href="/your-data/">What this site stores</a>
            <a href="/offline/">Read without a connection</a>
            <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com">
              Source and development plan
            </a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
