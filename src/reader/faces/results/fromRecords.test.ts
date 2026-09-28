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
      // Both required by ResultCardRecord. This fixture omitted them and passed only because the
      // projection used to read usedLater solely when a connections record was supplied; a
      // margin-backed claim must not depend on that, so the omission became a TypeError instead of
      // the refusal this test is about (dispatch 344).
      usedLater: [],
      usedLaterText: {},
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

/**
 * The two forms of a later use (dispatch 344). A connection's is covered on the real faces by
 * usedLaterFace.test.tsx; this is the margin-backed one, which the projection dropped entirely until
 * now, so a card that claimed one rendered no used-later line at all.
 */
describe("a later use claimed by a margin record", () => {
  const base = {
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
    arguments: [],
    usedLater: [],
    usedLaterText: {},
  };

  test("it carries the card's own words and links to the note on the explanation page", () => {
    const record = {
      ...base,
      usedLater: ["note-me-c-1906-poincare"],
      usedLaterText: {
        "note-me-c-1906-poincare": "In 1906 Einstein reached the same rule by another route.",
      },
    } as unknown as ResultCardRecord;
    // No connections are passed: a margin-backed claim must not depend on the connections record.
    expect(toCard(rootWith({}), record, new Map()).usedBy).toEqual([
      {
        text: "In 1906 Einstein reached the same rule by another route.",
        // The anchor PaperMargins renders, which prefixes the record's own id.
        href: "/papers/mass-energy/#note-note-me-c-1906-poincare",
      },
    ]);
  });

  test("a claim with no line of its own is shown as nothing rather than as an empty link", () => {
    // resultCards.ts refuses this at the record, so the page never reaches here; the projection
    // still drops it rather than rendering a link with no label.
    const record = {
      ...base,
      usedLater: ["note-me-c-1906-poincare"],
    } as unknown as ResultCardRecord;
    expect(toCard(rootWith({}), record, new Map()).usedBy).toEqual([]);
  });
});
