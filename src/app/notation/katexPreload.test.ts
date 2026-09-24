import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KATEX_PRELOAD_FONTS,
  katexPreloadHref,
  NEWSREADER_PRELOAD_FONTS,
  siteFontPreloadHref,
} from "./katexPreload.ts";

/**
 * The preloaded names must be the names Next gives the installed KaTeX fonts, or the preload
 * fetches a 404 and the page shifts as before. Next names a CSS-referenced font
 * `<name>.<first 8 hex of xxHash64(content)>.<ext>`; this recomputes that from the file in
 * node_modules. Checked against a real build: KaTeX_Main-Regular.woff2 hashes to 0462f03b..., the
 * name served on live 211e9af4.
 */
describe("KaTeX preload names on /notation/", () => {
  test("each name's hash is the installed font's xxHash64, so the preload is not a 404", () => {
    expect(KATEX_PRELOAD_FONTS.length).toBeGreaterThan(0);
    for (const file of KATEX_PRELOAD_FONTS) {
      const match = /^(KaTeX_[A-Za-z0-9-]+)\.([0-9a-f]{8})\.woff2$/.exec(file);
      expect(match).not.toBeNull();
      const bytes = readFileSync(
        join(process.cwd(), "node_modules", "katex", "dist", "fonts", `${match?.[1]}.woff2`),
      );
      // The repository's ambient Bun type declares only Bun.build; xxHash64 is Bun's own.
      const { hash: bunHash } = Bun as unknown as { hash: { xxHash64(data: Uint8Array): bigint } };
      const hash = bunHash.xxHash64(bytes).toString(16).padStart(16, "0").slice(0, 8);
      expect(hash).toBe(match?.[2] as string);
      expect(katexPreloadHref(file)).toBe(`/_next/static/media/${file}`);
    }
  });
});

/**
 * A preload is reused only when its URL is exactly the one the @font-face asks for, query string
 * included. Otherwise the browser fetches the face a second time and the lead still rewraps after
 * load. Checked against both stylesheets that declare the faces.
 */
describe("Newsreader preload URLs on /notation/", () => {
  test("each is the URL globals.css and themes.css request, ?v= included", () => {
    expect(NEWSREADER_PRELOAD_FONTS.length).toBeGreaterThan(0);
    for (const sheet of ["src/app/globals.css", "src/app/theme/themes.css"]) {
      const css = readFileSync(join(process.cwd(), sheet), "utf8");
      const requested = [...css.matchAll(/url\("(\/fonts\/newsreader\/[^"]+)"\)/g)].map(
        (m) => m[1],
      );
      expect(requested.length).toBeGreaterThan(0);
      for (const file of NEWSREADER_PRELOAD_FONTS) {
        expect(requested).toContain(siteFontPreloadHref(file));
      }
    }
  });
});
