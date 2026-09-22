import type { ReactNode } from "react";

/*
 * NO ROUTE THEME. This layout set data-route-theme="kramgasse-night", a leftover of the retired
 * "Slate on /discover" rule, so every discovery page was dark for any reader who had not pressed
 * the switch, and the page flipped from light to dark and back as they moved between / and
 * /discover/. The owner's ruling is one dark/light toggle; the reader's choice now holds on every
 * route. Measured before on out/ 14:47:11, fresh context, Chromium and WebKit: /discover/ and
 * /discover/brownian-motion/ dark under a light system preference, /, /papers/ and /lab/bm-01/
 * light.
 */
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children;
}
