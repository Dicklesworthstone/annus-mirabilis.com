import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { checkVoice } from "../content/checks/voice/index.ts";
import { lessonText, sentences } from "./foundInference.shared.ts";

/**
 * am-found-transport-thermo-smv3, foundTransport.wording: "No text equates temperature with one
 * particle's energy or entropy with 'disorder'", and the six lessons pass the voice lint. The two
 * meaning rules run over every lesson record, not only this bead's six, because entropy and
 * temperature are also discussed in the logarithm and partial-derivative lessons, and a later
 * lesson inherits the rule without anyone remembering to add it.
 */

const OWNED = [
  "viscosity-stokes-drag",
  "free-energy-osmotic-pressure",
  "work-energy",
  "temperature-thermal-energy",
  "entropy-multiplicity",
  "entropy-temperature",
] as const;

const ALL = readdirSync(join(process.cwd(), "content/foundations"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length));

const ONE = String.raw`(?:a|an|one|each|every|any|a single|an individual)`;
const BODY = String.raw`(?:particle|molecule|atom|grain|electron|quantum)`;
const DENIED = /\b(not|no|never|nothing|cannot|without)\b/i;
const AVERAGED = /\b(average|averaged|mean|typical|over (many|very many|all))\b/i;

/**
 * "Disorder" used as the meaning of entropy. A mention in quotation marks names the slogan, for
 * instance to set it aside; any other use adopts it, whatever else the sentence says.
 */
export function entropyAsDisorder(sentence: string): boolean {
  // Straight single quotes are left out on purpose: they are apostrophes far more often than
  // quotation marks, and "the gas's disorder isn't" would otherwise hide its middle.
  const unquoted = sentence.replace(/“[^”]{0,40}”|"[^"]{0,40}"|‘[^’]{0,40}’/g, " ");
  return /\bdisorder(ed|ly|liness)?\b/i.test(unquoted);
}

/** Temperature read as a property of one particle, or as one particle's energy. */
export function temperatureOfOneParticle(sentence: string): boolean {
  if (DENIED.test(sentence)) return false;
  const ownTemperature =
    new RegExp(
      String.raw`\btemperature (?:of|assigned to|belonging to) ${ONE} ${BODY}\b`,
      "i",
    ).test(sentence) || new RegExp(String.raw`\b${BODY}'s temperature\b`, "i").test(sentence);
  if (ownTemperature) return true;
  if (AVERAGED.test(sentence)) return false;
  const temperatureIsItsEnergy = new RegExp(
    String.raw`\btemperature\b[^.]{0,20}\b(?:is|equals|measures|means|gives)\b[^.]{0,20}\benergy (?:of|carried by) (?:the |${ONE} )${BODY}\b`,
    "i",
  ).test(sentence);
  const itCarriesKT = new RegExp(
    String.raw`\b${ONE} ${BODY}(?:'s)?\b[^.]{0,15}\b(?:has|carries|holds|gets|receives|energy is|energy equals)\b[^.]{0,40}(?:k_?\{?B\}?\s*T|\bkT\b)`,
    "i",
  ).test(sentence);
  return temperatureIsItsEnergy || itCarriesKT;
}

describe("no lesson calls entropy disorder or gives one particle a temperature", () => {
  for (const slug of ALL)
    test(slug, () => {
      const all = sentences(lessonText(slug));
      expect(all.filter(entropyAsDisorder)).toEqual([]);
      expect(all.filter(temperatureOfOneParticle)).toEqual([]);
    });

  test("the sweep reads the lessons that discuss both ideas", () => {
    // Not a census: the sweep must at least reach every lesson this bead owns, and the lessons it
    // owns must actually talk about temperature and entropy, or the two rules would pass unread.
    for (const slug of OWNED) expect(ALL).toContain(slug);
    expect(lessonText("temperature-thermal-energy")).toMatch(/\btemperature\b/);
    expect(lessonText("entropy-multiplicity")).toMatch(/\bentropy\b/);
    expect(sentences(lessonText("temperature-thermal-energy")).length).toBeGreaterThan(10);
  });
});

describe("the six lessons pass the voice lint as prose", () => {
  for (const slug of OWNED)
    test(slug, () => {
      const errors = checkVoice(lessonText(slug), { context: "prose" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    });
});

describe("each rule finds what it forbids, and passes what the lessons say", () => {
  test("entropy as disorder", () => {
    expect(entropyAsDisorder("Entropy measures the disorder of a gas.")).toBe(true);
    expect(entropyAsDisorder("The gas moves to a more disordered state.")).toBe(true);
    expect(entropyAsDisorder("Entropy is not disorder.")).toBe(true);
    expect(entropyAsDisorder("The gas's disorder isn't counted.")).toBe(true);
    expect(
      entropyAsDisorder("The slogan “disorder” is set aside here, because it cannot be counted."),
    ).toBe(false);
    expect(
      entropyAsDisorder(
        "A state is more probable when more of the ways the particles can be arranged produce it.",
      ),
    ).toBe(false);
  });

  test("temperature of one particle", () => {
    expect(temperatureOfOneParticle("Temperature is the energy of a single molecule.")).toBe(true);
    expect(temperatureOfOneParticle("The temperature of one particle is 300 K.")).toBe(true);
    expect(temperatureOfOneParticle("A grain's temperature rises as it jiggles faster.")).toBe(
      true,
    );
    expect(
      temperatureOfOneParticle("Each molecule has an energy of ½ k_B T along each direction."),
    ).toBe(true);
    // What the thermal-energy lesson says, and a correct denial from the light-quanta lens.
    expect(
      temperatureOfOneParticle("The temperature fixes that average over many particles."),
    ).toBe(false);
    expect(temperatureOfOneParticle("It is not the energy of any one of them.")).toBe(false);
    expect(
      temperatureOfOneParticle(
        "A comparison of energies, not a temperature assigned to one particle.",
      ),
    ).toBe(false);
    expect(
      temperatureOfOneParticle(
        "Each molecule has, on average, an energy of ½ k_B T along each direction.",
      ),
    ).toBe(false);
    expect(
      temperatureOfOneParticle(
        "Here m is the particle's mass, v_x its speed along x, T the absolute temperature.",
      ),
    ).toBe(false);
  });
});
