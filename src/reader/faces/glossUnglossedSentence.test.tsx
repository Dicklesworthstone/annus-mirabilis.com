/**
 * A sentence the gloss face has no gloss unit for prints its German as the paper prints it, and
 * sends the reader to the same sentence on the parallel face (dispatch 207, TanElk 40187).
 *
 * Brownian motion was the first paper with a partial gloss (db0c48ed: the masthead and the
 * introduction). Its 87 unglossed sentences printed diplomaticText, where a formula is its TeX
 * source, so 36 of them showed "V^*", caret and all, to readers; and each linked to
 * /papers/<paper>/?view=parallel#<id>, the paper's landing page, which renders no face and has no
 * sentence ids. The deploy carrying db0c48ed was stopped for it.
 *
 * The partial edition here is Brownian's live edition with its gloss cut to one unit, so the face
 * stays partial however much of the paper is glossed later, and its blocks are the real ones, with
 * their real formulas.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type Inline, plainText } from "../../content/schemas/inlines.ts";
import { PaperPage } from "../PaperPage.tsx";
import { faceLinkHref } from "../paperRoutes.ts";
import { type BilingualEdition, loadBilingualEdition } from "./bilingualLoader.ts";
import { unglossedSections } from "./editionCoverage.ts";
import { GlossSentence, parallelSentenceHref } from "./GlossSentence.tsx";
import { sentenceInlines } from "./sentenceInlines.ts";

const PAPER = "brownian-motion";
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/** TeX a reader must never see: a backslash command, a superscript caret, a braced subscript. */
const TEX = /\\|\^|_\{/;

/** The visible text of a rendered fragment: KaTeX's TeX annotation removed, then every tag. */
function visibleText(html: string): string {
  return html
    .replace(/<annotation\b[\s\S]*?<\/annotation>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

type Unglossed = { id: string; germanHtml: string; href: string | undefined };

/** Each unglossed sentence of a gloss face's markup: its id, its German, its fallback href. */
function unglossedSentences(html: string): Unglossed[] {
  const out: Unglossed[] = [];
  for (const m of html.matchAll(
    /<section\b[^>]*\bgloss-sentence-missing\b[^>]*>([\s\S]*?)<\/section>/g,
  )) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1);
    const id = /\bid="([^"]+)"/.exec(open)?.[1] ?? "";
    const body = m[1] ?? "";
    const from = body.indexOf("sentence-german-unadorned");
    const to = body.indexOf("gloss-parallel-line");
    const germanHtml = from >= 0 && to > from ? body.slice(body.indexOf(">", from) + 1, to) : "";
    const href = /<a\b[^>]*\bdata-parallel-fallback="true"[^>]*>/.exec(body)?.[0];
    out.push({ id, germanHtml, href: href ? /\bhref="([^"]+)"/.exec(href)?.[1] : undefined });
  }
  return out;
}

/** A fallback href is the parallel face's own route at a sentence, never a query on the paper. */
function isParallelSentenceHref(href: string, paper: string, id: string): boolean {
  return href === `${faceLinkHref(paper, "parallel")}#${id}` && !href.includes("?view=");
}

async function partialEdition(): Promise<BilingualEdition> {
  const live = await loadBilingualEdition(PAPER);
  if (!live) throw new Error(`no edition for ${PAPER}`);
  const one = (live.glossUnits ?? []).slice(0, 1);
  // Non-vacuity, on purpose: a gloss face with no unit renders the whole-face notice instead, and
  // none of the checks below would reach an unglossed sentence.
  expect(one.length).toBe(1);
  return { ...live, glossUnits: one };
}

/** Every section's gloss page, joined: the gloss prints one section per page (dispatch 254). */
async function wholeGloss(edition: BilingualEdition): Promise<string> {
  const pages: string[] = [];
  for (const { id } of edition.paper.sections ?? [])
    pages.push(
      renderToStaticMarkup(
        await PaperPage({ paperId: PAPER, face: "gloss", section: id }, { edition }),
      ),
    );
  return pages.join("\n");
}

describe("sentenceInlines cuts a block at a sentence span's own offsets", () => {
  /** The sentence's plain text, footnote marks removed: marks become a private-use placeholder, the text is cut, the placeholders go. */
  function expectedText(inlines: readonly Inline[], span: { start: number; end: number }): string {
    const blank = (nodes: readonly Inline[]): Inline[] =>
      nodes.map((n) =>
        n.kind === "footnote-mark"
          ? { kind: "text", text: "\uE000".repeat(Array.from(plainText([n])).length) }
          : n.kind === "emphasis"
            ? { ...n, inlines: blank(n.inlines) }
            : n,
      );
    return Array.from(plainText(blank(inlines)))
      .slice(span.start, span.end)
      .join("")
      .split("\uE000")
      .join("");
  }
  /** The whole-node selection SourceBlock uses, kept here as the wrong answer this must beat. */
  function wholeNodes(inlines: readonly Inline[], span: { start: number; end: number }): Inline[] {
    const out: Inline[] = [];
    let offset = 0;
    for (const node of inlines) {
      const len = Array.from(plainText([node])).length;
      if (len > 0 && offset < span.end && offset + len > span.start) out.push(node);
      offset += len;
    }
    return out;
  }

  test("every sentence of every paper: the cut text is the sentence's own text", async () => {
    let sentences = 0;
    let sharingABlock = 0;
    let withMath = 0;
    for (const paper of PAPERS) {
      const edition = await loadBilingualEdition(paper);
      for (const block of edition?.blocks ?? []) {
        for (const s of block.sentenceSpans ?? []) {
          sentences += 1;
          if (block.sentenceSpans.length > 1) sharingABlock += 1;
          const cut = sentenceInlines(block.inlines, s.span);
          expect(plainText(cut)).toBe(expectedText(block.inlines, s.span));
          if (cut.some((n) => n.kind === "math")) withMath += 1;
        }
      }
    }
    // Non-vacuity, on purpose: sentences were cut out of blocks they share with other sentences,
    // and some carried inline formulas, the case this exists for.
    expect(sentences).toBeGreaterThan(0);
    expect(sharingABlock).toBeGreaterThan(0);
    expect(withMath).toBeGreaterThan(0);
  });

  test("a text node that runs on into the next sentence is cut, where keeping whole nodes is not", () => {
    // No block in the four papers has one today (sentenceInlines.ts), so the case is built: two
    // sentences in one text node, the first with a formula after it.
    const inlines: Inline[] = [
      { kind: "text", text: "Es sei " },
      { kind: "math", latex: "V^*" },
      { kind: "text", text: " das Volumen. Dann gilt das Gesetz." },
    ];
    const text = plainText(inlines);
    const second = { start: text.indexOf("Dann"), end: text.length };
    const first = { start: 0, end: text.indexOf(" Dann") };
    expect(plainText(sentenceInlines(inlines, second))).toBe("Dann gilt das Gesetz.");
    expect(plainText(sentenceInlines(inlines, first))).toBe("Es sei V^* das Volumen.");
    expect(sentenceInlines(inlines, first).map((n) => n.kind)).toEqual(["text", "math", "text"]);
    // The wrong answer carries the neighbour's words.
    expect(plainText(wholeNodes(inlines, second))).toBe(" das Volumen. Dann gilt das Gesetz.");
    expect(plainText(wholeNodes(inlines, first))).toContain("Dann gilt");
  });
});

describe("an unglossed sentence on a partial gloss face", () => {
  test("prints its formulas as KaTeX: no backslash, caret or braced subscript in what a reader sees", async () => {
    const html = await wholeGloss(await partialEdition());
    const unglossed = unglossedSentences(html);
    const leaking = unglossed.filter((u) => TEX.test(visibleText(u.germanHtml)));
    expect(leaking.map((u) => u.id)).toEqual([]);
    // Every unglossed sentence printed some German, and formulas reached the page as KaTeX.
    expect(unglossed.length).toBeGreaterThan(0);
    expect(
      unglossed.filter((u) => visibleText(u.germanHtml).trim() === "").map((u) => u.id),
    ).toEqual([]);
    expect(unglossed.filter((u) => u.germanHtml.includes('class="katex"')).length).toBeGreaterThan(
      0,
    );
  });

  test("the TeX check fails on the old rendering, the block's plain text", async () => {
    const edition = await partialEdition();
    const block = edition.blocks.find((b) => b.id === "s1-p1");
    const span = block?.sentenceSpans[0];
    if (!block || !span) throw new Error("s1-p1 is missing");
    const props = {
      sentenceId: span.id,
      germanText: block.diplomaticText.slice(span.span.start, span.span.end),
      paperSlug: PAPER,
      modalityClasses: [],
    };
    // Without its inlines the sentence prints its plain text, which is what the face used to do.
    const old = unglossedSentences(renderToStaticMarkup(<GlossSentence {...props} />));
    expect(old.length).toBe(1);
    expect(TEX.test(visibleText(old[0]?.germanHtml ?? ""))).toBe(true);
    const now = unglossedSentences(
      renderToStaticMarkup(
        <GlossSentence {...props} germanInlines={sentenceInlines(block.inlines, span.span)} />,
      ),
    );
    expect(TEX.test(visibleText(now[0]?.germanHtml ?? ""))).toBe(false);
  });

  test("links to the same sentence on the parallel face's own route, never to ?view=", async () => {
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: PAPER, face: "gloss" }, { edition: await partialEdition() }),
    );
    const unglossed = unglossedSentences(html);
    expect(unglossed.length).toBeGreaterThan(0);
    const wrong = unglossed.filter((u) => !isParallelSentenceHref(u.href ?? "", PAPER, u.id));
    expect(wrong.map((u) => `${u.id} ${u.href}`)).toEqual([]);
    // The check refuses the old link, and the helper agrees with the route table for every paper.
    expect(
      isParallelSentenceHref(`/papers/${PAPER}/?view=parallel#s1-p1-s1`, PAPER, "s1-p1-s1"),
    ).toBe(false);
    for (const paper of PAPERS)
      expect(parallelSentenceHref(paper, "s0-p1-s1")).toBe(
        `${faceLinkHref(paper, "parallel")}#s0-p1-s1`,
      );
  });

  test("every sentence it links to is an id on the parallel face", async () => {
    const edition = await partialEdition();
    const gloss = renderToStaticMarkup(
      await PaperPage({ paperId: PAPER, face: "gloss" }, { edition }),
    );
    const parallel = renderToStaticMarkup(
      await PaperPage({ paperId: PAPER, face: "parallel" }, { edition }),
    );
    const ids = new Set([...parallel.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const targets = unglossedSentences(gloss).map((u) => (u.href ?? "").split("#")[1] ?? "");
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((t) => !ids.has(t))).toEqual([]);
  });
});

describe("the gloss face names, once, the sections its gloss does not reach yet", () => {
  const block = (
    id: string,
    section: string | undefined,
    sentences: string[],
    kind = "paragraph",
  ) => ({ id, kind, section, sentenceSpans: sentences.map((s) => ({ id: s })) }) as never;

  test("unglossedSections: a unit reaches its sentence's section, a masthead reaches none", () => {
    const blocks = [
      // Filed under s0, as Brownian motion's frozen manifest files its masthead.
      block("masthead-title", "s0", ["masthead-title"], "masthead"),
      block("s0-p1", "s0", ["s0-p1-s1", "s0-p1-s2"]),
      block("s1-p1", "s1", ["s1-p1-s1"]),
      block("s1-fn1", "s1", ["s1-fn1"]),
      block("s2-p1", "s2", ["s2-p1-s1"]),
    ];
    const ids = ["s0", "s1", "s2"];
    expect(unglossedSections(ids, blocks, [])).toEqual(["s0", "s1", "s2"]);
    expect(unglossedSections(ids, blocks, [{ sentenceId: "masthead-title" }])).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
    expect(unglossedSections(ids, blocks, [{ sentenceId: "s0-p1-s2" }])).toEqual(["s1", "s2"]);
    // A footnote is glossed under its block id, and that id reaches its section too.
    expect(
      unglossedSections(ids, blocks, [{ sentenceId: "s0-p1-s1" }, { sentenceId: "s1-fn1" }]),
    ).toEqual(["s2"]);
    // A unit naming nothing in the paper reaches nothing.
    expect(unglossedSections(ids, blocks, [{ sentenceId: "s9-p1-s1" }])).toEqual([
      "s0",
      "s1",
      "s2",
    ]);
  });

  /** The face-level notice of a gloss face's markup: its data attribute and its text. */
  const notice = (html: string) => {
    const m = /<p class="notice" data-unglossed-sections="([^"]*)">([\s\S]*?)<\/p>/.exec(html);
    return m ? { ids: m[1] ?? "", text: visibleText(m[2] ?? "") } : null;
  };

  test("a partial gloss names the sections it lacks, and nothing else says so", async () => {
    const live = await loadBilingualEdition(PAPER);
    if (!live) throw new Error(`no edition for ${PAPER}`);
    // The masthead and the introduction are glossed (db0c48ed) and stay glossed, so this edition is
    // partial however far the gloss has gone since: the introduction reached, §§ 1-5 not.
    const intro = (live.glossUnits ?? []).filter(
      (g) => g.sentenceId.startsWith("s0-") || g.sentenceId.startsWith("masthead-"),
    );
    expect(intro.some((g) => g.sentenceId.startsWith("s0-"))).toBe(true);
    const html = renderToStaticMarkup(
      await PaperPage(
        { paperId: PAPER, face: "gloss" },
        { edition: { ...live, glossUnits: intro } },
      ),
    );
    const found = notice(html);
    // The negative TanElk asked for: a notice that names no section fails here.
    expect(found).not.toBeNull();
    expect(found?.ids).toBe("s1 s2 s3 s4 s5");
    expect(found?.text).toBe(
      "This gloss does not yet cover the whole paper. Not yet glossed: §§ 1–5.",
    );
    // Said once, not under each sentence.
    expect([...html.matchAll(/data-unglossed-sections=/g)].length).toBe(1);
    expect(html).not.toContain("Gloss not yet available");
    // § 1's own gloss page (dispatch 254): its sentences are unglossed, each with only its link.
    const s1 = renderToStaticMarkup(
      await PaperPage(
        { paperId: PAPER, face: "gloss", section: "s1" },
        { edition: { ...live, glossUnits: intro } },
      ),
    );
    expect([...s1.matchAll(/data-unglossed-sections=/g)].length).toBe(1);
    expect(s1).not.toContain("Gloss not yet available");
    const unglossed = unglossedSentences(s1);
    expect(unglossed.length).toBeGreaterThan(0);
    for (const u of unglossed) expect(u.href).toBe(parallelSentenceHref(PAPER, u.id));
    expect([...s1.matchAll(/data-parallel-fallback="true"/g)].length).toBe(unglossed.length);
  });

  test("with only the masthead glossed, the introduction is named too", async () => {
    const live = await loadBilingualEdition(PAPER);
    if (!live) throw new Error(`no edition for ${PAPER}`);
    const masthead = (live.glossUnits ?? []).filter((g) => g.sentenceId.startsWith("masthead-"));
    expect(masthead.length).toBeGreaterThan(0);
    const edition = { ...live, glossUnits: masthead };
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: PAPER, face: "gloss" }, { edition }),
    );
    expect(notice(html)?.ids).toBe("s0 s1 s2 s3 s4 s5");
    expect(notice(html)?.text).toBe(
      "This gloss does not yet cover the whole paper. Not yet glossed: the introduction and §§ 1–5.",
    );
  });

  test("a gloss that reaches every section carries no notice", async () => {
    const html = renderToStaticMarkup(await PaperPage({ paperId: "mass-energy", face: "gloss" }));
    // Mass-energy's 34 sentences are all glossed; the face is live, so the absence is not vacuous.
    expect(html).toContain('data-face="gloss"');
    expect(html).not.toContain("data-unglossed-sections");
    expect(unglossedSentences(html)).toEqual([]);
  });
});
