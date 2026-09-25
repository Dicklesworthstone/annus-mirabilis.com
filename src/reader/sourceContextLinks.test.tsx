/**
 * Each passage's "Source context" line offers only the faces that have something to show, and
 * opens the German and the scan at the passage's own section.
 *
 * Before: every passage of every paper linked German, English, interlinear gloss and facsimile,
 * each at #<argument id>. English and gloss are empty for all four papers, special-relativity has
 * no German, and no face carries an argument's id, so the links either said "not yet available"
 * or opened at the top of the paper. Asserted in both directions: faces with content are linked,
 * empty ones are not, and a link's fragment is an id the face really has. The passage's "Read the
 * original" action follows the same rule (paperSourceFaces.ts).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { parseYaml } from "../content/provenance/yaml.ts";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperPage } from "./PaperPage.tsx";
import { paperSourceFaces } from "./paperSourceFaces.ts";

/**
 * The sections of a paper that have English, read straight from its unit files: the section of
 * each unit's source id (s0-p1-s1, s1-fn3, eq-s1-d1, masthead-title belongs to no section).
 */
function translatedSections(paperId: string): Set<string> {
  const dir = join(process.cwd(), "content", "translation-units", paperId);
  if (!existsSync(dir)) return new Set();
  const sections = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yaml"))) {
    const unit = parseYaml(readFileSync(join(dir, f), "utf8")) as { sourceRefs?: { id: string }[] };
    for (const ref of unit.sourceRefs ?? []) {
      const m = /^(?:eq-)?(s\d+)(?:-|$)/.exec(ref.id);
      if (m?.[1]) sections.add(m[1]);
    }
  }
  return sections;
}

async function contextLines(paperId: string) {
  await installDom();
  try {
    const html = await exportMarkup(await PaperPage({ paperId }));
    const page = new DOMParser().parseFromString(html, "text/html");
    return [...page.querySelectorAll("article.reader-passage")].map((passage) => {
      const line = [...passage.querySelectorAll("p.fine")].find((p) =>
        p.textContent?.startsWith("Source context:"),
      );
      const original = [...passage.querySelectorAll(".passage-actions a")].find(
        (a) => a.textContent?.trim() === "Read the original",
      );
      return {
        id: passage.id,
        text: line?.textContent ?? "",
        hrefs: [...(line?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href") ?? ""),
        original: original?.getAttribute("href") ?? null,
      };
    });
  } finally {
    await uninstallDom();
  }
}

describe("a passage's Source context links only faces that exist", () => {
  test("light-quanta: German and facsimile at every passage's section; English only where that section is translated", async () => {
    // The translation lands a section at a time. A passage in a section with no English used to
    // be offered "English" anyway, which opened the English face with nothing of that section.
    const { arguments: args } = await loadPaper("light-quanta");
    const sectionOf = new Map(args.map((a) => [a.id, a.section]));
    const ids = new Set(loadGermanSourceFace("light-quanta")?.blocks.map((b) => b.id));
    const translated = translatedSections("light-quanta");
    const sources = await paperSourceFaces("light-quanta");
    const lines = await contextLines("light-quanta");
    expect(lines.length).toBeGreaterThan(0);
    let withEnglish = 0;
    let withoutEnglish = 0;
    for (const line of lines) {
      const section = sectionOf.get(line.id) ?? "?";
      const german = line.hrefs.find((h) => h.includes("/view/german/"));
      const fragment = german?.split("#")[1];
      // The fragment names an element the German face renders, at this passage's section.
      expect(fragment).toBeDefined();
      expect(ids.has(fragment ?? "")).toBe(true);
      expect(fragment?.startsWith(section)).toBe(true);
      const english = line.hrefs.find((h) => h.includes("/view/english/"));
      if (translated.has(section)) {
        expect(line.text).toBe("Source context: German source · English · Facsimile");
        // At the section's first English unit, an id the English face renders.
        const englishFragment = sources.englishSectionFragment(section);
        expect(englishFragment).not.toBe("");
        expect(english).toBe(`/papers/light-quanta/view/english/${englishFragment}`);
        withEnglish += 1;
      } else {
        expect(line.text).toBe("Source context: German source · Facsimile");
        expect(english).toBeUndefined();
        withoutEnglish += 1;
      }
      expect(line.hrefs.some((h) => h.includes("/view/gloss/"))).toBe(false);
      // "Read the original" goes where the German link goes, not to #<argument id>.
      expect(line.original).toBe(german ?? "");
    }
    // Non-vacuity, on purpose. Passages outside the translated sections exist while the
    // translation is partial; and once any section has English, some passage is offered it.
    expect(withoutEnglish).toBeGreaterThan(0);
    if (translated.size > 0) expect(withEnglish).toBeGreaterThan(0);
    // The introduction has no heading block, so it opens at its first paragraph.
    const intro = lines.find((l) => sectionOf.get(l.id) === "s0");
    expect(intro?.hrefs[0]).toBe("/papers/light-quanta/view/german/#s0-p1");
  });

  test("mass-energy: the English link opens the English face at an id it has, never #<argument id>", async () => {
    // No English unit carries an argument's id. Until passages are bound to paragraphs the link
    // names its section's first English sentence (paperSourceFaces.englishSectionFragment).
    const lines = await contextLines("mass-energy");
    expect(lines.length).toBeGreaterThan(0);
    const english = await exportMarkup(
      await PaperPage({ paperId: "mass-energy", face: "english" }),
    );
    const ids = new Set([...english.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const hrefs = lines.flatMap((l) => l.hrefs.filter((h) => h.includes("/view/english/")));
    expect(hrefs.length).toBe(lines.length);
    for (const href of hrefs) {
      const fragment = href.split("#")[1] ?? "";
      expect(fragment.startsWith("arg-")).toBe(false);
      expect(ids.has(fragment)).toBe(true);
    }
  });

  test("special-relativity has no German: its lines offer the facsimile alone", async () => {
    const lines = await contextLines("special-relativity");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text).toBe("Source context: Facsimile");
      // No German draft, so there is no id to aim at and the link opens the face itself.
      expect(line.hrefs).toEqual(["/papers/special-relativity/view/facsimile/"]);
      // No German text, so no "Read the original" leading to a "not yet available" page.
      expect(line.original).toBe(null);
    }
  });
});
