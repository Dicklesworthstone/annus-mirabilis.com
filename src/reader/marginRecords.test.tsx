/**
 * A paper's misconceptions and margin notes reach its explanation page (dispatch 163): the loader
 * (marginRecords.ts) admits only what the page can show correctly, and the sections
 * (PaperMargins.tsx) are static markup that renders nothing for a paper without records.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { loadPaperMargins } from "./marginRecords.ts";
import { PaperMargins } from "./PaperMargins.tsx";
import { PaperPage } from "./PaperPage.tsx";

const FIXTURES = join(process.cwd(), "src", "reader", "__fixtures__", "margins");
const root = (name: string) => join(FIXTURES, name);

describe("loading a paper's margin records", () => {
  test("misconceptions and notes load in id order, with each cited source resolved", () => {
    const margins = loadPaperMargins("demo-paper", root("ok"));
    expect(margins.misconceptions.map((m) => m.id)).toEqual(["misc-demo-a", "misc-demo-b"]);
    expect(margins.notes.map((n) => n.id)).toEqual(["note-demo-a"]);
    expect(margins.citations.get("cit-demo")?.url).toBe("https://doi.org/10.1002/andp.19053231314");
  });

  test("a paper with no records has none, and reads nothing it does not have", () => {
    const margins = loadPaperMargins("no-such-paper", root("ok"));
    expect([margins.misconceptions.length, margins.notes.length, margins.citations.size]).toEqual([
      0, 0, 0,
    ]);
  });

  for (const [name, message] of [
    ["dangling-citation", 'cites "cit-demo", which has no bibliography record'],
    ["bad-math", "Unsupported math command: theta"],
    ["unregistered-instrument", 'instrument "zz-99" is not registered'],
    ["yaml-file", "margin records are JSON"],
  ] as const)
    test(`refuses ${name}`, () => {
      expect(() => loadPaperMargins("demo-paper", root(name))).toThrow(message);
    });
});

describe("the sections on the page", () => {
  const html = renderToStaticMarkup(
    <PaperMargins margins={loadPaperMargins("demo-paper", root("ok"))} />,
  );

  test("both sections render, each entry marked as a draft not yet reviewed", () => {
    expect(html).toContain('id="common-wrong-turns"');
    expect(html).toContain('id="historians-margin"');
    expect((html.match(/data-misconception-id="/g) ?? []).length).toBe(2);
    expect(html).toContain('data-intervention-status="not-yet-reviewed"');
    expect(html).toContain('href="/lab/me-02/"');
    expect(html).toContain('data-review-state="draft"');
  });

  test("a note shows its source as a link, with the locator the note gives", () => {
    expect(html).toContain('<a href="https://doi.org/10.1002/andp.19053231314">');
    expect(html).toContain("p. 641");
  });

  test("inline mathematics is typeset in claims, readings and notes, never shown as TeX", () => {
    const visible = html.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "");
    expect(visible).not.toContain("\\(");
    expect((html.match(/class="katex"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  test("a paper without records renders no section at all", () => {
    const empty = renderToStaticMarkup(
      <PaperMargins margins={{ misconceptions: [], notes: [], citations: new Map() }} />,
    );
    expect(empty).toBe("");
  });
});

test("a whole-paper page with no margin records is unchanged: no section appears", async () => {
  const page = await exportMarkup(await PaperPage({ paperId: "light-quanta" } as never));
  expect(page).not.toContain('id="common-wrong-turns"');
  expect(page).not.toContain('id="historians-margin"');
});
