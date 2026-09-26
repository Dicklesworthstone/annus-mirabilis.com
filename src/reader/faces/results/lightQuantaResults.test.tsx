/**
 * Light quanta's result cards (dispatch 240), held as mass-energy's are: the records against the
 * real German face, equation records, laboratory manifests and ledger (massEnergy.results.test.ts),
 * the face as its route renders it (massEnergyResultsFace.test.tsx), and the misconception
 * bindings from the ledger's side (massEnergyWrongTurns.test.tsx).
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

const PAPER = "light-quanta";
const ROOT = process.cwd();
const loaded = loadResultCards(ROOT, PAPER);
const cards = loaded?.cards ?? [];
const html = await exportMarkup(await PaperPage({ paperId: PAPER, face: "results" } as never));
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

type Ledger = { id: string; anchors: string[]; resultIds?: string[] };
const dir = join(ROOT, "content", "misconceptions", PAPER);
const ledger: Ledger[] = readdirSync(dir)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as Ledger);
const quotes = new Map(cards.map((c) => [c.id, new Set(c.printed.map((p) => p.anchor))]));
const bindings = ledger.flatMap((m) => (m.resultIds ?? []).map((r) => ({ m: m.id, r })));

/** Text as React writes it into markup, so a label with an apostrophe can be found there. */
const markup = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#x27;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** The markup of one card, from its opening tag to the next card or the end of the cards. */
function cardHtml(id: string): string {
  const start = html.indexOf(`id="result-${id}"`);
  if (start === -1) return "";
  const next = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("light quanta's result cards", () => {
  test("one card per section's result, in the paper's order, each resolving without a problem", () => {
    expect(loaded?.problems).toEqual([]);
    // Identity, not a census: the results §§ 1 to 9 state, in the paper's order.
    expect(cards.map((c) => [c.id, c.section])).toEqual([
      ["lq-classical-difficulty", "s1"],
      ["lq-planck-constants", "s2"],
      ["lq-entropy-temperature", "s3"],
      ["lq-radiation-entropy-volume", "s4"],
      ["lq-boltzmann-principle", "s5"],
      ["lq-energy-quanta", "s6"],
      ["lq-stokes-rule", "s7"],
      ["lq-photoelectric-energy", "s8"],
      ["lq-ionization", "s9"],
    ]);
  });

  test("every as-printed excerpt is the German face's own text at its anchor, β and all", () => {
    const face = loadGermanSourceFace(PAPER);
    if (!face) throw new Error("light quanta's German face did not load");
    const flat = (s: string) => s.replace(/\s+/g, " ").trim();
    const wrong: string[] = [];
    let excerpts = 0;
    for (const card of cards)
      for (const p of card.printed) {
        excerpts++;
        const block = face.blocks.find((b) => (face.anchors.anchorOf[b.id] ?? b.id) === p.anchor);
        if (!block) {
          wrong.push(`${card.id}: ${p.anchor} not on the face`);
          continue;
        }
        // A display is the block's text; sentences may be picked apart (s8-p2's 3, 6 and 8), so
        // each is checked on its own: the face's sentence at that place, in the card's text.
        const parts =
          p.kind === "display"
            ? [block.text]
            : p.ordinals.map((n) => block.sentences?.[n - 1]?.text ?? "\u0000missing");
        for (const part of parts)
          if (!flat(block.text).includes(flat(part)) || !flat(p.text).includes(flat(part)))
            wrong.push(`${card.id}: ${p.anchor} text is not the face's`);
      }
    expect(excerpts).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
    // The paper prints Wien's β, and its cards quote it (printedFormProblems, printsBeta).
    expect(cards.some((c) => c.printed.some((p) => /\\beta\b/.test(p.text)))).toBe(true);
  });

  test("the 4,3 Volt check is quoted as printed, with the inputs the paper states", () => {
    const card = cards.find((c) => c.id === "lq-photoelectric-energy");
    const printed = card?.printed.map((p) => p.text).join(" ") ?? "";
    expect(printed).toContain("4{,}3");
    expect(printed).toContain("1{,}03 \\cdot 10^{15}");
    expect(printed).toContain("4{,}866 \\cdot 10^{-11}");
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
    expect(
      checkVoice("This clearly proved it.", { context }).some((f) => f.severity === "error"),
    ).toBe(true);
  });
});

describe("light quanta's results face, as its route renders it", () => {
  test("every card is on the page, in order, quoting the German with a link to its place", () => {
    const order = cards.map((c) => html.indexOf(`id="result-${c.id}"`));
    expect(order.length).toBeGreaterThan(0);
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const wrong: string[] = [];
    for (const c of cards) {
      const card = cardHtml(c.id);
      if (!card.includes('<blockquote lang="de">')) wrong.push(`${c.id}: no German quotation`);
      // The paragraph, or the one sentence of it the card quotes: quotationAnchors.test.tsx says
      // which (dispatch 255).
      for (const p of c.printed)
        if (
          !new RegExp(`href="/papers/${PAPER}/view/german/#${p.anchor}(-s\\d+[a-z]?)?"`).test(card)
        )
          wrong.push(`${c.id}: no link to ${p.anchor}`);
    }
    expect(wrong).toEqual([]);
  });

  test("the modern layer is the compiled records, and each probe names its laboratory and preset", () => {
    const wrong: string[] = [];
    for (const c of cards) {
      const card = cardHtml(c.id);
      if (!card.includes(`data-equations="${c.equations.join(" ")}"`))
        wrong.push(`${c.id}: modern layer is not ${c.equations.join(" ")}`);
      for (const p of c.probes) {
        if (!card.includes(`href="/lab/${p.instrumentId}/"`))
          wrong.push(`${c.id}: no link to ${p.instrumentId}`);
        if (p.preset && !card.includes(`Choose the preset “${markup(p.preset.label)}”`))
          wrong.push(`${c.id}: preset ${p.preset.id} not named`);
      }
    }
    expect(wrong).toEqual([]);
    expect(html).not.toContain("data-equation-placeholder");
    expect(html).not.toContain("?preset=");
  });

  test("nothing a reader cannot use: no pending task, no typesetting error, no review wording", () => {
    expect(html).not.toMatch(/pending am-/);
    expect(html).not.toContain("katex-error");
    const cardsText = cards.map((c) => cardHtml(c.id).replace(/<[^>]+>/g, " ")).join(" ");
    expect(cardsText).not.toMatch(/\breview|not yet reviewed|machine draft/i);
  });
});

describe("light quanta's misconceptions are bound to the results they concern", () => {
  test("the ledger binds some card, so the checks below examine something", () => {
    expect(ledger.length).toBeGreaterThan(0);
    expect(bindings.length).toBeGreaterThan(0);
  });

  test("every cited paragraph a card quotes is quoted by a card the record names, and no binding points elsewhere", () => {
    const wrong: string[] = [];
    for (const m of ledger) {
      for (const anchor of m.anchors) {
        const quotedBy = cards.filter((c) => quotes.get(c.id)?.has(anchor)).map((c) => c.id);
        if (quotedBy.length > 0 && !(m.resultIds ?? []).some((r) => quotedBy.includes(r)))
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

  test("each binding is a wrong turn on its card, linked to the explanation page, and no card lists more", () => {
    const wrong: string[] = [];
    for (const { m, r } of bindings) {
      const turns = cardHtml(r).match(
        /<section[^>]*data-result-layer="wrong-turns"[\s\S]*?<\/section>/,
      )?.[0];
      if (!turns?.includes(`data-misconception-id="${m}"`)) wrong.push(`${r}: ${m} is not listed`);
      if (!turns?.includes(`href="/papers/${PAPER}/#misconception-${m}"`))
        wrong.push(`${r}: no link to ${m}`);
      if (!explanation.includes(`id="misconception-${m}"`))
        wrong.push(`the explanation page has no misconception-${m}`);
    }
    for (const c of cards) {
      const listed = [...cardHtml(c.id).matchAll(/data-misconception-id="([^"]+)"/g)].map(
        (x) => x[1],
      );
      const bound = bindings.filter((b) => b.r === c.id).map((b) => b.m);
      if (listed.length !== bound.length || listed.some((m) => !bound.includes(m ?? "")))
        wrong.push(`${c.id}: lists ${listed.join(", ")}, bound ${bound.join(", ")}`);
    }
    expect(wrong).toEqual([]);
  });
});
