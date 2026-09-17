import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import "../a11y/readingSettings/readingSettings.css";
import { READING_SETTINGS_PREPAINT } from "../a11y/readingSettings/prepaint";
import { ReadingSettingsPanel } from "../a11y/readingSettings/ReadingSettingsPanel";
import { READER_PREPAINT } from "../reader/detail/prepaint";
export const metadata: Metadata = {
  metadataBase: new URL("https://annus-mirabilis.com"),
  title: { default: "Annus Mirabilis — four papers, one year", template: "%s · Annus Mirabilis" },
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
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the content
        </a>
        <header className="site-header">
          <a className="wordmark" href="/">
            Annus Mirabilis<span>Four papers. One year.</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="/papers/">The papers</a>
            <a href="/discover/brownian-motion/">Discover</a>
            <a href="/lab/bm-06/">Laboratory</a>
          </nav>
          <ReadingSettingsPanel />
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p>
            A critical edition in preparation. The current laboratory is a labeled host calculation,
            not a reviewed historical edition or an observation of nature.
          </p>
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com">
            Source and development plan
          </a>
        </footer>
      </body>
    </html>
  );
}
