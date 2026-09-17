import assert from "node:assert/strict";
import test from "node:test";
import { inlineKatexFonts } from "./assets.ts";

const font = Buffer.from("wOF2synthetic-unit-test-font");
const css =
  '@font-face{font-family:KaTeX_Main;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),url(fonts/KaTeX_Main-Regular.woff) format("woff");font-weight:400}.katex{font-family:KaTeX_Main}';
test("replaces all font alternatives with embedded WOFF2 bytes", async () => {
  const paths = [];
  const output = await inlineKatexFonts(css, async (path) => {
    paths.push(path);
    return font;
  });
  assert.deepEqual(paths, ["fonts/KaTeX_Main-Regular.woff2"]);
  assert.ok(output.includes(`data:font/woff2;base64,${font.toString("base64")}`));
  assert.ok(!output.includes("url(fonts"));
});
test("no font rule, external font, and traversal path are refused", async () => {
  for (const input of [
    ".text{}",
    "@font-face{src:url(https://bad.test/a.woff2)}",
    "@font-face{src:url(fonts/../a.woff2)}",
  ])
    await assert.rejects(inlineKatexFonts(input, async () => font));
});
test("wrong binary format and oversized font fail instead of falling back to remote files", async () => {
  for (const bytes of [Buffer.from("ttf?"), Buffer.alloc(300_000)])
    await assert.rejects(
      inlineKatexFonts(css, async () => bytes),
      /Invalid or oversized/,
    );
});
test("missing font files abort generation", async () => {
  await assert.rejects(
    inlineKatexFonts(css, async () => {
      throw new Error("missing font");
    }),
    /missing font/,
  );
});
