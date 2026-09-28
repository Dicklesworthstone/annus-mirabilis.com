/**
 * A paper's misconceptions and margin notes reach its explanation page (dispatch 163): the loader
 * (marginRecords.ts) admits only what the page can show correctly, and the sections
 * (PaperMargins.tsx) are static markup that renders nothing for a paper without records.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { loadPaperMargins, MarginRecordError } from "./marginRecords.ts";
import { PaperMargins } from "./PaperMargins.tsx";
import { PaperPage } from "./PaperPage.tsx";

const FIXTURES = join(process.cwd(), "src", "reader", "__fixtures__", "margins");
const NOTES_DIR = join(process.cwd(), "content", "editorial-notes");
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

  // A comparison's rows point outwards (am-me-margin-entries-kfg5). Both halves the loader can
  // resolve are driven here; the half it cannot, a bare model identity with no registry to check it
  // against, is named in the loader's own comment rather than asserted over.
  test("refuses a comparison row citing a record this paper does not have", () => {
    const e = refusal("comparison-source-note-missing");
    expect(e.code).toBe("margin-comparison-source-note-missing");
    expect(e.message).toContain("row-one");
    expect(e.message).toContain("note-that-does-not-exist");
  });

  test("refuses a comparison row whose mode address names an unregistered instrument", () => {
    const e = refusal("comparison-instrument-unregistered");
    expect(e.code).toBe("margin-comparison-instrument-unregistered");
    expect(e.message).toContain("me-99:box-1906");
  });

  test("refuses a BARE reference that names no instrument, which is the shape that shipped", () => {
    // THE HOLE THIS CLOSES (dispatch 351). The check split the reference on ":" and compared the
    // instrument with the registry only when a mode followed, so a reference with no colon was never
    // compared with anything. The fixture above uses the colon form, so the planted negative only ever
    // exercised the branch that worked, and `four-momentum-modern` -- the id of ME03_FOUR_MOMENTUM_MODEL,
    // which opens nothing -- passed the loader and reached the corpus in
    // content/editorial-notes/mass-energy/note-me-g-argument-comparison.json.
    //
    // The same resolver refuses the near-miss `me-03:four-momentum` with "is not a declared mode of
    // me-03", because me-03 declares no mode; that case shares this code path and was checked by
    // planting it on the real record. This comment said "DECLARED_MODES is empty for all 37
    // instruments" until 2026-09-28: the catalogue holds 38 ids, and one of them, sr-02, has
    // declared `apparatus` since 9dbaf884. Nothing here depended on the wrong half, since me-03
    // declares nothing either way, but the sentence was quoted as evidence that the mechanism was
    // dead everywhere.
    const e = refusal("comparison-instrument-bare-unregistered");
    expect(e.code).toBe("margin-comparison-instrument-unregistered");
    expect(e.message).toContain("four-momentum-modern");
    expect(e.message).toContain("row-one");
    expect(e.message).toContain("a reader cannot open");
  });

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

  test("the site's own reconstruction says so to a reader, and the record does not pretend to", () => {
    // AGENTS.md on the fourth of its four historical statements: it "is always labeled 'A route you
    // could take,' never 'What Einstein thought'". The corpus carried the register from ce87e624
    // and no reader was shown it (dispatch 337). This asserts the page, on the real records.
    const margins = loadPaperMargins("mass-energy", process.cwd());
    const rendered = renderToStaticMarkup(<PaperMargins margins={margins} />);
    const { document } = new Window();
    document.body.innerHTML = rendered;
    const notes = [...document.querySelectorAll("#historians-margin article")];
    expect(notes.length).toBe(margins.notes.length);

    const shownFor = (statement: string) =>
      notes
        .filter((note) => note.getAttribute("data-historical-statement") === statement)
        .map((note) => note.querySelector("p.eyebrow")?.textContent ?? "");

    // The one that must be labelled, in those words, on every note that carries the register.
    const reconstructions = shownFor("site-reconstruction");
    expect(reconstructions.length).toBeGreaterThan(0);
    expect([...new Set(reconstructions)]).toEqual(["A route you could take"]);

    // And the decision for the other three, asserted rather than left to drift: nothing is shown.
    // A test that only checked the label above would pass just as well if every note wore it.
    for (const statement of ["paper-asserts", "publicly-available", "einstein-knew-or-used"]) {
      const shown = shownFor(statement);
      expect([statement, shown.length > 0]).toEqual([statement, true]);
      expect([statement, [...new Set(shown)]]).toEqual([statement, [""]]);
    }

    // Every note carries its register as data whether or not it is shown, so what the corpus knows
    // is on the page even where the page says nothing about it.
    expect(notes.map((note) => note.getAttribute("data-historical-statement"))).toEqual(
      margins.notes.map((note) => note.historicalStatement ?? null),
    );
  });

  test("every margin record that ships names its register", () => {
    // The requirement, where it costs nothing. Making historicalStatement REQUIRED in the schema is
    // one line of validation and a new throw site in the middle of source.ts, which would shift the
    // line citations that credit ~30 refusal sites below it and repeat the repair of 92f2c0a2 on the
    // file the orchestrator has already flagged. The contract it would enforce is enforced here
    // instead, over the population that matters: the records a reader is actually served. When the
    // line-citation bead lands, the schema can take this over.
    const papers = existsSync(NOTES_DIR) ? readdirSync(NOTES_DIR) : [];
    const missing: string[] = [];
    let checked = 0;
    for (const paper of papers) {
      for (const note of loadPaperMargins(paper, process.cwd()).notes) {
        checked++;
        if (!note.historicalStatement) missing.push(`${paper}/${note.id}`);
      }
    }
    // Non-vacuity: a run over no papers, or over papers whose notes all vanished, would report a
    // clean sweep of nothing.
    expect(papers.length).toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
    console.log(
      `[margin registers] ${checked} shipped notes across ${papers.length} paper(s), 0 without a register`,
    );
  });

  test("a note with no register shows none and carries none", () => {
    // Every margin record of the other three papers, and the fixtures: the field is optional, and
    // absent must mean absent rather than an invented default.
    const { document } = new Window();
    document.body.innerHTML = html;
    const note = document.querySelector("#historians-margin article");
    expect(note?.getAttribute("data-historical-statement")).toBe(null);
    expect(note?.querySelector("p.eyebrow")).toBe(null);
  });

  test("a paper without records renders no section at all", () => {
    const empty = renderToStaticMarkup(
      <PaperMargins margins={{ misconceptions: [], notes: [], citations: new Map() }} />,
    );
    expect(empty).toBe("");
  });
});

test("a whole-paper page shows each margin section exactly when the paper has its records", async () => {
  // A property over every paper, not one paper named as having none: light quanta was that paper
  // until dispatch 219 gave it a misconception ledger. A section with no records never appears, and
  // one with records always does.
  let withRecords = 0;
  for (const paper of ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"]) {
    const margins = loadPaperMargins(paper);
    const page = await exportMarkup(await PaperPage({ paperId: paper } as never));
    expect(page.includes('id="common-wrong-turns"')).toBe(margins.misconceptions.length > 0);
    expect(page.includes('id="historians-margin"')).toBe(margins.notes.length > 0);
    if (margins.misconceptions.length > 0) withRecords += 1;
  }
  // Non-vacuity: some paper has records, so the presence branch is exercised. The absence branch is
  // held by the synthetic empty-margins render above, whatever the corpus holds.
  expect(withRecords).toBeGreaterThan(0);
});
