import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { compileContent } from "../content/compiler/compiler.ts";
import { type Foundation, validateReadingRecord } from "../content/schemas/reading.ts";
import { FoundationBody } from "./Blocks.tsx";

/**
 * Extension sections, rendered (am-found-statistics-inference-pzqv, option B): the compiler
 * attaches a section to the lesson it names, in every payload that carries that lesson, and
 * FoundationBody draws it after the stopping point, without the lesson's record changing.
 */

const TARGET = "gaussian-distributions";
const fixture = {
  schemaVersion: 1,
  kind: "foundation-extension",
  id: "fixture-extension",
  targetFoundation: `foundation:${TARGET}`,
  ownerBead: "am-found-statistics-inference-pzqv",
  title: "A section past the lesson",
  body: [{ kind: "paragraph", text: "A sentence only the fixture section has." }],
  citations: [],
};
const corpus = async () => [
  ...(await loadReadingFiles()),
  { path: "foundations/extensions/fixture-extension.json", text: JSON.stringify(fixture) },
];
const sectionIds = (f: Foundation | undefined) => (f?.extensionSections ?? []).map((s) => s.id);
/**
 * The target's sections without the fixture. Measured, not assumed: the lesson has real sections
 * of its own (8b9e5e7d), and an expectation of exactly one section broke the moment they landed.
 */
const baseline = async () => compileReadingContent(await loadReadingFiles());
const withFixture = (ids: readonly string[]) => [...ids, "fixture-extension"].sort();

describe("the compilers attach a section to the lesson it names", () => {
  test("sync: the lesson's own payload and the paper payload that carries it", async () => {
    const before = sectionIds((await baseline()).foundations.find((f) => f.id === TARGET));
    const result = compileReadingContent(await corpus());
    expect(sectionIds(result.foundations.find((f) => f.id === TARGET))).toEqual(
      withFixture(before),
    );
    const inPapers = result.papers.flatMap((p) => p.foundations.filter((f) => f.id === TARGET));
    expect(inPapers.length).toBeGreaterThan(0);
    for (const f of inPapers) expect(sectionIds(f)).toEqual(withFixture(before));
  });

  test("async: the lesson's payload, as prepare:content emits it", async () => {
    const before = sectionIds((await baseline()).foundations.find((f) => f.id === TARGET));
    const result = await compileContent(await corpus());
    expect(sectionIds(result.foundations.find((f) => f.id === TARGET))).toEqual(
      withFixture(before),
    );
  });

  test("no other lesson gains a section, and the bespoke Taylor extension is not attached", async () => {
    const before = await baseline();
    const result = compileReadingContent(await corpus());
    for (const f of result.foundations)
      if (f.id !== TARGET)
        expect(sectionIds(f), f.id).toEqual(
          sectionIds(before.foundations.find((b) => b.id === f.id)),
        );
    expect(sectionIds(result.foundations.find((f) => f.id === "taylor-expansion"))).toEqual([]);
  });

  test("a lesson record may not write extensionSections itself", () => {
    expect(() =>
      validateReadingRecord(
        {
          schemaVersion: 1,
          id: "a-lesson",
          kind: "foundation",
          title: "A lesson",
          question: "What?",
          summary: "A summary.",
          review: "draft",
          explanation: [{ kind: "paragraph", text: "Text." }],
          example: [{ kind: "paragraph", text: "Text." }],
          prerequisites: [],
          stoppingPoint: "It stops here.",
          citations: [],
          extensionSections: [],
        },
        "fixture",
      ),
    ).toThrow("Unknown field.");
  });
});

describe("FoundationBody draws the section after the stopping point", () => {
  test("heading, body, and order", async () => {
    const result = compileReadingContent(await corpus());
    const lesson = result.foundations.find((f) => f.id === TARGET) as Foundation;
    const html = renderToStaticMarkup(
      <FoundationBody foundation={lesson} foundations={result.foundations} headingLevel={2} />,
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(html).toContain('data-extension-section="fixture-extension"');
    expect(text).toContain("Going further : A section past the lesson");
    expect(text).toContain("A sentence only the fixture section has.");
    expect(html.indexOf("foundation-stop")).toBeLessThan(html.indexOf("data-extension-section"));
  });

  test("a lesson with no sections renders none", async () => {
    // A lesson with no construction, so the static render needs no lazy island, and no section.
    const result = await baseline();
    const lesson = result.foundations.find((f) => f.id === "flux-continuity") as Foundation;
    expect(sectionIds(lesson)).toEqual([]);
    const html = renderToStaticMarkup(
      <FoundationBody foundation={lesson} foundations={result.foundations} />,
    );
    expect(html).toContain("foundation-stop");
    expect(html).not.toContain("data-extension-section");
  });
});
