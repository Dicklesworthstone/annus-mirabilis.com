/**
 * A FRAGMENT LINK THAT LANDS AT THE TOP OF THE PAGE IS BROKEN AND RETURNS 200 (am-rel-candidate-checks-kc7y).
 *
 * `/papers/mass-energy/#arg-foo` on a page with no `arg-foo` is a 200 for the server and a failure
 * for the reader, who arrives at the top of a long page and never learns what they missed. No
 * existing check asks this: the served-as-built checks compare bytes, and a byte-identical page can
 * still carry a link to a fragment nobody ever wrote.
 *
 * THE DEFECT CLASS IS ON THE RECORD, not hypothetical. 8 of 8 fragment links on the live mass-energy
 * capstone were broken this morning — every "read this in the paper" link landing at the top of the
 * paper — and a 933-pair sweep earlier found one more. When anchors are generated from the same
 * records their targets are generated from, rather than authored, this check has nothing left to
 * catch and should be deleted.
 *
 * EVERY BYTE COMES FROM THE CANDIDATE. The route list is read from the candidate's own sitemap and
 * every page is fetched, so nothing here reads the local build directory; that is the point of a
 * candidate check and it is `am-rel-candidate-checks-kc7y`'s own criterion.
 *
 * THE HREF PATTERN IS ANCHORED ON THE HREF, NOT ON A GUESS ABOUT THE PATH. A trailing-slash rule
 * that treats a dotted tail as a file extension reads `/tapes/the-boost-to-0.6c` as a file and drops
 * it, which cost a false finding. The path is taken exactly as the document wrote it and fetched
 * exactly that way, and the matched tokens are reported rather than only counted.
 */

import type { Fetcher } from "./candidate-checks.ts";

export type FragmentLink = Readonly<{ from: string; target: string; fragment: string }>;

/** Routes in a sitemap, as paths. Absolute URLs are reduced to their path so both forms work. */
export function sitemapRoutes(xml: string, origin?: string): string[] {
  const out = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const raw = m[1];
    if (!raw) continue;
    try {
      const url = new URL(raw, origin ?? "https://example.invalid");
      out.add(url.pathname);
    } catch {
      if (raw.startsWith("/")) out.add(raw);
    }
  }
  return [...out].sort();
}

/**
 * Every internal link carrying a fragment, with its target path resolved against the page it was
 * found on. A bare `#frag` targets its own page. External links, `mailto:` and a lone `#` are not
 * fragment links into this site and are excluded.
 */
export function fragmentLinks(html: string, fromPath: string): FragmentLink[] {
  const out: FragmentLink[] = [];
  for (const m of html.matchAll(/href="([^"]*#[^"]*)"/g)) {
    const href = m[1];
    if (!href) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) continue; // http:, mailto:, javascript:
    if (href.startsWith("//")) continue; // protocol-relative, i.e. another origin
    const hash = href.indexOf("#");
    const rawFragment = href.slice(hash + 1);
    if (!rawFragment) continue; // a bare "#" is a top-of-page link, not a claim about an id
    let fragment: string;
    try {
      fragment = decodeURIComponent(rawFragment);
    } catch {
      fragment = rawFragment;
    }
    const pagePart = href.slice(0, hash);
    // Resolved against the page it appears on, so a relative href is not mistaken for a root path.
    let target: string;
    try {
      target = new URL(pagePart || fromPath, `https://example.invalid${fromPath}`).pathname;
    } catch {
      target = pagePart || fromPath;
    }
    out.push({ from: fromPath, target, fragment });
  }
  return out;
}

/** Every id an element on this page carries, plus legacy `name` anchors. */
export function anchorIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) if (m[1]) ids.add(m[1]);
  for (const m of html.matchAll(/<a[^>]*\sname="([^"]+)"/g)) if (m[1]) ids.add(m[1]);
  return ids;
}

export type AnchorSweep = Readonly<{
  pages: number;
  /** Every fragment link found, counting each occurrence. */
  pairs: number;
  /** Distinct `target#fragment` claims, which is the unit a hand sweep naturally reports. */
  distinct: number;
  targets: number;
  broken: readonly FragmentLink[];
  unreachable: readonly string[];
}>;

/**
 * Fetches every route, collects its fragment links, then fetches each distinct target ONCE and
 * checks the fragment against the ids that page actually has.
 *
 * A target that cannot be fetched is reported separately from a broken fragment: a 404 is a broken
 * LINK and a missing id is a broken ANCHOR, and collapsing them would hide which one to repair.
 */
export async function sweepAnchors(
  fetcher: Fetcher,
  routes: readonly string[],
  concurrency = 8,
): Promise<AnchorSweep> {
  const links: FragmentLink[] = [];
  const pool = async <T>(items: readonly T[], run: (item: T) => Promise<void>) => {
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) {
        const item = items[i];
        if (item !== undefined) await run(item);
      }
    });
    await Promise.all(workers);
  };

  await pool(routes, async (route) => {
    const res = await fetcher(route);
    if (res.status !== 200) return;
    links.push(...fragmentLinks(res.body.toString("utf8"), route));
  });

  const targets = [...new Set(links.map((l) => l.target))].sort();
  const idsByTarget = new Map<string, Set<string> | null>();
  await pool(targets, async (target) => {
    const res = await fetcher(target);
    idsByTarget.set(target, res.status === 200 ? anchorIds(res.body.toString("utf8")) : null);
  });

  const broken: FragmentLink[] = [];
  const unreachable: string[] = [];
  for (const [target, ids] of idsByTarget) if (ids === null) unreachable.push(target);
  for (const link of links) {
    const ids = idsByTarget.get(link.target);
    if (!ids) continue; // unreachable targets are reported above, not counted twice
    if (!ids.has(link.fragment)) broken.push(link);
  }
  return {
    pages: routes.length,
    pairs: links.length,
    distinct: new Set(links.map((l) => `${l.target}#${l.fragment}`)).size,
    targets: targets.length,
    broken,
    unreachable: unreachable.sort(),
  };
}

/** One line a log reader can act on: what was examined, then the verdict. */
export function describeSweep(sweep: AnchorSweep): string {
  const sample = sweep.broken
    .slice(0, 5)
    .map((b) => `${b.from} -> ${b.target}#${b.fragment}`)
    .join("; ");
  return (
    `${sweep.pairs} fragment links (${sweep.distinct} distinct target#fragment) over ` +
    `${sweep.targets} target pages, from ${sweep.pages} routes; ` +
    `${sweep.broken.length} broken${sample ? ` (${sample}${sweep.broken.length > 5 ? ", …" : ""})` : ""}` +
    `${sweep.unreachable.length ? `; ${sweep.unreachable.length} target(s) unreachable (${sweep.unreachable.slice(0, 3).join(", ")})` : ""}`
  );
}
