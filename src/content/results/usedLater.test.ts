/**
 * A result card claims a later use only where a record says so (dispatch 253): here, a connection
 * in content/connections/connections.yaml whose recorded use starts at that very card. Checked on
 * relativity's real cards, with the claims planted.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { checkResultCards, EMPTY_REGISTRIES, resultContext } from "./resultCards.ts";

const ROOT = process.cwd();
const PAPER = "special-relativity";
const context = resultContext(ROOT, PAPER);
const file = parseYaml(readFileSync(join(ROOT, "content", "results", `${PAPER}.yaml`), "utf8")) as {
  cards: Record<string, unknown>[];
};

/** The paper's cards with the given claims set, checked; only the problems about later uses. */
function laterUseProblems(claims: Readonly<Record<string, readonly string[]>>): string[] {
  if (!context) throw new Error("relativity's result context did not load");
  const cards = file.cards.map((c) =>
    typeof c.id === "string" && c.id in claims ? { ...c, usedLater: claims[c.id] } : c,
  );
  // "margin record" too: the check before dispatch 253 refused every claim with that wording.
  return checkResultCards({ ...file, cards }, context).problems.filter(
    (p) => p.includes("later use") || p.includes("margin record"),
  );
}

/**
 * THE OTHER HALF OF THE SAME RULE (dispatch 340). Everything above tests the refusal, with the claims
 * planted, and it passed while `usedLater` was empty on all 38 cards of all four papers: the margin
 * registry defaulted to an empty set, so the only claim any card could make was a connection whose
 * recorded use starts at that card, and exactly one card in the corpus had one. A rule whose acceptance
 * path no record exercises is a rule that could be inverted without a test noticing, so these read the
 * registry off disk and check a real card's real claim.
 */
describe("the margin registry a card cites against", () => {
  test("it is read from the paper's own editorial notes, and it is not empty", () => {
    const registry = resultContext(ROOT, "mass-energy")?.registries.marginRecords;
    expect(registry?.size, "no margin ids: every claim below would be refused").toBeGreaterThan(0);
    expect(registry?.has("note-me-c-1906-poincare")).toBe(true);
    // A paper with no editorial-notes directory gets an empty set rather than another paper's ids.
    expect(resultContext(ROOT, "brownian-motion")?.registries.marginRecords.size).toBe(0);
  });

  test("mass-energy's real cards cite margin records, and the registry is what licenses them", () => {
    // THE ACCEPTANCE PATH, read off the real cards rather than planted, which it could not be when
    // this test was written: the projection dropped a margin-backed claim, so none could ship until
    // dispatch 344 gave one somewhere to appear. Four claims across three cards now do.
    const meFile = parseYaml(
      readFileSync(join(ROOT, "content", "results", "mass-energy.yaml"), "utf8"),
    ) as { cards: Record<string, unknown>[] };
    const context = resultContext(ROOT, "mass-energy");
    if (!context) throw new Error("mass-energy's result context did not load");
    const byRecord = meFile.cards.flatMap((c) =>
      (Array.isArray(c.usedLater) ? c.usedLater : []).filter(
        (u): u is { record: string } => typeof u === "object" && u !== null && "record" in u,
      ),
    );
    // Non-vacuity: with no such claim shipped, everything below passes while proving nothing.
    expect(byRecord.length, "no card cites a margin record").toBeGreaterThan(0);
    expect(checkResultCards(meFile, context).problems).toEqual([]);

    // And with the registry empty, as it was until e437a5eb, every one of those claims is refused.
    const before = resultContext(ROOT, "mass-energy", EMPTY_REGISTRIES);
    if (!before) throw new Error("mass-energy's result context did not load");
    const refused = checkResultCards(meFile, before).problems;
    expect(refused.length).toBe(byRecord.length);
    for (const { record } of byRecord)
      expect(refused.join("\n")).toContain(
        `claims a later use, ${record}, that no connection or margin record names`,
      );
  });

  test("an id no editorial note names is still refused, and an empty registry licenses nothing", () => {
    const meFile = parseYaml(
      readFileSync(join(ROOT, "content", "results", "mass-energy.yaml"), "utf8"),
    ) as { cards: Record<string, unknown>[] };
    const context = resultContext(ROOT, "mass-energy");
    if (!context) throw new Error("mass-energy's result context did not load");
    const invented = {
      ...meFile,
      cards: meFile.cards.map((c) =>
        c.id === "me-mass-decrease" ? { ...c, usedLater: ["note-me-no-such-record"] } : c,
      ),
    };
    expect(checkResultCards(invented, context).problems).toEqual([
      "mass-energy card me-mass-decrease: claims a later use, note-me-no-such-record, that no connection or margin record names",
    ]);
    // A margin record of ANOTHER paper is not licensed either: the registry is read per paper.
    const elsewhere = {
      ...meFile,
      cards: meFile.cards.map((c) =>
        c.id === "me-mass-decrease" ? { ...c, usedLater: ["note-me-e-radium-and-checks"] } : c,
      ),
    };
    const brownian = resultContext(ROOT, "brownian-motion");
    if (!brownian) throw new Error("brownian's result context did not load");
    expect(checkResultCards(elsewhere, brownian).problems.length).toBeGreaterThan(0);
  });
});

describe("a card's later uses", () => {
  test("the context holds the connections, one of which records a use of a relativity card", () => {
    const recorded = (context?.connections ?? []).filter((k) => k.uses?.from.paper === PAPER);
    expect(recorded.map((k) => [k.id, k.uses?.from.result])).toContainEqual([
      "energy-transformation",
      "sr-light-complex-energy",
    ]);
  });

  test("the § 8 light-energy card may claim the use the connection records", () => {
    expect(laterUseProblems({ "sr-light-complex-energy": ["energy-transformation"] })).toEqual([]);
  });

  test("a claim no record supports is refused, and says why", () => {
    // Another card claiming the § 8 card's recorded use.
    expect(laterUseProblems({ "sr-moving-mirror": ["energy-transformation"] })).toEqual([
      "special-relativity card sr-moving-mirror: claims a later use, energy-transformation, which records the use of special-relativity sr-light-complex-energy",
    ]);
    // A connection that joins papers without one using the other.
    expect(laterUseProblems({ "sr-light-complex-energy": ["light-thread"] })).toEqual([
      "special-relativity card sr-light-complex-energy: claims a later use, light-thread, a later connection that records no use",
    ]);
    // An id no record names.
    expect(laterUseProblems({ "sr-light-complex-energy": ["used-in-1906"] })).toEqual([
      "special-relativity card sr-light-complex-energy: claims a later use, used-in-1906, that no connection or margin record names",
    ]);
  });
});
