/**
 * Brownian motion's result cards (dispatch 239): the records against the real German face, and the
 * results face as a reader gets it without JavaScript, /papers/brownian-motion/view/results/. The
 * checks are mass-energy's (massEnergy.results.test.ts, massEnergyResultsFace.test.tsx and
 * massEnergyWrongTurns.test.tsx), applied to this paper's records; a census of cards is reported,
 * never asserted, because the cards arrive a few at a time.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveVoiceContext } from "../../../content/checks/voice/contexts.ts";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import { loadGermanSourceFace } from "../../../content/editions/germanSourceFace.ts";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";

const PAPER = "brownian-motion";
const ROOT = process.cwd();
const loaded = loadResultCards(ROOT, PAPER);
const cards = loaded?.cards ?? [];
const face = loadGermanSourceFace(PAPER);
// The results face as its route renders it (src/app/papers/[paper]/view/[face]/page.tsx).
const html = await exportMarkup(await PaperPage({ paperId: PAPER, face: "results" } as never));
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

type Ledger = { id: string; anchors: string[]; resultIds?: string[] };
const dir = join(ROOT, "content", "misconceptions", PAPER);
const ledger: Ledger[] = readdirSync(dir)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as Ledger);
const bindings = ledger.flatMap((m) => (m.resultIds ?? []).map((r) => ({ m: m.id, r })));
const quotes = new Map(cards.map((c) => [c.id, new Set(c.printed.map((p) => p.anchor))]));

/** Text as React escapes it in markup: a manifest label may hold an apostrophe (Exner's). */
function escaped(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** The markup of one card, from its opening tag to the next card or the end of the cards. */
function cardHtml(id: string): string {
  const start = html.indexOf(`id="result-${id}"`);
  if (start === -1) return "";
  const next = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("Brownian motion's result cards, as records", () => {
  test("every card resolves without a problem, and there is at least one", () => {
    expect(loaded?.problems).toEqual([]);
    console.log(`[brownian result cards] ${cards.length}`);
    expect(cards.length).toBeGreaterThan(0);
  });

  test("the cards follow the paper: each card's first quotation stands no earlier than the previous card's", () => {
    if (!face) throw new Error("Brownian motion's German face did not load");
    const position = (anchor: string) =>
      face.blocks.findIndex((b) => (face.anchors.anchorOf[b.id] ?? b.id) === anchor);
    const firsts = cards.map((c) => position(c.printed[0]?.anchor ?? ""));
    expect(firsts.every((i) => i > -1)).toBe(true);
    expect([...firsts].sort((a, b) => a - b)).toEqual(firsts);
  });

  test("every as-printed excerpt is the German face's own text at its anchor", () => {
    if (!face) throw new Error("Brownian motion's German face did not load");
    const flat = (s: string) => s.replace(/\s+/g, " ").trim();
    let excerpts = 0;
    const wrong: string[] = [];
    for (const card of cards)
      for (const p of card.printed) {
        excerpts++;
        const block = face.blocks.find((b) => (face.anchors.anchorOf[b.id] ?? b.id) === p.anchor);
        if (!block) wrong.push(`${card.id}: ${p.anchor} not on the face`);
        else if (!flat(block.text).includes(flat(p.text)))
          wrong.push(`${card.id}: ${p.anchor} text is not the face's`);
      }
    expect(excerpts).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  test("the authored text passes the voice lint, and the lint sees a planted error", () => {
    const authored = cards.flatMap((c) => [
      c.title,
      c.oneSentence,
      c.selectionReason,
      ...Object.values(c.meanings),
      ...c.decoder.flatMap((d) => [d.symbol, d.meaning]),
      ...c.qualifications.map((q) => q.text),
      ...c.probes.map((p) => p.question),
    ]);
    expect(authored.length).toBeGreaterThan(0);
    const context = resolveVoiceContext("argument", "readings.full[0].text");
    const errors = authored.flatMap((t) =>
      checkVoice(t, { context }).filter((f) => f.severity === "error"),
    );
    expect(errors.map((e) => `${e.rule}: ${e.matchedText}`)).toEqual([]);
    const planted = checkVoice("This clearly proved it.", { context });
    expect(planted.some((f) => f.severity === "error")).toBe(true);
  });
});

describe("Brownian motion's results face, static", () => {
  test("every card record is on the page, in the records' order", () => {
    const order = cards.map((r) => html.indexOf(`id="result-${r.id}"`));
    expect(order.length).toBeGreaterThan(0);
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("each card quotes Einstein in German, and each quotation links to where it stands on the German face", () => {
    const wrong: string[] = [];
    for (const r of cards) {
      const card = cardHtml(r.id);
      if (!card.includes('<blockquote lang="de">')) wrong.push(`${r.id}: no German quotation`);
      for (const p of r.printed) {
        if (!card.includes(`data-printed-anchor="${p.anchor}"`))
          wrong.push(`${r.id}: ${p.anchor} not quoted`);
        // The paragraph, or the one sentence of it the card quotes: quotationAnchors.test.tsx says
        // which (dispatch 255).
        if (
          !new RegExp(`href="/papers/${PAPER}/view/german/#${p.anchor}(-s\\d+[a-z]?)?"`).test(card)
        )
          wrong.push(`${r.id}: no link to ${p.anchor}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("the modern layer is the compiled records, never a placeholder", () => {
    const withModern = cards.filter((x) => x.equations.length > 0);
    expect(withModern.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const r of withModern)
      if (!cardHtml(r.id).includes(`data-equations="${r.equations.join(" ")}"`))
        wrong.push(`${r.id}: modern layer is not ${r.equations.join(" ")}`);
    expect(wrong).toEqual([]);
    expect(html).not.toContain("data-equation-placeholder");
  });

  test("each probe links its laboratory and names the manifest's preset, with no preset in the URL", () => {
    const probes = cards.flatMap((r) => r.probes.map((p) => ({ id: r.id, ...p })));
    expect(probes.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const p of probes) {
      const card = cardHtml(p.id);
      if (!card.includes(`href="/lab/${p.instrumentId}/"`))
        wrong.push(`${p.id}: no link to ${p.instrumentId}`);
      if (p.preset && !card.includes(`Choose the preset “${escaped(p.preset.label)}”`))
        wrong.push(`${p.id}: preset ${p.preset.id} not named`);
    }
    expect(wrong).toEqual([]);
    expect(html).not.toContain("?preset=");
  });

  test("nothing a reader cannot use: no pending task, no typesetting error, and the outline stays below", async () => {
    expect(html).not.toMatch(/pending am-/);
    expect(html).not.toContain("katex-error");
    for (const c of cards) expect(html).toContain(`id="${c.arguments[0]}"`);
  });
});

describe("Brownian motion's misconceptions are bound to the results they concern", () => {
  // The rule mass-energy's ledger follows (massEnergyWrongTurns.test.tsx): a record binds exactly
  // the cards that quote a paragraph it cites. A paragraph no card quotes asks for nothing.
  test("every cited paragraph a card quotes is quoted by a card the misconception names, and no binding points elsewhere", () => {
    expect(ledger.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const m of ledger) {
      for (const anchor of m.anchors) {
        const quotedBy = cards.filter((c) => quotes.get(c.id)?.has(anchor)).map((c) => c.id);
        if (quotedBy.length === 0) continue;
        if (!(m.resultIds ?? []).some((r) => quotedBy.includes(r)))
          wrong.push(`${m.id} cites ${anchor}, quoted by ${quotedBy.join(", ")}, and names none`);
      }
      for (const r of m.resultIds ?? []) {
        const q = quotes.get(r);
        if (!q) wrong.push(`${m.id} names ${r}, which is no card`);
        else if (!m.anchors.some((a) => q.has(a)))
          wrong.push(`${m.id} names ${r}, which quotes none of ${m.anchors.join(", ")}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("every binding is a wrong turn on its card, linked to the callout on the explanation page", () => {
    console.log(`[brownian wrong turns on cards] ${bindings.length}`);
    expect(bindings.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const { m, r } of bindings) {
      const turns = cardHtml(r).match(
        /<section[^>]*data-result-layer="wrong-turns"[\s\S]*?<\/section>/,
      )?.[0];
      if (!turns) wrong.push(`${r}: no wrong-turns section, though ${m} names it`);
      else {
        if (!turns.includes(`data-misconception-id="${m}"`)) wrong.push(`${r}: ${m} is not listed`);
        if (!turns.includes(`href="/papers/${PAPER}/#misconception-${m}"`))
          wrong.push(`${r}: no link to ${m}`);
      }
      if (!explanation.includes(`id="misconception-${m}"`))
        wrong.push(`the explanation page has no misconception-${m}`);
    }
    expect(wrong).toEqual([]);
  });
});
