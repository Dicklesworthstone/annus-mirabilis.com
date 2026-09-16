import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Annus Mirabilis — four papers, one year", template: "%s · Annus Mirabilis" },
  description: "An interactive edition in preparation. Begin with an executable Brownian-motion laboratory and a static, accessible first encounter.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main">Skip to the content</a>
    <header className="site-header"><a className="wordmark" href="/">Annus Mirabilis<span>Four papers. One year.</span></a><nav aria-label="Main navigation"><a href="/papers/">The papers</a><a href="/discover/brownian-motion/">Discover</a><a href="/lab/bm-06/">Laboratory</a></nav></header>
    <main id="main">{children}</main>
    <footer className="site-footer"><p>A critical edition in preparation. The current laboratory is a labeled host calculation, not a reviewed historical edition or an observation of nature.</p><a href="https://github.com/Dicklesworthstone/annus-mirabilis.com">Source and development plan</a></footer>
  </body></html>;
}
