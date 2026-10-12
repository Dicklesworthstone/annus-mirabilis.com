/**
 * The lesson page's rail: the printed displays that print this lesson's own formulas.
 *
 * `content/lesson-formulas/<lesson>.yaml` was authored to answer a reader's question, in the words
 * of its own loader: "a reader who had just understood a lesson could not find the line in a paper
 * that uses it". Only `scripts/check-lesson-formulas.ts` ever read it, so until 2026-10-12 the
 * edge was authored, validated by a checker, and shown to nobody. Measured then: 16 edges over 5
 * lessons, 0 of them on any built page.
 *
 * Rendered from the real records and the real papers. The assertions are properties and a
 * reconciliation, never a census: edges are added as lessons are covered, and each check below
 * holds at any count while refusing to pass on an empty one.
 */
import { describe, expect, test } from "bun:test";
import { lessonFormulaUses } from "../../../content/lessonFormulas.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import Lesson from "./page";

const LESSON = "logarithms";
const HEADING = "Where the papers print these formulas";

async function read(concept: string) {
  // The lesson body suspends (a lazy construction), so the synchronous renderer throws here.
  const html = await exportMarkup(await Lesson({ params: Promise.resolve({ concept }) }));
  await installDom();
  try {
    const page = new DOMParser().parseFromString(html, "text/html");
    const section = [...page.querySelectorAll(".foundation-page-rail section")].find(
      (node) => node.querySelector("h2")?.textContent?.trim() === HEADING,
    );
    const links = [...(section?.querySelectorAll("a") ?? [])].map((a) => ({
      href: a.getAttribute("href") ?? "",
      // What a screen reader announces: the visually hidden paper name is part of the name.
      name: a.textContent?.replace(/\s+/gu, " ").trim() ?? "",
    }));
    const papers = [...(section?.querySelectorAll("h3") ?? [])].map((h) => h.textContent?.trim());
    return { present: section !== undefined, links, papers };
  } finally {
    await uninstallDom();
  }
}

const authored = lessonFormulaUses(process.cwd(), LESSON);
const rendered = await read(LESSON);

describe(`the printed-display rail on /foundations/${LESSON}/`, () => {
  test("the authored population is not empty, so nothing below can pass vacuously", () => {
    expect(authored.length).toBeGreaterThan(0);
    for (const edge of authored) {
      expect(edge.section).toMatch(/^s\d+$/u);
      expect(edge.note.length).toBeGreaterThan(0);
    }
  });

  test("every authored edge reaches the page, and the page invents none", () => {
    expect(rendered.present).toBe(true);
    // The reconciliation rather than a count: a number here would be stale the day an edge is
    // authored, and would not say WHICH edge went missing.
    expect(rendered.links.map((link) => link.href).sort()).toEqual(
      authored
        .map((edge) => `/papers/${edge.paper}/${edge.section}/view/parallel/#${edge.display}`)
        .sort(),
    );
  });

  test("each link targets a reading FACE, never the bare section page", () => {
    // The bare section page does not carry a display's id: measured 2026-10-12,
    // /papers/light-quanta/s5/ has no eq-s5-d6 while its parallel, english and german faces do.
    for (const link of rendered.links)
      expect(link.href).toMatch(/^\/papers\/[a-z-]+\/s\d+\/view\/parallel\/#eq-s\d+-/u);
  });

  test("no two links in the rail share an accessible name", () => {
    // Two displays of one section would both read "§5" without the note, and a reader choosing
    // between identical names cannot tell which line they are being sent to. This lesson prints
    // two shapes in light quanta §5 and two in §6, so the case is live rather than hypothetical.
    const names = rendered.links.map((link) => link.name);
    expect(names.length).toBe(new Set(names).size);
    for (const name of names) expect(name.length).toBeGreaterThan(0);
  });

  test("each link is announced with its paper, which is written once as a heading", () => {
    expect(rendered.papers.length).toBeGreaterThan(0);
    for (const link of rendered.links)
      expect(rendered.papers.some((paper) => paper && link.name.startsWith(paper))).toBe(true);
  });

  test("a lesson with no authored edges renders no such rail section", () => {
    // The negative a naive implementation passes by accident: 40 of the 45 lessons have no file,
    // and an always-present empty section would be a heading promising links it does not have.
    expect(lessonFormulaUses(process.cwd(), "vectors-components").length).toBe(0);
  });
});
