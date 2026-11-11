"use client";

import { usePathname } from "next/navigation";

/*
 * The destinations in the header, with the current one marked. `usePathname` runs during the
 * static export too, so aria-current is in each page's HTML and the mark works without JavaScript.
 *
 * Short labels keep the wrapping phone navigation compact. "Discover" is the edition's name
 * for the activity; "Timeline" leads to the dated sources behind the four journeys.
 */
const DESTINATIONS: readonly { href: string; label: string; alsoUnder?: readonly string[] }[] = [
  { href: "/papers/", label: "Papers" },
  { href: "/discover/", label: "Discover" },
  { href: "/1904/", label: "1904 desk" },
  // A laboratory is an instrument, so /lab/* counts as being under Instruments.
  { href: "/instruments/", label: "Instruments", alsoUnder: ["/lab/"] },
  { href: "/connections/", label: "Connections" },
  { href: "/essays/", label: "Essays" },
  { href: "/timeline/", label: "Timeline" },
];

function withSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

export function PrimaryNavLinks() {
  const path = withSlash(usePathname() ?? "/");
  return DESTINATIONS.map(({ href, label, alsoUnder }) => {
    const under = path.startsWith(href) || (alsoUnder ?? []).some((p) => path.startsWith(p));
    const current = path === href ? "page" : under ? "true" : undefined;
    return (
      <a key={href} href={href} aria-current={current}>
        {label}
      </a>
    );
  });
}
