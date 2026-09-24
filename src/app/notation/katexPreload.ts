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
