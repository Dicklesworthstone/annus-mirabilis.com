/**
 * A paper's misconceptions and margin notes reach its explanation page (dispatch 163): the loader
 * (marginRecords.ts) admits only what the page can show correctly, and the sections
 * (PaperMargins.tsx) are static markup that renders nothing for a paper without records.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { loadPaperMargins, MarginRecordError } from "./marginRecords.ts";
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

  test("refuses bad-math", () => {
    expect(() => loadPaperMargins("demo-paper", root("bad-math"))).toThrow(
      "Unsupported math command: theta",
    );
  });

  // Each of the loader's own refusals, by its code, from a fixture that reaches exactly that site.
  const refusal = (name: string): MarginRecordError => {
    try {
      loadPaperMargins("demo-paper", root(name));
    } catch (error) {
      if (error instanceof MarginRecordError) return error;
      throw error;
    }
    throw new Error(`${name}: loaded without a refusal`);
  };

  test("refuses a file that is not JSON: margin-record-not-json", () => {
    const e = refusal("yaml-file");
    expect(e.code).toBe("margin-record-not-json");
    expect(e.message).toContain("margin records are JSON");
  });

  test("refuses a misconception filed under the wrong paper: margin-record-paper-mismatch", () => {
    const e = refusal("paper-mismatch");
    expect(e.code).toBe("margin-record-paper-mismatch");
    expect(e.message).toContain("filed under demo-paper, names other-paper");
  });

  test("refuses an unregistered instrument: margin-instrument-unregistered", () => {
    const e = refusal("unregistered-instrument");
    expect(e.code).toBe("margin-instrument-unregistered");
    expect(e.message).toContain('instrument "zz-99" is not registered');
  });

  test("refuses a citation with no bibliography record: margin-citation-missing", () => {
    const e = refusal("dangling-citation");
    expect(e.code).toBe("margin-citation-missing");
    expect(e.message).toContain('cites "cit-demo", which has no bibliography record');
  });

  test("refuses a cited record that is not a citation: margin-citation-wrong-kind", () => {
    const e = refusal("citation-wrong-kind");
    expect(e.code).toBe("margin-citation-wrong-kind");
    expect(e.message).toContain("is not a citation");
  });

  test("refuses a margin note that cites no source: margin-note-uncited", () => {
    const e = refusal("note-uncited");
    expect(e.code).toBe("margin-note-uncited");
    expect(e.message).toContain("a margin note cites no source");
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
    // The locator's own full stop is not doubled before the page ("(1905). , p. 641").
    expect(html).not.toMatch(/\.\s*,/);
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
