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
      "sr-two-postulates",
      "sr-synchronous-clocks",
      "sr-relativity-of-simultaneity",
      "sr-principles-compatible",
      "sr-transformation-equations",
      "sr-moving-rigid-body",
      "sr-moving-clock",
      "sr-velocity-addition",
      "sr-field-transformation",
      "sr-doppler-aberration",
      "sr-light-complex-energy",
      "sr-moving-mirror",
      "sr-convection-current",
      "sr-electron-masses",
      "sr-electron-kinetic-energy",
      "sr-electron-laws",
    ]);
  });

  test("a misprint is quoted as printed, and the correction stays on the card's own side", () => {
    // § 7 prints "für v = −∞, ν = ∞" (err-typo-p912-1 and -2 in docs/provenance/ap-17-891.md).
    // The quotation must be the plate's reading; only the decoder offers v = −V.
    const doppler = cards.find((c) => c.id === "sr-doppler-aberration");
    const quoted = doppler?.printed.find((p) => p.anchor === "s7-p3" && p.ordinals.includes(4));
    expect(quoted?.text).toContain("$v = -\\infty$");
    expect(quoted?.text).toContain("$\\nu = \\infty$");
    expect(quoted?.text).not.toContain("-V");
    const note = doppler?.decoder.find((d) => d.symbol.includes("-\\infty"));
    expect(note?.meaning).toContain("\\(v=-V\\)");
    expect(note?.meaning).toContain("Every face keeps the printed reading");
  });

  test("Part II's misprints are quoted as printed, and each card's decoder keeps the printed reading", () => {
    // docs/provenance/ap-17-891.md: err-typo-p915-1 (the nu''' display over (1 - v/V)^2),
    // err-typo-p916-1 (no 1/V before dL'/dtau), err-typo-p919-1 (mu beta^3 in the z row of (A))
    // and err-typo-p920-1 (no mu in the middle member of W). Each string below is the plate's
    // reading, and the corrected reading would not contain it.
    const cases = [
      {
        card: "sr-moving-mirror",
        anchor: "eq-s8-d12",
        printed: "{\\left( 1 - \\frac{v}{V} \\right)^2}",
      },
      {
        card: "sr-convection-current",
        anchor: "eq-s9-d3",
        printed: "&\\qquad \\frac{\\partial L'}{\\partial \\tau}",
      },
      {
        card: "sr-electron-masses",
        anchor: "eq-s10-d4",
        printed: "\\mu \\beta^3 \\frac{d^2 z}{d t^2}",
      },
      {
        card: "sr-electron-kinetic-energy",
        anchor: "eq-s10-d8",
        printed: "= \\int_0^v \\beta^3 v d v",
      },
    ];
    const wrong: string[] = [];
    for (const k of cases) {
      const card = cards.find((c) => c.id === k.card);
      const quoted = card?.printed.find((p) => p.anchor === k.anchor);
      if (!quoted?.text.includes(k.printed))
        wrong.push(`${k.card}: ${k.anchor} is not quoted as printed`);
      if (!card?.decoder.some((d) => /every face keeps the printed/i.test(d.meaning)))
        wrong.push(`${k.card}: no decoder note keeps the printed reading`);
    }
    expect(wrong).toEqual([]);
    // § 10's printed beta^3 stays on the quoted side; the modern side is the paper's own gamma^2.
    expect(cards.find((c) => c.id === "sr-electron-masses")?.equations).toContain(
      "eq-model-sr-transverse-mass-printed",
    );
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
    // The introduction quotes s0-p2: the light medium and the ether it calls superfluous.
    expect(wrongTurns["sr-two-postulates"]).toContain("misc-sr-michelson-motive");
    expect(wrongTurns["sr-two-postulates"]).toContain("misc-sr-ether-refuted");
    expect(wrongTurns["sr-synchronous-clocks"]).toContain("misc-sr-train-lightning");
    expect(wrongTurns["sr-relativity-of-simultaneity"]).toContain("misc-sr-train-lightning");
    expect(wrongTurns["sr-transformation-equations"]).toContain("misc-sr-beta-is-v-over-c");
    expect(wrongTurns["sr-moving-rigid-body"]).toContain("misc-sr-contraction-camera");
    expect(wrongTurns["sr-moving-clock"]).toContain("misc-sr-moving-clock-only");
    // § 9 quotes s9-p2, where Lorentz's equations are shown to conform to the principle.
    expect(wrongTurns["sr-convection-current"]).toContain("misc-sr-ether-refuted");
    // § 10 quotes s10-p10 and s10-p11, the kinetic energy, which is not E = mc².
    expect(wrongTurns["sr-electron-kinetic-energy"]).toContain("misc-sr-emc2-in-paper");
  });
});
