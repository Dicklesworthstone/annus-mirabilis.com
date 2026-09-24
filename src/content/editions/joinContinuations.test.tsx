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
import { parseYaml } from "../provenance/yaml.ts";
import { blockStartPages } from "./blockPages.ts";
import { loadGermanSourceFace } from "./germanSourceFace.ts";
import { CONTINUES, JOINED, type JoinedBlock, joinPageContinuations } from "./joinContinuations.ts";
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
    expect(s3p2?.text).toMatch(/und \$\\nu\$\[\[JOINED\]\] bedeutet\. Es kann/);
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
          `Eins zwei${JOINED} drei vier.${CONTINUES}`,
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

describe("each printed paragraph is one paragraph on the German face", () => {
  /*
    Checked against the plate-read manifests' paragraph starts, page by page (each manifest
    paragraph's first locator), and against the plates themselves: mass-energy pp. 639-641, 12
    paragraphs; light quanta pp. 135, 136, 137, 139, 142, 146; Brownian motion pp. 554, 557, 559.
  */
  for (const paper of ["light-quanta", "brownian-motion", "mass-energy"] as const) {
    test(`${paper}: the face starts a paragraph on each page where the print does`, () => {
      const face = loadGermanSourceFace(paper);
      expect(face).not.toBeNull();
      const units = (
        parseYaml(
          readFileSync(
            join(process.cwd(), "content/source-blocks", paper, "manifest.yaml"),
            "utf8",
          ),
        ) as { units: { kind: string; locators?: { page?: number }[] }[] }
      ).units;
      const printed = new Map<number, number>();
      for (const u of units)
        if (u.kind === "paragraph") {
          const page = u.locators?.[0]?.page ?? -1;
          printed.set(page, (printed.get(page) ?? 0) + 1);
        }
      const onFace = new Map<number, number>();
      for (const b of face?.blocks ?? [])
        if (b.kind === "paragraph") {
          const page = face?.printedPages.pages[b.id] ?? -1;
          onFace.set(page, (onFace.get(page) ?? 0) + 1);
        }
      expect(printed.size).toBeGreaterThan(1);
      expect([...onFace].sort()).toEqual([...printed].sort());
    });
  }

  test("the plates' continuations are joined and their indented paragraphs are not", () => {
    const lq = loadGermanSourceFace("light-quanta");
    const bm = loadGermanSourceFace("brownian-motion");
    const starts = (face: typeof lq) =>
      (face?.blocks ?? []).filter((b) => b.kind === "paragraph").map((b) => b.text.trimStart());
    const lqStarts = starts(lq);
    const bmStarts = starts(bm);
    // Flush left on the plate, so inside a paragraph (pp. 136, 137, 139, 143; 554, 557, 559).
    for (const words of ["Diese als Bedingung", "Man erkennt, daß diese", "Es sei nun eine"])
      expect(lqStarts.some((t) => t.startsWith(words))).toBe(false);
    expect(lqStarts.some((t) => t.startsWith("und vergleicht man"))).toBe(false);
    for (const words of ["Es werde angenommen", "Nun können wir aber", "Durch Eliminieren von"])
      expect(bmStarts.some((t) => t.startsWith(words))).toBe(false);
    // Indented on the plate, so each still opens a paragraph (pp. 139, 142, 146; 554, 559).
    for (const words of ["Diese Gleichung zeigt", "Es ist bemerkenswert", "Setzt man $E"])
      expect(lqStarts.some((t) => t.startsWith(words))).toBe(true);
    for (const words of ["Die Gleichung (1) benutzen", "Wir wollen berechnen"])
      expect(bmStarts.some((t) => t.startsWith(words))).toBe(true);
  });

  test("a footnote keeps its own displays and words (light quanta p. 135)", () => {
    const lq = loadGermanSourceFace("light-quanta");
    const note = lq?.blocks.find(
      (b) => b.kind === "footnote" && b.text.startsWith("Diese Voraussetzung läßt sich"),
    );
    expect(note?.text).toContain("wobei $A_\\nu \\geq 0$");
    expect(note?.displayEquationIds?.length).toBe(3);
    const body = (lq?.blocks ?? []).filter((b) => b.kind === "paragraph");
    expect(body.some((b) => b.text.includes("wobei $A_\\nu \\geq 0$"))).toBe(false);
    // The retired paragraph id stays an anchor, in the footnote.
    expect(note?.joinedIds?.length).toBe(1);
  });

  test("no display is printed twice and every id stays unique", () => {
    for (const paper of ["light-quanta", "brownian-motion", "mass-energy"] as const) {
      const face = loadGermanSourceFace(paper);
      const claimed = (face?.blocks ?? []).flatMap((b) => b.displayEquationIds ?? []);
      expect(new Set(claimed).size).toBe(claimed.length);
      const ids = (face?.blocks ?? []).flatMap((b) => [b.id, ...(b.joinedIds ?? [])]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
