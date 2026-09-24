import { readdirSync, statSync } from "node:fs";

/**
 * Ids that occur more than once in `html`, and url(#id) references (SVG markers, gradients, clip
 * paths) that do not name exactly one element. Shared by labUniqueIds.test.tsx and
 * pageUniqueIds.test.tsx.
 */
export function idProblems(html: string): string[] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/\sid="([^"]+)"/g))
    counts.set(m[1] ?? "", (counts.get(m[1] ?? "") ?? 0) + 1);
  const problems = [...counts].filter(([, n]) => n > 1).map(([id, n]) => `id ${id} ×${n}`);
  for (const m of html.matchAll(/url\(#([^)"']+)\)/g)) {
    const n = counts.get(m[1] ?? "") ?? 0;
    if (n !== 1) problems.push(`url(#${m[1]}) names ${n} elements`);
  }
  return [...new Set(problems)];
}

/**
 * The page.tsx files under `dir`, as route paths relative to it with a trailing slash. A folder
 * whose name starts with "_" is private in the App Router and is never a route, so it is skipped.
 */
export function pageRoutes(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory())
      return name.startsWith("_") ? [] : pageRoutes(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/** The markup as a browser with JavaScript parses it: <noscript> content is inert text there. */
export const withoutNoscript = (html: string) =>
  html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
