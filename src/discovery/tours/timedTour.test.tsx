/**
 * /tours/fifteen-minutes-mass-energy as a reader gets it without JavaScript (am-tour-15min-mass-energy-nqz1):
 * every step rendered in place from the real record, no math and no symbol anywhere, each prediction
 * answerable through native disclosures, and the missing equation-free laboratory said plainly
 * rather than faked. Also the tours index, and the refusal that keeps a broken tour off the site.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import TourPage from "../../app/tours/[tour]/page.tsx";
import ToursIndex from "../../app/tours/page.tsx";
import {
  loadTour,
  mathAndPhrasingHits,
  requireTour,
  TourError,
} from "../../content/tours/tours.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { MOVE } from "../massEnergy/journeyIV.ts";

const ID = "fifteen-minutes-mass-energy";
const tour = loadTour(process.cwd(), ID)?.tour;
const html = await exportMarkup(await TourPage({ params: Promise.resolve({ tour: ID }) }));
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&[a-z#0-9]+;/g, " ")
  .replace(/\s+/g, " ");

describe("the fifteen-minute mass-energy tour, static", () => {
  test("every step is on the page, in the record's order", () => {
    const steps = [...html.matchAll(/<li id="tour-step-([a-z-]+)"/g)].map((m) => m[1]);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps).toEqual(tour?.steps.map((s) => s.id));
  });

  test("no math node, no symbol and no forbidden phrasing anywhere on the page", () => {
    expect(html).not.toContain('class="katex');
    expect(html).not.toContain("<math");
    expect(mathAndPhrasingHits(text)).toEqual([]);
    expect(text).not.toMatch(/\bphi\b/);
  });

  test("the first encounter is the paper's own, and the reading steps show their paragraphs' R0 overviews", () => {
    expect(html).toContain('data-step-kind="first-encounter"');
    expect(text).toContain("Can a body lose energy of motion without changing speed?");
    const readings = (tour?.steps ?? []).flatMap((s) => (s.kind === "reading" ? s.paragraphs : []));
    expect(readings.length).toBeGreaterThan(0);
    for (const p of readings) expect(html).toContain(`data-tour-anchor="${p.anchor}"`);
    expect(html).toContain("this leaves the equation-free path");
  });

  test("each prediction offers its prompt's three candidates in disclosures, and says the laboratory is not in the tour", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
    expect(instruments.length).toBe(3);
    for (const s of instruments) {
      const at = html.indexOf(`data-prompt-id="${s.promptId}"`);
      expect(at).toBeGreaterThan(-1);
      const block = html.slice(at, html.indexOf("</li>", at));
      const shown = [...block.matchAll(/<details data-candidate-id="([^"]+)"/g)].map((m) => m[1]);
      expect(shown).toEqual(s.choices.map((c) => c.candidateId));
      expect(block).toContain("is not built yet");
      expect(block).toContain(`href="/lab/${s.instrumentId}/"`);
    }
    // No laboratory is mounted in the tour: the step never stands in for the instrument.
    expect(html).not.toContain("data-instrument-id=");
  });

  // No draft label, whatever the summary's review state (D-2026-09-25-no-review-status-banners).
  test("the move step is Journey IV's own summary, with no draft or review label", () => {
    expect(text).toContain(MOVE.r0Summary.text.replace(/\s+/g, " ").slice(0, 60));
    expect(text).not.toContain("This summary is a draft");
    expect(text).not.toMatch(/no (?:physics reviewer|one) has (?:checked|reviewed)/);
  });

  test("the tours index lists the tour with its time", async () => {
    const index = await exportMarkup(await ToursIndex());
    expect(index).toContain(`href="/tours/${ID}/"`);
    expect(index).toContain(tour?.title ?? "no title");
  });
});

describe("a tour with a problem is kept off the site", () => {
  test("requireTour refuses it with tour-invalid, naming the rule it breaks", () => {
    const root = mkdtempSync(join(tmpdir(), "tours-"));
    mkdirSync(join(root, "content", "tours"), { recursive: true });
    writeFileSync(
      join(root, "content", "tours", "broken.yaml"),
      "id: broken\nbudget: fifteen-minutes\nrequiresEquations: true\nsteps: []\n",
    );
    let code = "no refusal";
    let message = "";
    try {
      requireTour(root, "broken");
    } catch (error) {
      if (!(error instanceof TourError)) throw error;
      code = error.code;
      message = error.message;
    }
    expect(code).toBe("tour-invalid");
    expect(message).toContain("tour-step-math");
    expect(requireTour(root, "no-such-tour")).toBeNull();
  });
});
