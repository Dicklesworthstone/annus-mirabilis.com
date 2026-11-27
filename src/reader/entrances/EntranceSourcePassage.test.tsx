import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBilingualEdition } from "../faces/bilingualLoader.ts";
import { EnglishFace } from "../faces/EnglishFace.tsx";
import { GermanFace } from "../faces/GermanFace.tsx";
import { EntranceSourcePassage } from "./EntranceSourcePassage.tsx";

const passages = [
  ["brownian-motion", "eq-s5-d2"],
  ["light-quanta", "eq-s5-d7"],
  ["special-relativity", "eq-s1-d1"],
  ["mass-energy", "eq-s0-d2"],
] as const;

for (const [paper, id] of passages) {
  test(`${paper}: both links land on the printed equation used in the first encounter`, async () => {
    const edition = await loadBilingualEdition(paper);
    if (!edition) throw new Error(`Missing bilingual edition for ${paper}`);
    const html = renderToStaticMarkup(<EntranceSourcePassage paper={paper} />);
    const section = edition.blocks.find((block) => block.id === id)?.section;
    expect(section).toBeDefined();
    const { blocks, units } = edition;
    const german = renderToStaticMarkup(
      <GermanFace paper={edition.paper} blocks={blocks} sectionId={section} />,
    );
    const english = renderToStaticMarkup(
      <EnglishFace paper={edition.paper} blocks={blocks} units={units} sectionId={section} />,
    );
    for (const [face, rendered] of [["german", german], ["english", english]] as const) {
      expect(html).toContain(`href="/papers/${paper}/view/${face}/#${id}"`);
      expect(rendered.split(` id="${id}"`)).toHaveLength(2);
    }
    expect(units.find((unit) => unit.id === id)?.sourceRefs).toContainEqual({ paper, id });
  }, 30_000);
}
