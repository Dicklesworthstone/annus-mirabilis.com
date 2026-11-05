/**
 * The actual static results route must expose the checked calculation. Testing the projector
 * alone would pass with the same missing production wire this change repairs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { FaceFallback } from "../../FaceFallback.tsx";
import { PaperPage } from "../../PaperPage.tsx";

const PAPER = "mass-energy";
const records = loadResultCards(process.cwd(), PAPER);
const html = await exportMarkup(await FaceFallback({ paperId: PAPER, face: "results" }));
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

function resultHtml(id: string): string {
  const start = html.indexOf(`id="result-${id}"`);
  if (start < 0) throw new Error(`The results route did not render ${id}`);
  const end = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, end < 0 ? undefined : end);
}

function supportHtml(id: string): string {
  return (
    resultHtml(id).match(/<section[^>]*data-result-layer="support"[\s\S]*?<\/section>/)?.[0] ?? ""
  );
}

describe("the results route exposes the supporting reasoning", () => {
  test("the named results expose their scope, assumptions and a working derivation link", () => {
    expect(records?.problems).toEqual([]);
    const selected = [
      ["me-kinetic-energy-drop", "me-ledger-derivation"],
      ["me-low-speed-approximation", "me-low-speed-derivation"],
      ["me-mass-decrease", "me-low-speed-derivation"],
    ] as const;
    for (const [id, anchor] of selected) {
      const support = supportHtml(id);
      expect(support).toContain("Why should I believe this step?");
      expect(support).toContain(`href="/papers/mass-energy/#${anchor}"`);
      expect(explanation).toContain(`id="${anchor}"`);
      expect(support).toContain("What this route uses");
      expect(support).toContain('data-proof-assumption="offset"');
      expect(support).toContain("The same offset C before and after emission");
      const declaration = records?.cards.find((card) => card.id === id)?.support;
      if (declaration?.kind !== "checked-proof") throw new Error(`No proof declaration for ${id}`);
      // Scope is scientific content, not a review-status notice.
      expect(support).toContain(declaration.scope.replaceAll("'", "&#x27;"));
      const words = support.replace(/<[^>]+>/g, "");
      expect(words).not.toMatch(/eq-model-|me-ledger-elimination|me-low-speed-coefficient/);
      expect(words).not.toMatch(/Selected route:|machine-checked|authored-unverified/);
    }
  });

  test("only the mass identification needs the inertia premise", () => {
    expect(supportHtml("me-mass-decrease")).toContain('data-proof-assumption="inertia"');
    expect(supportHtml("me-low-speed-approximation")).not.toContain(
      'data-proof-assumption="inertia"',
    );
  });

  test("an explicit absence creates no placeholder or invented support claim", () => {
    const absent = records?.cards.filter((card) => card.support.kind === "no-checked-proof") ?? [];
    expect(absent.length).toBeGreaterThan(0);
    for (const card of absent) expect(supportHtml(card.id)).toBe("");
  });
});

/** This assertion uses the Next export itself; exportMarkup cannot establish where Next puts HTML.
 * Run after bun run build, like the other suites that inspect out/. */
test("the built results page carries support for the kinetic-energy drop in its HTML", () => {
  const built = readFileSync(
    join(process.cwd(), "out/papers/mass-energy/view/results/index.html"),
    "utf8",
  );
  const article = built.match(
    /<article\b[^>]*data-result-id="me-kinetic-energy-drop"[^>]*>[\s\S]*?<\/article>/,
  )?.[0];
  expect(article).toBeDefined();
  expect(article).toContain('data-result-layer="support"');
  expect(article).toContain("Why should I believe this step?");
  expect(article).toContain('href="/papers/mass-energy/#me-ledger-derivation"');
  const paper = readFileSync(join(process.cwd(), "out/papers/mass-energy/index.html"), "utf8");
  expect(paper).toContain('id="me-ledger-derivation"');
});
