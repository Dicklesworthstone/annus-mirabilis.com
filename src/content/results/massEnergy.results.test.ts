/**
 * Mass-energy's result cards (am-me-results-cards-c6mf), against the real German face, equation
 * records, laboratory manifests and scenarios; and each refusal of checkResultCards on a copy of
 * the real file with one thing broken.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  PRINTED_FACTOR_WORDING,
  printedMassConversion,
} from "../../physics/reference/massEnergy.ts";
import { resolveVoiceContext } from "../checks/voice/contexts.ts";
import { checkVoice } from "../checks/voice/index.ts";
import { loadGermanSourceFace } from "../editions/germanSourceFace.ts";
import { parseYaml } from "../provenance/yaml.ts";
import {
  checkResultCards,
  EMPTY_REGISTRIES,
  loadResultCards,
  presetIdProblems,
  printedFormProblems,
  resultContext,
} from "./resultCards.ts";

const ROOT = process.cwd();
const PAPER = "mass-energy";
const loaded = loadResultCards(ROOT, PAPER);
const cards = loaded?.cards ?? [];
const raw = parseYaml(readFileSync(join(ROOT, "content", "results", `${PAPER}.yaml`), "utf8"));
const context = resultContext(ROOT, PAPER);

describe("mass-energy's result cards", () => {
  test("the paper's results, in the paper's order, each resolving without a problem", () => {
    expect(loaded?.problems).toEqual([]);
    // Identity, not a census: these are the results the paper prints, in its order.
    expect(cards.map((c) => c.id)).toEqual([
      "me-light-energy-transformation",
      "me-symmetric-emission",
      "me-two-balances",
      "me-kinetic-energy-drop",
      "me-low-speed-approximation",
      "me-mass-decrease",
      "me-closing-remarks",
    ]);
  });

  test("every as-printed excerpt is the German face's own text at its anchor", () => {
    const face = loadGermanSourceFace(PAPER);
    if (!face) throw new Error("mass-energy's German face did not load");
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

  test("the conversion card names the scenario whose owner gives both numbers and the wording", () => {
    const card = cards.find((c) => c.printedCheck !== undefined);
    expect(card?.id).toBe("me-mass-decrease");
    expect(card?.printedCheck).toBe(MASS_ENERGY_PRINTED_FACTOR_SCENARIO);
    // 9·10^20 erg, the energy for which the paper's conversion gives one gram.
    const r = printedMassConversion({ emittedEnergyErg: 9e20 });
    expect(r.status).toBe("value");
    expect(r.printed.value).toBe(1);
    expect(r.printed.constantSetId).toBe("einstein-1905-mass-energy-printed");
    expect(r.modern.value).toBeCloseTo(1.0013851, 7);
    expect(r.modern.constantSetId).toBe("modern-si-2019");
    expect(r.comparison.wording).toBe(PRINTED_FACTOR_WORDING);
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
    // The context an argument's prose gets from the lint, since these are explanatory prose too.
    const context = resolveVoiceContext("argument", "readings.full[0].text");
    const errors = authored.flatMap((t) =>
      checkVoice(t, { context }).filter((f) => f.severity === "error"),
    );
    expect(errors.map((e) => `${e.rule}: ${e.matchedText}`)).toEqual([]);
    const planted = checkVoice("This clearly proved it.", { context });
    expect(planted.some((f) => f.severity === "error")).toBe(true);
  });
});

describe("what an as-printed layer and a preset id may be", () => {
  test("β and an ellipsis are restatements, never printed text", () => {
    expect(printedFormProblems("K_0 - K_1 = \\frac{L}{V^2} \\frac{v^2}{2}.")).toEqual([]);
    expect(printedFormProblems("\\gamma = 1/\\sqrt{1-\\beta^2}")).toHaveLength(1);
    expect(printedFormProblems("L(\\gamma - 1) = \\tfrac12 L\\beta^2 + \\ldots")).toHaveLength(2);
    expect(printedFormProblems("und so weiter …")).toHaveLength(1);
  });

  test("a preset is <instrumentId>-<slug>, with a dot only between digits", () => {
    expect(presetIdProblems("me-02", "me-02-0.6c")).toEqual([]);
    expect(presetIdProblems("me-01", "me-01:pulses-at-0.6c")).toHaveLength(1);
    expect(presetIdProblems("me-01", "me-03-card-radium")).toHaveLength(1);
    expect(presetIdProblems("me-01", "me-01-a.b")).toHaveLength(1);
  });
});

describe("each gap is refused by name", () => {
  if (!context) throw new Error("mass-energy has no result context");
  const broken = (edit: (card: Record<string, unknown>) => void, registries = EMPTY_REGISTRIES) => {
    const copy = structuredClone(raw) as { cards: Record<string, unknown>[] };
    const first = copy.cards[0];
    if (!first) throw new Error("no card to break");
    edit(first);
    return checkResultCards(copy, { ...context, registries }).problems;
  };

  test("the unbroken copy has no problem, so each refusal below is the edit's", () => {
    expect(checkResultCards(raw, context).problems).toEqual([]);
  });

  const cases: [string, (c: Record<string, unknown>) => void, RegExp][] = [
    [
      "an anchor the face does not have",
      (c) => ((c.printed as object[])[0] = { anchor: "s0-p99", sentences: [1] }),
      /s0-p99, which the German face does not have/,
    ],
    [
      "a sentence the block does not have",
      (c) => ((c.printed as object[])[0] = { anchor: "s0-p4", sentences: [7] }),
      /has 1 sentences, not 7/,
    ],
    [
      "a paragraph cited without its sentences",
      (c) => ((c.printed as object[])[0] = { anchor: "s0-p4" }),
      /name the sentences/,
    ],
    ["no as-printed layer", (c) => (c.printed = []), /no as-printed layer/],
    [
      "an equation of no record",
      (c) => (c.equations = ["eq-model-me-nothing"]),
      /eq-model-me-nothing is not a mass-energy equation/,
    ],
    [
      "a laboratory that is not registered",
      (c) => (c.probes = [{ instrument: "me-09", question: "q" }]),
      /me-09 is not a registered laboratory/,
    ],
    [
      "a preset in mode form",
      (c) => (c.probes = [{ instrument: "me-01", question: "q", preset: "me-01:pulses-at-0.6c" }]),
      /not of the form me-01-<slug>/,
    ],
    [
      "a preset another laboratory registers",
      (c) => (c.probes = [{ instrument: "me-01", question: "q", preset: "me-01-card-radium" }]),
      /me-01-card-radium is not registered by me-01/,
    ],
    [
      "a card that lists its misconceptions itself",
      (c) => (c.misconceptions = ["misc-me-mass-converts"]),
      /lists misconceptions itself/,
    ],
    [
      "a margin record that does not exist",
      (c) => (c.usedLater = ["me-margin-e"]),
      /claims a later use, me-margin-e, that no connection or margin record names/,
    ],
    [
      "a passage of no record",
      (c) => (c.arguments = ["arg-me-nothing"]),
      /arg-me-nothing is not a mass-energy passage/,
    ],
    [
      "a scenario another paper owns",
      (c) => (c.printedCheck = "diffusion-einstein-1905-printed"),
      /diffusion-einstein-1905-printed is not a mass-energy scenario/,
    ],
    [
      "a scenario that does not exist",
      (c) => (c.printedCheck = "mass-energy-nothing"),
      /mass-energy-nothing is not a mass-energy scenario/,
    ],
    [
      "E = mc² shown as the paper's",
      (c) => (c.oneSentence = "The paper gives E = mc^2."),
      /shows E = mc²/,
    ],
    ["no title", (c) => (c.title = ""), /has no title/],
    [
      "a missing kind of meaning",
      (c) => ((c.meanings as Record<string, unknown>).evidentialRole = ""),
      /four kinds of meaning/,
    ],
  ];
  for (const [name, edit, expected] of cases)
    test(name, () => {
      const problems = broken(edit);
      expect(problems.some((p) => expected.test(p))).toBe(true);
    });

  test("a card's wrong turns are the ledger records that name it, and a record naming no card is refused", () => {
    const first = (raw as { cards: { id: string }[] }).cards[0]?.id ?? "";
    const ledger = new Map<string, readonly string[]>([
      ["misc-names-first", [first]],
      ["misc-names-nothing", ["me-no-such-result"]],
      ["misc-names-none", []],
    ]);
    const r = checkResultCards(raw, { ...context, ledger });
    expect(r.cards.find((c) => c.id === first)?.misconceptionIds).toEqual(["misc-names-first"]);
    expect(
      r.cards.filter((c) => c.id !== first).every((c) => c.misconceptionIds.length === 0),
    ).toBe(true);
    expect(r.problems).toEqual([
      "mass-energy misconception misc-names-nothing names result me-no-such-result, which is no card",
    ]);
  });
});
