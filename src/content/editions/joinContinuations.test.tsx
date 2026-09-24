/**
 * A paragraph the page broke is one paragraph on the German face, and no id moves
 * (joinContinuations.ts). Run on the real ledgers the face renders, and on small ledgers that
 * isolate each rule.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { renderSourceMarkup } from "../../reader/faces/sourceMarkup.tsx";
import { blockStartPages } from "./blockPages.ts";
import { CONTINUES, type JoinedBlock, joinPageContinuations } from "./joinContinuations.ts";
import { type ProposedBlock, segmentLedger } from "./segmentLedger.ts";

const LEDGERS = {
  "light-quanta": "ap-17-132",
  "brownian-motion": "ap-17-549",
  "mass-energy": "ap-18-639",
  "special-relativity": "ap-17-891",
} as const;

function ledger(key: string): string {
  return readFileSync(
    join(process.cwd(), "public/papers/transcripts", `${key}-machine-draft.txt`),
    "utf8",
  );
}

function segment(text: string): readonly ProposedBlock[] {
  // An absent ledger gives no blocks, and every assertion below then fails on the empty list.
  const result = segmentLedger({ ledgerText: text });
  return result.status === "proposed" ? result.blocks : [];
}

const joinedIds = (blocks: readonly JoinedBlock[]) => blocks.flatMap((b) => b.joinedIds ?? []);

describe("on the real ledgers", () => {
  for (const [paper, key] of Object.entries(LEDGERS)) {
    test(`${paper}: survivors keep their ids and pages, and each retired id keeps its page`, () => {
      const text = ledger(key);
      const before = segment(text);
      const after = joinPageContinuations(before);
      const retired = joinedIds(after);
      // Every block after the join is a block from before, in the same order: nothing renumbered.
      const survivors = after.map((b) => b.id);
      expect(before.map((b) => b.id).filter((id) => !retired.includes(id))).toEqual(survivors);
      // Each retired id was a paragraph, is listed once, and its words are in the joined text.
      expect(new Set(retired).size).toBe(retired.length);
      for (const block of after)
        for (const id of block.joinedIds ?? []) {
          const old = before.find((b) => b.id === id);
          expect(old?.kind).toBe("paragraph");
          expect(block.text).toContain(old?.text ?? "never");
        }
      // The plate turns where it did: a survivor's page, and a retired id's page, are unchanged.
      // One exception, and a correction: a display equation printed inside a continuation used to
      // take the page of the paragraph above it, because the segmenter emits a paragraph's
      // equations just before it. It now takes the continuation's page, the page it is printed on.
      // (The face renders such an equation inside its paragraph, with no page of its own.)
      const pagesBefore = blockStartPages(text, before).pages;
      const pagesAfter = blockStartPages(text, after).pages;
      const printedWith = new Map<string, string>();
      for (const id of retired)
        for (const eq of before.find((b) => b.id === id)?.displayEquationIds ?? [])
          printedWith.set(eq, id);
      for (const id of [...survivors, ...retired]) {
        const continuation = printedWith.get(id);
        expect(pagesAfter[id]).toBe(pagesBefore[continuation ?? id]);
      }
      // Joining again changes nothing.
      expect(joinPageContinuations(after)).toEqual(after);
    });
  }

  test("the page breaks the reader met mid-sentence are joined", () => {
    const counts = Object.fromEntries(
      Object.entries(LEDGERS).map(([paper, key]) => [
        paper,
        joinedIds(joinPageContinuations(segment(ledger(key)))).length,
      ]),
    );
    // Reported, not frozen: the ledgers are drafts and gain pages. Every paper with a page-broken
    // paragraph joins at least one, and light quanta's §3 example is among them.
    expect(counts["light-quanta"]).toBeGreaterThan(0);
    expect(counts["brownian-motion"]).toBeGreaterThan(0);
    const lq = joinPageContinuations(segment(ledger("ap-17-132")));
    const s3p2 = lq.find((b) => b.id === "s3-p2");
    expect(s3p2?.joinedIds).toContain("s3-p3");
    expect(s3p2?.text).toMatch(/und \$\\nu\$\[\[CONTINUES\]\] bedeutet\. Es kann/);
    expect(lq.some((b) => b.kind === "paragraph" && b.text.startsWith("bedeutet."))).toBe(false);
  });
});

const PAGE = (n: number) =>
  `\n--- MACHINE DRAFT TRANSCRIPTION PAGE ${n} OF 3 ---\n[[ANNALEN-PAGE ${100 + n}]]\n`;

describe("the rules, on small ledgers", () => {
  test("a footnote between the halves does not stop the join, and the next paragraph keeps p3", () => {
    const blocks = joinPageContinuations(
      segment(
        `${PAGE(1)}[[HEADING s1]]§ 1. Titel\n\nErster Satz und noch${CONTINUES}\n\n[[FN 1)]] Eine Fußnote.\n${PAGE(2)}mehr Worte. Zweiter Satz.\n\nDritter Absatz.\n`,
      ),
    );
    const paragraphs = blocks.filter((b) => b.kind === "paragraph");
    expect(paragraphs.map((b) => b.id)).toEqual(["s1-p1", "s1-p3"]);
    expect(paragraphs[0]?.joinedIds).toEqual(["s1-p2"]);
    expect(paragraphs[0]?.sentences.map((s) => s.id)).toEqual(["s1-p1-s1", "s1-p1-s2"]);
    expect(blocks.some((b) => b.kind === "footnote")).toBe(true);
  });

  test("a paragraph over three pages joins twice, in order", () => {
    const blocks = joinPageContinuations(
      segment(
        `${PAGE(1)}Eins zwei${CONTINUES}\n${PAGE(2)}drei vier${CONTINUES}\n${PAGE(3)}fünf und sechs.\n`,
      ),
    );
    expect(blocks.map((b) => b.id)).toEqual(["s0-p1"]);
    expect(blocks[0]?.joinedIds).toEqual(["s0-p2", "s0-p3"]);
    const pages = blockStartPages(
      `${PAGE(1)}Eins zwei${CONTINUES}\n${PAGE(2)}drei vier${CONTINUES}\n${PAGE(3)}fünf und sechs.\n`,
      blocks,
    ).pages;
    expect([pages["s0-p1"], pages["s0-p2"], pages["s0-p3"]]).toEqual([101, 102, 103]);
  });

  test("a heading or a standalone equation between the halves leaves them apart", () => {
    const heading = joinPageContinuations(
      segment(`${PAGE(1)}Eins zwei${CONTINUES}\n${PAGE(2)}[[HEADING s1]]§ 1. Titel\n\ndrei.\n`),
    );
    expect(joinedIds(heading)).toEqual([]);
    const equation = joinPageContinuations(
      segment(`${PAGE(1)}Eins zwei${CONTINUES}\n${PAGE(2)}$$\nx = y\n$$\n\nwobei $x$ klein ist.\n`),
    );
    expect(joinedIds(equation)).toEqual([]);
    expect(equation.filter((b) => b.kind === "paragraph").length).toBe(2);
  });

  test("the continuation's own display equations come with it, in printed order", () => {
    const blocks = joinPageContinuations(
      segment(
        `${PAGE(1)}Es sei $$ a = b $$ und${CONTINUES}\n${PAGE(2)}ferner $$ c = d $$ gesetzt.\n`,
      ),
    );
    const paragraph = blocks.find((b) => b.kind === "paragraph");
    expect(paragraph?.joinedIds).toEqual(["s0-p2"]);
    expect(paragraph?.displayEquationIds).toEqual(["s0-eq1", "s0-eq2"]);
  });
});

describe("the face renders a join", () => {
  test("as an anchor with the retired id and its page, between the words either side", () => {
    const html = renderToStaticMarkup(
      <p>
        {renderSourceMarkup(
          `Eins zwei${CONTINUES} drei vier.${CONTINUES}`,
          "s0-p1",
          [],
          [{ id: "s0-p2", page: 102 }],
        )}
      </p>,
    );
    expect(html).toBe(
      '<p>Eins zwei<span id="s0-p2" data-page-join="" data-printed-page="102"></span> drei vier.</p>',
    );
  });

  test("with no joins, every marker is dropped as before", () => {
    const html = renderToStaticMarkup(<p>{renderSourceMarkup(`Eins zwei${CONTINUES}`, "x")}</p>);
    expect(html).toBe("<p>Eins zwei</p>");
  });
});
