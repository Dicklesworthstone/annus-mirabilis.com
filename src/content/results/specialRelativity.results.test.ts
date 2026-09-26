/**
 * Relativity's result cards (dispatch 241), against the real German face (read from the paper's
 * source blocks, as the German face is), equation records, laboratory manifests and misconception
 * ledger, in the form of massEnergy.results.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { resolveVoiceContext } from "../checks/voice/contexts.ts";
import { checkVoice } from "../checks/voice/index.ts";
import { loadResultCards, resultContext } from "./resultCards.ts";

const ROOT = process.cwd();
const PAPER = "special-relativity";
const loaded = loadResultCards(ROOT, PAPER);
const cards = loaded?.cards ?? [];

describe("relativity's result cards", () => {
  test("the paper's results, in the paper's order, each resolving without a problem", () => {
    expect(loaded?.problems).toEqual([]);
    // Identity, not a census: these are the results the cards cover so far, in the paper's order.
    expect(cards.map((c) => c.id)).toEqual([
      "sr-relativity-of-simultaneity",
      "sr-principles-compatible",
      "sr-transformation-equations",
      "sr-moving-rigid-body",
      "sr-moving-clock",
    ]);
  });

  test("every as-printed excerpt is the German face's own text at its anchor", () => {
    const face = resultContext(ROOT, PAPER)?.face;
    if (!face) throw new Error("relativity's German face did not load");
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
        if (p.page === undefined) wrong.push(`${card.id}: ${p.anchor} has no printed page`);
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

  test("the misconceptions that quote a card's paragraphs are its wrong turns", () => {
    const wrongTurns = Object.fromEntries(cards.map((c) => [c.id, c.misconceptionIds]));
    expect(wrongTurns["sr-relativity-of-simultaneity"]).toContain("misc-sr-train-lightning");
    expect(wrongTurns["sr-transformation-equations"]).toContain("misc-sr-beta-is-v-over-c");
    expect(wrongTurns["sr-moving-rigid-body"]).toContain("misc-sr-contraction-camera");
    expect(wrongTurns["sr-moving-clock"]).toContain("misc-sr-moving-clock-only");
  });
});
