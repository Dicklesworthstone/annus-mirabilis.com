/**
 * A printed line break between two sentences of one block renders as a break (dispatch 192).
 *
 * § 1 of special relativity folds its numbered relations "1." and "2." into the paragraph that
 * introduces them (s1-p8), and the source block keeps the printed lines as line-break inlines
 * between the sentences. The faces joined every sentence with a space, so the relations ran on
 * inline ("gelten: 1. Wenn ..."). Light quanta's s7-p3 has the same shape on p. 145.
 *
 * Asserted both ways: a line-break separator is a <br>, and a space separator stays a space. And
 * live: the German and parallel faces of special relativity carry exactly as many breaks as its
 * blocks' plain texts hold "\n" between sentences, and more than none.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { plainText } from "../../content/schemas/inlines.ts";
import {
  type SourceBlock as SourceBlockData,
  validateSourceBlock,
} from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { PaperPage } from "../PaperPage.tsx";
import { SourceBlock } from "./SourceBlock.tsx";

const sentences = ["Es gelten die Beziehungen:", "1. Wenn A, so B.", "2. Wenn B, so C."];
const inlines: SourceBlockData["inlines"] = [
  { kind: "text", text: sentences[0] as string },
  { kind: "line-break" },
  { kind: "text", text: sentences[1] as string },
  { kind: "space" },
  { kind: "text", text: sentences[2] as string },
];
const text = plainText(inlines);
let at = 0;
const BLOCK = validateSourceBlock({
  id: "t-p1",
  kind: "paragraph",
  paper: "special-relativity",
  section: "s1",
  order: 1,
  locators: [{ pdfPageIndex: 4, printedPage: 894 }],
  diplomaticText: text,
  inlines,
  sentenceSpans: sentences.map((s, k) => {
    const start = at;
    at += [...s].length + 1;
    return {
      id: `t-p1-s${k + 1}`,
      span: {
        start,
        end: start + [...s].length,
        blockRevision: 1,
        textDigest: spanTextDigest(text),
      },
    };
  }),
  revision: 1,
  status: {
    transcription: "draft",
    mathTranscription: "not-applicable",
    translation: "draft",
    review: "draft",
  },
  lang: "de",
});

describe("a printed line break between sentences", () => {
  test("renders as a break, and a space separator stays a space", () => {
    const html = renderToStaticMarkup(<SourceBlock block={BLOCK} paperSlug="special-relativity" />);
    expect(html.match(/<br data-printed-line-break="[^"]*"\/?>/g)).toEqual([
      '<br data-printed-line-break="t-p1-s1"/>',
    ]);
    // The first sentence ends without the joining space; the second keeps it before the third.
    expect(html).not.toContain("Beziehungen: <button");
    expect(html).toContain("so B. <button");
  });

  test("live: special relativity's faces carry exactly the breaks its blocks hold", async () => {
    const dir = join(process.cwd(), "content", "source-blocks", "special-relativity");
    let expected = 0;
    for (const f of readdirSync(dir).filter(
      (x) => /\.yaml$/.test(x) && !/^(manifest|ledger)/.test(x),
    )) {
      const block = parseYaml(readFileSync(join(dir, f), "utf8")) as SourceBlockData;
      if (block.kind !== "paragraph") continue;
      const chars = [...plainText(block.inlines)];
      for (const sp of block.sentenceSpans ?? []) if (chars[sp.span.end] === "\n") expected++;
    }
    expect(expected).toBeGreaterThan(0);
    for (const face of ["german", "parallel"]) {
      const html = renderToStaticMarkup(
        await PaperPage({ paperId: "special-relativity", face } as never),
      );
      expect(html.match(/<br data-printed-line-break=/g)?.length ?? 0).toBe(expected);
    }
  });
});
