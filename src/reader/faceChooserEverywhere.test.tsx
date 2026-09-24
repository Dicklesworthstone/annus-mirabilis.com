/**
 * Every source face uses the one chooser (FaceChooser.tsx), with the face on screen marked.
 *
 * The English and parallel faces rendered their own row of plain links, with no current item
 * marked, while the German draft face and FaceFallback used the tabbed chooser. A reader moving
 * between faces therefore met two navigation schemes, and on two faces could not see where they
 * were. Asserted on mass-energy's live edition, where all three faces have content, plus the gloss
 * face on its fixture.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
import {
  FIXTURE_MASS_ENERGY_ALIGNMENT,
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_PAPER,
  FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
  FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
} from "../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { GlossFace } from "./faces/GlossFace.tsx";
import { PaperPage } from "./PaperPage.tsx";

const chooser = (html: string) => {
  const navs =
    html.replace(/<!-- -->/g, "").match(/<nav class="reader-controls"[\s\S]*?<\/nav>/g) ?? [];
  const nav = navs[0] ?? "";
  const current = [
    ...nav.matchAll(
      /<a [^>]*aria-current="page"[^>]*data-view-link="([^"]+)"|<a [^>]*data-view-link="([^"]+)"[^>]*aria-current="page"/g,
    ),
  ].map((m) => m[1] ?? m[2]);
  return {
    count: navs.length,
    tabs: nav.includes('class="face-tabs"'),
    current,
    bare: nav.replace(/ aria-current="page"/g, ""),
  };
};

describe("one face chooser on every source face", () => {
  test("mass-energy's German, English and parallel faces render the same chooser, each marking itself", async () => {
    const faces = ["german", "english", "parallel"] as const;
    const seen = new Map<string, ReturnType<typeof chooser>>();
    for (const face of faces)
      seen.set(
        face,
        chooser(await exportMarkup(await PaperPage({ paperId: "mass-energy", face }))),
      );
    for (const face of faces) {
      const c = seen.get(face);
      expect(c?.count).toBe(1);
      expect(c?.tabs).toBe(true);
      expect(c?.current).toEqual([face]);
    }
    // Apart from which tab is current, the markup is the same on all three.
    expect(seen.get("english")?.bare).toBe(seen.get("german")?.bare ?? "");
    expect(seen.get("parallel")?.bare).toBe(seen.get("german")?.bare ?? "");
  });

  test("the gloss face carries the chooser too, with gloss current", () => {
    const html = renderToStaticMarkup(
      <GlossFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={FIXTURE_MASS_ENERGY_SOURCE_BLOCKS}
        glossUnits={FIXTURE_MASS_ENERGY_GLOSS_UNITS}
        translations={FIXTURE_MASS_ENERGY_TRANSLATION_UNITS}
        alignment={FIXTURE_MASS_ENERGY_ALIGNMENT}
        modalityClasses={[]}
      />,
    );
    const c = chooser(html);
    expect(c.tabs).toBe(true);
    expect(c.current).toEqual(["gloss"]);
  });
});
