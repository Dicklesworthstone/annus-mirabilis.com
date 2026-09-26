/**
 * EVERY FORMULA ON THE LESSON PAGES IS IN COLOUR, OR SAYS WHY NOT (dispatch 275).
 *
 * The owner: "I still see a ton of equations that aren't properly using the colored equations with
 * latex system like in classic-patents.com". On the built /foundations/ pages of b16bc66b, 390
 * formulas were drawn and only the lesson equation records were coloured. This renders every lesson
 * page and the index as the static export does and reads every visible KaTeX formula:
 * - COLOURED: every quantity it marks is coloured, by its term id (quantity-colours.css, an
 *   equation record's terms) or by the palette an ancestor names (data-paper,
 *   quantity-colours-by-paper.css); or it is a legend glyph inside a chip that carries its quantity
 *   and colour (--qc);
 * - LISTED: it is drawn in the ink inside an element that says why (data-formula-plain);
 * - a formula's MathML twin (no visual half) is the accessible copy of one counted beside it;
 * - anything else fails, naming its page.
 * It also holds the reviewed list (content/foundations/lesson-colours.yaml) to the lessons: each
 * entry names a formula the lesson prints, and each reviewed tie still reads as it was read.
 */
import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Window } from "happy-dom";
import LessonPage, { generateStaticParams } from "../../app/foundations/[concept]/page.tsx";
import FoundationsIndex from "../../app/foundations/page.tsx";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import {
  LESSON_COLOURS_PATH,
  LessonFormulaError,
  lessonInlineFormula,
  parseLessonColours,
} from "./lessonFormulas.ts";

const ROOT = process.cwd();
const colours = readFileSync(
  join(ROOT, "src", "generated", "quantity-colours-by-paper.css"),
  "utf8",
);
const colourRule = (paper: string, quantityId: string) =>
  colours.includes(`[data-paper="${paper}"] [data-quantity-id="${quantityId}"]`);
// An equation record's terms are coloured by term id (quantity-colours.css), not by palette.
const termColours = readFileSync(join(ROOT, "src", "generated", "quantity-colours.css"), "utf8");
const termRule = (term: string) => termColours.includes(`[data-term="${term}"]`);

type Census = { formulas: number; coloured: number; listed: number; problems: string[] };

function census(page: string, html: string): Census {
  const { document } = new Window();
  document.body.innerHTML = html.replace(/<(\/?)noscript>/g, "<$1div>");
  const roots = [...document.querySelectorAll(".katex")].filter(
    (el) => !el.parentElement?.closest(".katex") && el.querySelector(".katex-html"),
  );
  const out: Census = { formulas: roots.length, coloured: 0, listed: 0, problems: [] };
  for (const root of roots) {
    const tex = root.querySelector("annotation")?.textContent ?? root.textContent ?? "";
    const where = `${page} ${JSON.stringify(tex.slice(0, 40))}`;
    const marked = [...root.querySelectorAll("[data-quantity-id]")];
    if (marked.length > 0) {
      const paper = root.closest("[data-paper]")?.getAttribute("data-paper") ?? "";
      const unseen = marked
        .filter(
          (el) =>
            !termRule(el.getAttribute("data-term") ?? "") &&
            !(paper && colourRule(paper, el.getAttribute("data-quantity-id") ?? "")),
        )
        .map((el) => el.getAttribute("data-quantity-id") ?? "");
      if (unseen.length === 0) out.coloured++;
      else
        out.problems.push(
          `${where}: marks ${unseen.join(", ")}, with no colour in ${paper || "no palette"}`,
        );
      continue;
    }
    // A legend glyph: its chip carries the quantity and sets the colour itself.
    const chip = root.closest("[data-quantity-id]");
    if (chip && /--qc\s*:/.test(chip.getAttribute("style") ?? "")) {
      out.coloured++;
      continue;
    }
    const reason = root.closest("[data-formula-plain]")?.getAttribute("data-formula-plain");
    if (reason) out.listed++;
    else out.problems.push(`${where}: neither coloured nor listed with a reason`);
  }
  return out;
}

async function lessonPage(concept: string) {
  return exportMarkup(await LessonPage({ params: Promise.resolve({ concept }) }));
}

/** The inline formulas a lesson record prints, in its explanation, example and steps. */
function lessonFormulas(lesson: string): Set<string> {
  const record = JSON.parse(
    readFileSync(join(ROOT, "content", "foundations", `${lesson}.json`), "utf8"),
  ) as unknown;
  const found = new Set<string>();
  const walk = (x: unknown): void => {
    if (typeof x === "string") for (const m of x.matchAll(/\\\((.+?)\\\)/g)) found.add(m[1] ?? "");
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") for (const v of Object.values(x)) walk(v);
  };
  walk(record);
  return found;
}

describe("every formula on the lesson pages is in colour, or says why not", () => {
  test("the lesson pages and the index: every formula coloured or listed", async () => {
    const params = await generateStaticParams();
    // Not vacuous: there are lessons to read.
    expect(params.length).toBeGreaterThan(40);
    const total: Census = { formulas: 0, coloured: 0, listed: 0, problems: [] };
    const pages = [
      ...(await Promise.all(
        params.map(async ({ concept }) =>
          census(`/foundations/${concept}/`, await lessonPage(concept)),
        ),
      )),
      census("/foundations/", await exportMarkup(await FoundationsIndex())),
    ];
    for (const page of pages) {
      total.formulas += page.formulas;
      total.coloured += page.coloured;
      total.listed += page.listed;
      total.problems.push(...page.problems);
    }
    console.log(
      `[lesson colours] ${pages.length} pages, ${total.formulas} formulas: ${total.coloured} coloured, ${total.listed} listed; ${total.problems.length} problems`,
    );
    expect(total.problems).toEqual([]);
    expect(total.coloured).toBeGreaterThan(0);
    expect(total.listed).toBeGreaterThan(0);
  });

  test("each reviewed entry names a formula its lesson prints, and each tie still reads as it was read", () => {
    const raw = parseYaml(readFileSync(join(ROOT, LESSON_COLOURS_PATH), "utf8")) as {
      coloured?: { lesson: string; latex: string }[];
      plain?: { lesson: string; latex: string }[];
    };
    const entries = [...(raw.coloured ?? []), ...(raw.plain ?? [])];
    expect(raw.coloured?.length ?? 0).toBeGreaterThan(0);
    expect(raw.plain?.length ?? 0).toBeGreaterThan(0);
    const stale = entries.filter((e) => !lessonFormulas(e.lesson).has(e.latex));
    expect(stale.map((e) => `${e.lesson} ${e.latex}`)).toEqual([]);
    // A broken tie throws; lessonInlineFormula is what the pages call.
    for (const e of raw.coloured ?? [])
      expect(() => lessonInlineFormula(e.lesson, e.latex)).not.toThrow();
  });

  test("a reviewed tie the notation no longer reads that way is refused, naming its page", () => {
    // A copy of the content with one tie whose recorded reading is not what the notation reads.
    const root = mkdtempSync(join(tmpdir(), "lesson-colours-"));
    mkdirSync(join(root, "content", "foundations"), { recursive: true });
    for (const dir of ["notation", "papers", "arguments"])
      symlinkSync(join(ROOT, "content", dir), join(root, "content", dir));
    writeFileSync(
      join(root, LESSON_COLOURS_PATH),
      [
        "coloured:",
        "  - lesson: temperature-thermal-energy",
        '    latex: "k_BT"',
        "    paper: light-quanta",
        "    section: s1",
        '    reads: "k_B=boltzmannConstant, T=aQuantityNobodyRead"',
      ].join("\n"),
    );
    let caught: unknown;
    try {
      lessonInlineFormula("temperature-thermal-energy", "k_BT", root);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LessonFormulaError);
    expect((caught as LessonFormulaError).code).toBe("lesson-formula-tie-broken");
    expect(String((caught as Error).message)).toContain("/foundations/temperature-thermal-energy/");
    // Sanity for the fixture: the directories it reads are the real ones.
    expect(readdirSync(join(root, "content", "notation")).length).toBeGreaterThan(0);
  });

  test("an entry without its fields is refused: lesson-colours-unreadable", () => {
    expect(() =>
      parseLessonColours({ coloured: [{ lesson: "logarithms", latex: "k_B" }] }, "fixture"),
    ).toThrow("lesson-colours-unreadable");
  });

  test("the census itself fails a formula neither coloured nor listed, naming its page", () => {
    const bare = census(
      "/foundations/plant/",
      '<p><span class="katex"><span class="katex-html">x</span><span class="katex-mathml"><math><annotation>x</annotation></math></span></span></p>',
    );
    expect(bare.problems).toEqual([
      '/foundations/plant/ "x": neither coloured nor listed with a reason',
    ]);
  });
});
