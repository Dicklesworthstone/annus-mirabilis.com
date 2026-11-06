import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPaper } from "../../content/server.ts";
import { SOURCE_JUMPS as BROWNIAN_JUMPS } from "../../discovery/brownian/journeyII.ts";
import { SOURCE_JUMPS as LIGHT_QUANTA_JUMPS } from "../../discovery/lightQuanta/journeyI.ts";
import { SOURCE_JUMPS as MASS_ENERGY_JUMPS } from "../../discovery/massEnergy/journeyIV.ts";
import { SOURCE_JUMPS as RELATIVITY_JUMPS } from "../../discovery/relativity/journeyIII.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { loadBilingualEdition } from "../faces/bilingualLoader.ts";
import { loadPassageProjections, type PassageProjection } from "./passageProjections.ts";

const papers = [
  ["light-quanta", LIGHT_QUANTA_JUMPS],
  ["brownian-motion", BROWNIAN_JUMPS],
  ["special-relativity", RELATIVITY_JUMPS],
  ["mass-energy", MASS_ENERGY_JUMPS],
] as const;

describe("passage projections over the published four-paper corpus", () => {
  for (const [paperId, jumps] of papers) {
    test(`${paperId}: every destination resolves to an existing record and coverage is nonempty`, async () => {
      const [edition, payload] = await Promise.all([
        loadBilingualEdition(paperId),
        loadPaper(paperId),
      ]);
      expect(edition).not.toBeNull();
      const index = await loadPassageProjections(paperId, { edition, payload });
      const blocks = edition?.blocks ?? [];
      const units = edition?.units ?? [];
      const paragraphs = blocks.filter((b) => b.kind === "paragraph" || b.kind === "footnote");
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(Object.keys(index.bySourceBlock).length).toBe(blocks.length);
      expect(Object.keys(index.byArgument).length).toBe(payload.arguments.length);
      expect(Object.keys(index.byTranslationUnit).length).toBe(units.length);
      const germanTargets = new Set(blocks.map((b) => b.id));
      const englishTargets = new Set(units.map((u) => u.id));
      const explanationTargets = new Set(payload.arguments.map((a) => a.id));
      const journeyTargets = new Set(jumps.map((j) => j.id));
      const registered = new Set<string>(REGISTERED_IDS);
      const destinations = new Set<string>();
      let checked = 0;
      for (const projection of [
        ...Object.values(index.bySourceBlock),
        ...Object.values(index.byArgument),
        ...Object.values(index.byTranslationUnit),
      ]) {
        for (const key of Object.keys(projection) as (keyof PassageProjection)[]) {
          for (const link of projection[key]) {
            destinations.add(link.href);
            const url = new URL(link.href, "https://annus.example");
            const anchor = decodeURIComponent(url.hash.slice(1));
            expect(link.label.trim().length).toBeGreaterThan(0);
            if (key === "german") {
              expect(url.pathname).toBe(`/papers/${paperId}/view/german/`);
              expect(germanTargets.has(anchor)).toBe(true);
            } else if (key === "english") {
              expect(url.pathname).toBe(`/papers/${paperId}/view/english/`);
              expect(englishTargets.has(anchor)).toBe(true);
            } else if (key === "explanation") {
              expect(url.pathname).toBe(`/papers/${paperId}/`);
              expect(explanationTargets.has(anchor)).toBe(true);
            } else if (key === "journey") {
              expect(url.pathname).toBe(`/discover/${paperId}/`);
              expect(journeyTargets.has(anchor)).toBe(true);
            } else {
              const id = url.pathname.split("/")[2] ?? "";
              expect(registered.has(id)).toBe(true);
              expect(existsSync(join(process.cwd(), "content", "experiments", `${id}.yaml`))).toBe(
                true,
              );
            }
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(paragraphs.length);
      const count = (key: keyof PassageProjection) =>
        paragraphs.filter((b) => (index.bySourceBlock[b.id]?.[key].length ?? 0) > 0).length;
      const coverage = {
        sourceProjections: Object.keys(index.bySourceBlock).length,
        translationProjections: Object.keys(index.byTranslationUnit).length,
        argumentProjections: Object.keys(index.byArgument).length,
        paragraphs: blocks.filter((b) => b.kind === "paragraph").length,
        footnotes: blocks.filter((b) => b.kind === "footnote").length,
        printedPassages: paragraphs.length,
        german: count("german"),
        english: count("english"),
        explanation: count("explanation"),
        instrument: count("instrument"),
        journey: count("journey"),
        checkedLinks: checked,
        distinctDestinations: destinations.size,
      };
      expect(coverage.english).toBeGreaterThan(0);
      expect(coverage.explanation).toBeGreaterThan(0);
      expect(coverage.instrument).toBeGreaterThan(0);
      expect(coverage.journey).toBeGreaterThan(0);
      console.log(`[passage projections] ${paperId}: ${JSON.stringify(coverage)}`);
    });
  }
});
