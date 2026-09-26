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
import { sectionGlossPath } from "./faces/glossSections.ts";
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

/**
 * The sections of a paper that have an interlinear gloss, read straight from its gloss-unit files:
 * the section of each unit's sentence id (masthead-title belongs to no section).
 */
function glossedSections(paperId: string): Set<string> {
  const dir = join(process.cwd(), "content", "gloss-units", paperId);
  if (!existsSync(dir)) return new Set();
  const sections = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yaml"))) {
    const unit = parseYaml(readFileSync(join(dir, f), "utf8")) as { sentenceId?: string };
    const m = /^(s\d+)(?:-|$)/.exec(unit.sentenceId ?? "");
    if (m?.[1]) sections.add(m[1]);
  }
  return sections;
}

/** The sections of a paper that have German source blocks, read straight from its block files. */
function germanSections(paperId: string): Set<string> {
  const dir = join(process.cwd(), "content", "source-blocks", paperId);
  if (!existsSync(dir)) return new Set();
  const sections = new Set<string>();
  for (const f of readdirSync(dir).filter(
    (x) => x.endsWith(".yaml") && !x.startsWith("manifest") && !x.startsWith("ledger"),
  )) {
    const block = parseYaml(readFileSync(join(dir, f), "utf8")) as { section?: string };
    if (block.section) sections.add(block.section);
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
    const glossed = glossedSections("light-quanta");
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
      // The line names exactly the faces that hold this section, in the special-relativity case's
      // order below. It was a fixed string with no gloss in it, written while light quanta had no
      // gloss, so the introduction's gloss (dispatch 213) turned it red on correct output.
      const offered = [
        "German source",
        translated.has(section) ? "English" : null,
        glossed.has(section) ? "Interlinear gloss" : null,
        "Facsimile",
      ].filter((f) => f !== null);
      expect(line.text).toBe(`Source context: ${offered.join(" · ")}`);
      if (translated.has(section)) {
        // At the section's first English unit, an id the English face renders.
        const englishFragment = sources.englishSectionFragment(section);
        expect(englishFragment).not.toBe("");
        expect(english).toBe(`/papers/light-quanta/view/english/${englishFragment}`);
        withEnglish += 1;
      } else {
        expect(english).toBeUndefined();
        withoutEnglish += 1;
      }
      // The gloss is linked exactly where the section is glossed (the introduction since dispatch
      // 213); the "every glossed paper" case below checks the link's fragment.
      expect(line.hrefs.some((h) => h.includes("/view/gloss/"))).toBe(glossed.has(section));
      // "Read the original" goes where the German link goes, not to #<argument id>.
      expect(line.original).toBe(german ?? "");
    }
    // Non-vacuity, on purpose, in both directions and only while each direction has members:
    // while some passage's section is untranslated, some passage is offered no English; once any
    // section has English, some passage is offered it. Light quanta's translation is now whole,
    // so the first holds vacuously here; the partial case keeps its guard in editionCoverage.test
    // (a synthetic partial edition) and in the special-relativity case below.
    expect(withEnglish + withoutEnglish).toBe(lines.length);
    const sections = new Set(args.map((a) => a.section));
    if ([...sections].some((s) => !translated.has(s))) expect(withoutEnglish).toBeGreaterThan(0);
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

  test("special-relativity: German and English only where its edition has that section; the facsimile always", async () => {
    // Until dispatch 192 this said special relativity had no German and expected the facsimile
    // alone. It has no ledger draft face, and its German and English now arrive a section at a
    // time as an unreviewed edition, which the German face renders. What this watches: a passage
    // is offered a face exactly when that face holds the passage's section, so a §3 passage is
    // never sent to a German or English face that holds only the introduction, and "Read the
    // original" goes where the German link goes, or nowhere.
    const { arguments: args } = await loadPaper("special-relativity");
    const sectionOf = new Map(args.map((a) => [a.id, a.section]));
    const german = germanSections("special-relativity");
    const translated = translatedSections("special-relativity");
    const glossed = glossedSections("special-relativity");
    const lines = await contextLines("special-relativity");
    expect(lines.length).toBeGreaterThan(0);
    let outside = 0;
    for (const line of lines) {
      const section = sectionOf.get(line.id) ?? "?";
      const offered = [
        german.has(section) ? "German source" : null,
        translated.has(section) ? "English" : null,
        glossed.has(section) ? "Interlinear gloss" : null,
        "Facsimile",
      ].filter((f) => f !== null);
      expect(line.text).toBe(`Source context: ${offered.join(" · ")}`);
      const germanHref = line.hrefs.find((h) => h.includes("/view/german/"));
      if (german.has(section)) {
        // At an element of the passage's own section.
        expect(germanHref?.split("#")[1]?.startsWith(section)).toBe(true);
        expect(line.original).toBe(germanHref ?? "");
      } else {
        expect(germanHref).toBeUndefined();
        expect(line.original).toBe(null);
        outside += 1;
      }
    }
    // Non-vacuity while the edition is partial: some passage lies outside it.
    const sections = new Set(args.map((a) => a.section));
    if ([...sections].some((s) => !german.has(s))) expect(outside).toBeGreaterThan(0);
  });

  test("every glossed paper: a passage offers the gloss exactly where its section is glossed, at an id the gloss face renders", async () => {
    // The gloss link was offered on every passage once a paper had one gloss unit, and pointed at
    // #<argument id>, which the gloss face never renders (its ids are sentence ids): all 8 of
    // mass-energy's links and all 9 of Brownian's named nothing, and Brownian, glossed only in its
    // introduction, sent its § 4 passage to a gloss with no § 4 in it (dispatch 209).
    const dir = join(process.cwd(), "content", "gloss-units");
    const papers = existsSync(dir)
      ? readdirSync(dir).filter((p) => readdirSync(join(dir, p)).some((f) => f.endsWith(".yaml")))
      : [];
    expect(papers).toContain("mass-energy");
    let offered = 0;
    let withheld = 0;
    for (const paperId of papers) {
      const { arguments: args } = await loadPaper(paperId);
      const sectionOf = new Map(args.map((a) => [a.id, a.section]));
      const glossed = glossedSections(paperId);
      // The gloss prints one section per page (dispatch 254), so each link's fragment is looked
      // for on the section page it names.
      const idsOn = new Map<string, Set<string | undefined>>();
      const idsOf = async (section: string) => {
        const known = idsOn.get(section);
        if (known) return known;
        const face = await exportMarkup(await PaperPage({ paperId, face: "gloss", section }));
        const ids = new Set([...face.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
        idsOn.set(section, ids);
        return ids;
      };
      for (const line of await contextLines(paperId)) {
        const section = sectionOf.get(line.id) ?? "?";
        const gloss = line.hrefs.filter((h) => h.includes("/view/gloss/"));
        if (glossed.has(section)) {
          expect(gloss.length).toBe(1);
          const [path, fragment = ""] = gloss[0]?.split("#") ?? [];
          expect(path).toBe(sectionGlossPath(paperId, section));
          expect(fragment.startsWith("arg-")).toBe(false);
          expect((await idsOf(section)).has(fragment)).toBe(true);
          // The passage's own section, not the masthead above it: Brownian files its title block
          // under s0, and the introduction's passage landed on #masthead-title. The section's own
          // heading (#s1) counts: light quanta's § 1 gloss begins with it (dispatch 216), and the
          // English link opens that section at the same heading.
          expect(fragment === section || fragment.startsWith(`${section}-`)).toBe(true);
          offered += 1;
        } else {
          expect(gloss).toEqual([]);
          expect(line.text.includes("Interlinear gloss")).toBe(false);
          withheld += 1;
        }
      }
    }
    // Non-vacuity: some passage is offered the gloss. And while any glossed paper has a passage
    // whose section is not glossed, some passage is refused it.
    expect(offered).toBeGreaterThan(0);
    const partial = await Promise.all(
      papers.map(async (p) => {
        const glossed = glossedSections(p);
        return (await loadPaper(p)).arguments.some((a) => !glossed.has(a.section));
      }),
    );
    if (partial.some(Boolean)) expect(withheld).toBeGreaterThan(0);
  });
});
