import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE TWO KATEX FACES /notation/'s SYMBOL INDEX NEEDS FIRST, PRELOADED.
 *
 * The index sets 121 printed symbols with KaTeX. Its fonts load only once the stylesheet that names
 * them has been read, so the first frame lays the symbols out in the fallback serif; when
 * KaTeX_Main and KaTeX_Math arrive the chips widen by 3-6px, the row count goes from 5 to 6 at
 * 1440, and everything below drops. Measured on live 211e9af4, five cold loads at 1440: CLS median
 * 0.235 without a preload, 0.097 with these two preloaded.
 *
 * The file names are Next's media names, `<name>.<first 8 hex of xxHash64(file)>.woff2`, for the
 * fonts in node_modules/katex/dist/fonts. katexPreload.test.ts recomputes each hash from the
 * installed file, so a KaTeX upgrade fails that test instead of silently preloading a 404.
 */
export const KATEX_PRELOAD_FONTS = [
  "KaTeX_Main-Regular.0462f03b.woff2",
  "KaTeX_Math-Italic.f28c23ac.woff2",
] as const;

export function katexPreloadHref(file: string): string {
  return `/_next/static/media/${file}`;
}

/**
 * THE LEAD'S TWO NEWSREADER FACES, PRELOADED TOO.
 *
 * With the KaTeX faces preloaded, the rest of the shift was the lead paragraph, not the symbols:
 * at 1440 it sets beta, gamma, h and k in <i>, so it needs Newsreader's roman and its italic. The
 * roman arrived first while the italic letters were drawn slanted from it, narrower, and when the
 * italic face landed about 300ms after load the lead took a fifth line and the page below moved
 * 38px (live 2316a43b, Chromium: CLS 0.0975 at 1440, 0.094 at 1366, 0.089 at 1280, 0.084 at
 * 1920; 0 with the site's faces blocked, unchanged with only KaTeX's blocked). Fetched with the page,
 * both faces are in hand together.
 *
 * Each URL carries ?v= and the first eight hex digits of the file's SHA-256, the rule
 * fontCache.test.ts holds the stylesheets to, so the preload names exactly the URL the @font-face
 * requests and the browser reuses it rather than fetching the face twice.
 */
export const NEWSREADER_PRELOAD_FONTS = [
  "newsreader/Newsreader-Variable.ttf",
  "newsreader/Newsreader-Italic-Variable.ttf",
] as const;

export function siteFontPreloadHref(file: string, root: string = process.cwd()): string {
  const digest = createHash("sha256")
    .update(readFileSync(join(root, "public", "fonts", file)))
    .digest("hex");
  return `/fonts/${file}?v=${digest.slice(0, 8)}`;
}
