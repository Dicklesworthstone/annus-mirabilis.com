/**
 * A result card claims a later use only where a record says so (dispatch 253): here, a connection
 * in content/connections/connections.yaml whose recorded use starts at that very card. Checked on
 * relativity's real cards, with the claims planted.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { checkResultCards, resultContext } from "./resultCards.ts";

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
