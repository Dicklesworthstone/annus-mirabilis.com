import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { PAPER_SLUGS } from "../schemas/source.pure.ts";
import { checkResultCards, loadResultCards, resultContext } from "./resultCards.ts";
import { checkSupportDeclaration } from "./supportDeclarations.ts";

const ROOT = process.cwd();

describe("a result's declared support", () => {
  const proof = {
    kind: "checked-proof",
    proofId: "me-ledger-elimination",
    conclusion: "eq-model-me-exact-drop",
    scope: "The kinetic-energy difference follows under the stated premises.",
  };

  test("a known proof and an explained absence are both admitted", () => {
    expect(checkSupportDeclaration(proof)).toEqual({ support: proof, problems: [] });
    const absent = { kind: "no-checked-proof", reason: "This result is an entry premise." };
    expect(checkSupportDeclaration(absent)).toEqual({ support: absent, problems: [] });
  });

  test("omissions, invented owners and contradictory declarations are refused", () => {
    for (const invalid of [
      undefined,
      null,
      [],
      {},
      { kind: "no-checked-proof", reason: " " },
      { kind: "no-checked-proof", reason: "An assumption.", proofId: proof.proofId },
      { ...proof, proofId: "a-fixture-is-not-a-proof" },
      { ...proof, conclusion: "" },
      { ...proof, scope: "" },
      { ...proof, reason: "This declaration also claims there is no proof." },
    ]) {
      const checked = checkSupportDeclaration(invalid);
      expect(checked.problems.length).toBeGreaterThan(0);
      expect(checked.support).toBeUndefined();
    }
  });

  test("every raw card is accounted for, including all recorded absences", () => {
    const absences: string[] = [];
    let total = 0;
    let supported = 0;
    for (const paper of PAPER_SLUGS) {
      const path = join(ROOT, "content", "results", `${paper}.yaml`);
      if (!existsSync(path)) continue;
      const raw = parseYaml(readFileSync(path, "utf8")) as {
        cards: { id: string; support: unknown }[];
      };
      const loaded = loadResultCards(ROOT, paper);
      expect(loaded?.problems).toEqual([]);
      // Read the inputs too: a loader that drops an unresolved card cannot shrink this population.
      expect(loaded?.cards.map((card) => card.id)).toEqual(raw.cards.map((card) => card.id));
      for (const card of raw.cards) {
        total++;
        const declaration = checkSupportDeclaration(card.support);
        expect(declaration.problems).toEqual([]);
        expect(declaration.support).toBeDefined();
        if (declaration.support?.kind === "checked-proof") supported++;
        else if (declaration.support?.kind === "no-checked-proof")
          absences.push(`${paper}/${card.id}: ${declaration.support.reason}`);
      }
    }
    expect(supported).toBeGreaterThan(0);
    expect(absences.length).toBeGreaterThan(0);
    expect(supported + absences.length).toBe(total);
    console.log(
      "[result-support] " +
        total +
        " cards; " +
        supported +
        " checked proofs; " +
        absences.length +
        " recorded absences\n" +
        absences.join("\n"),
    );
  });

  test("removing a real card's declaration fails the record loader", () => {
    const raw = parseYaml(readFileSync(join(ROOT, "content/results/mass-energy.yaml"), "utf8")) as {
      cards: Record<string, unknown>[];
    };
    const context = resultContext(ROOT, "mass-energy");
    if (!context) throw new Error("The mass-energy result context is missing.");
    const missing = {
      cards: raw.cards.map((card) =>
        card.id === "me-kinetic-energy-drop" ? { ...card, support: undefined } : card,
      ),
    };
    expect(checkResultCards(raw, context).problems).toEqual([]);
    const result = checkResultCards(missing, context);
    expect(result.problems).toContain(
      "mass-energy card me-kinetic-energy-drop: support must name a checked proof or explain why none is available",
    );
    expect(result.cards.some((card) => card.id === "me-kinetic-energy-drop")).toBe(false);
  });
});
