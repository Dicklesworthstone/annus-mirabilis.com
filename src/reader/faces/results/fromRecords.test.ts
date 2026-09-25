/**
 * Each refusal in fromRecords.ts, by its rule, from a fixture that reaches exactly that site. A card
 * with a problem fails the page rather than rendering half-resolved, so each of these is the page
 * refusing to show a wrong or unowned layer. The fixture roots are temporary directories. The
 * printed check's own refusals are in src/content/results/printedChecks.test.ts, beside the join
 * that makes them.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResultCardsError } from "../../../content/results/printedChecks.ts";
import type { ResultCardRecord } from "../../../content/results/resultCards.ts";
import { resultCardsFor, toCard } from "./fromRecords.ts";

function rootWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "result-cards-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

async function ruleOf(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ResultCardsError) return error.rule;
    throw error;
  }
  return "no refusal";
}

describe("fromRecords refuses a card layer it cannot own", () => {
  test("a card naming a passage the paper does not have: result-passage-missing", async () => {
    const record = {
      id: "fixture-card",
      paper: "mass-energy",
      section: "s0",
      title: "A fixture card",
      printed: [],
      qualifications: [],
      equations: [],
      oneSentence: "One sentence.",
      decoder: [],
      probes: [],
      misconceptionIds: [],
      meanings: {},
      selectionReason: "A fixture.",
      arguments: ["arg-not-a-passage"],
    } as unknown as ResultCardRecord;
    expect(await ruleOf(() => toCard(rootWith({}), record, new Map()))).toBe(
      "result-passage-missing",
    );
  });

  test("a results file whose cards do not resolve: result-cards-unresolved", async () => {
    const root = rootWith({ "content/results/mass-energy.yaml": "cards:\n  - id: Not A Slug\n" });
    expect(await ruleOf(() => resultCardsFor("mass-energy", root))).toBe("result-cards-unresolved");
  });
});
