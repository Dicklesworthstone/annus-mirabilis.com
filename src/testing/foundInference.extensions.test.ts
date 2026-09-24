import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { checkVoice } from "../content/checks/voice/index.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import type { FoundationExtensionSection } from "../content/schemas/reading.ts";
import { chiSquareQuantile } from "../physics/reference/diffusion/statistics.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-statistics-inference-pzqv: the inference extension sections on the slice's three
 * statistics lessons. "The sections cover estimators, interval coverage, bias under a nonlinear
 * transformation, identifiability, and observation noise. Each extension is a separate section
 * record owned here and rendered inside the slice node's page, so this bead never edits the slice
 * bead's records." Every number a section prints is recomputed here from the inputs it states.
 */

const ROOT = process.cwd();
const OWNER = "am-found-statistics-inference-pzqv";
const SECTIONS = {
  "mean-square-as-an-estimate": "mean-variance-rms",
  "sample-width-and-its-interval": "gaussian-distributions",
  "same-curve-different-causes": "distributions",
} as const;
type SectionId = keyof typeof SECTIONS;

const record = (id: SectionId): FoundationExtensionSection =>
  JSON.parse(readFileSync(join(ROOT, "content/foundations/extensions", `${id}.json`), "utf8"));
const text = (id: SectionId) =>
  record(id)
    .body.map((b) =>
      b.kind === "paragraph"
        ? b.text
        : b.kind === "steps"
          ? b.items.join(" ")
          : b.kind === "formula"
            ? `${b.latex} ${b.spoken}`
            : b.returnCaption,
    )
    .join(" ");
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;
const quantile = (q: number, p: number) => {
  const r = chiSquareQuantile(q, p);
  if (r.kind !== "accepted") throw new TypeError(`chi-square quantile refused for ${q}, ${p}`);
  return r.data;
};

describe("three records of their own, on the slice's lessons, which stay unedited", () => {
  for (const [id, lesson] of Object.entries(SECTIONS) as [SectionId, string][])
    test(`${id} extends ${lesson}`, () => {
      expect(record(id)).toMatchObject({
        kind: "foundation-extension",
        id,
        targetFoundation: `foundation:${lesson}`,
        ownerBead: OWNER,
      });
      const lessonText = readFileSync(join(ROOT, "content/foundations", `${lesson}.json`), "utf8");
      expect(JSON.parse(lessonText).extension).toBeUndefined();
      expect(lessonText).not.toContain(id);
    });

  test("the compiler attaches each to its lesson, and to no other", async () => {
    const { foundations } = compileReadingContent(await loadReadingFiles());
    for (const [id, lesson] of Object.entries(SECTIONS))
      expect(foundations.find((f) => f.id === lesson)?.extensionSections?.map((s) => s.id)).toEqual(
        [id],
      );
  });
});

describe("the five topics the bead names", () => {
  test("estimators, observation noise, interval coverage, bias under a turn, identifiability", () => {
    expect(text("mean-square-as-an-estimate")).toContain(
      "A sample's mean square is an estimate of it",
    );
    expect(text("mean-square-as-an-estimate")).toContain(
      "the step's mean square gains 2σ² per coordinate",
    );
    expect(text("mean-square-as-an-estimate")).toContain("with a covariance of −σ²");
    expect(text("sample-width-and-its-interval")).toContain(
      "this recipe catches the true D in 95 of every 100 of them",
    );
    expect(text("same-curve-different-causes")).toContain(
      "too large on average by the factor q/(q − 2) = 1.0204",
    );
    expect(text("same-curve-different-causes")).toContain(
      "only that product can be read from them",
    );
  });

  test("no section gives one interval a chance of holding D, and none fails the voice lint", () => {
    for (const id of Object.keys(SECTIONS) as SectionId[]) {
      expect(text(id)).not.toMatch(/\b(chance|probability) that (the|this) (true|interval)/i);
      const errors = checkVoice(`${record(id).title} ${text(id)}`, { context: "prose" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    }
  });
});

describe("every printed number, recomputed", () => {
  test("the mean square as an estimate: 2.5 μm²/s, spreads of 71 and 14 per cent", () => {
    const t = text("mean-square-as-an-estimate");
    const meanSquare = (9 + 1 + 1 + 9) / 4;
    expect(meanSquare).toBe(5);
    expect(printed(meanSquare / (2 * 1), 2.5, 2)).toBe(true);
    expect(t).toContain("mean square of 5 μm² would give D = 5 ÷ 2 = 2.5 μm² per second");
    expect(printed(100 * Math.sqrt(2 / 4), 71, 2)).toBe(true);
    expect(printed(100 * Math.sqrt(2 / 100), 14, 2)).toBe(true);
    expect(t).toContain("about 71 per cent of D");
    expect(t).toContain("With q = 100 it is about 14 per cent");
    // Halving the spread: √(2/(4q)) is half of √(2/q).
    expect(
      withinTolerance(Math.sqrt(2 / 400), Math.sqrt(2 / 100) / 2, { relative: 1e-12 }).ok,
    ).toBe(true);
  });

  test("reading error: 2σ² is 0.02 and 0.18 μm², 2 and 18 per cent of 2Dt = 1 μm²", () => {
    const t = text("mean-square-as-an-estimate");
    const twoDt = 2 * 0.5 * 1;
    expect(twoDt).toBe(1);
    expect(printed(2 * 0.1 ** 2, 0.02, 1)).toBe(true);
    expect(printed(2 * 0.3 ** 2, 0.18, 2)).toBe(true);
    expect(printed((100 * 2 * 0.1 ** 2) / twoDt, 2, 1)).toBe(true);
    expect(printed((100 * 2 * 0.3 ** 2) / twoDt, 18, 2)).toBe(true);
    expect(t).toContain(
      "σ = 0.1 μm adds 0.02 μm², 2 per cent; σ = 0.3 μm adds 0.18 μm², 18 per cent",
    );
  });

  test("chi-square at q = 100 and q = 4, through the owner", () => {
    const t = text("sample-width-and-its-interval");
    const [lo100, hi100] = [quantile(100, 0.025), quantile(100, 0.975)];
    expect(printed(lo100 / 100, 0.742, 3)).toBe(true);
    expect(printed(hi100 / 100, 1.296, 4)).toBe(true);
    expect(printed(Math.sqrt(lo100 / 100), 0.86, 2)).toBe(true);
    expect(printed(Math.sqrt(hi100 / 100), 1.14, 3)).toBe(true);
    expect(printed(hi100, 129.56, 5)).toBe(true);
    expect(printed(lo100, 74.22, 4)).toBe(true);
    expect(t).toContain("between 0.742 and 1.296 times 2Dt");
    expect(t).toContain("between 0.86 and 1.14 times the true width");
    expect(t).toContain("{129.56}");
    expect(t).toContain("{74.22}");

    const [lo4, hi4] = [quantile(4, 0.025), quantile(4, 0.975)];
    expect(printed(lo4 / 4, 0.121, 3)).toBe(true);
    expect(printed(hi4 / 4, 2.79, 3)).toBe(true);
    expect(printed(4 / lo4, 8, 1)).toBe(true);
    expect(hi4 / 4 < 3).toBe(true);
    expect(t).toContain("run from 0.121 to 2.79 times 2Dt");
    expect(t).toContain("about an eighth of the true one, or nearly three times it");
  });

  test("the turn: 12.5 against 12, about 4 per cent; q/(q − 2) = 1.0204, about 2 per cent", () => {
    const t = text("same-curve-different-causes");
    expect((4 + 6) / 2).toBe(5);
    const turned = (60 / 4 + 60 / 6) / 2;
    expect(turned).toBe(12.5);
    expect(60 / 5).toBe(12);
    expect(printed(100 * (turned / 12 - 1), 4, 1)).toBe(true);
    expect(printed(100 / 98, 1.0204, 5)).toBe(true);
    expect(printed(100 * (100 / 98 - 1), 2, 1)).toBe(true);
    // The ends swap: the larger D gives the smaller N.
    expect([60 / 6, 60 / 4]).toEqual([10, 15]);
    expect(t).toContain("whose average is 12.5, but 60 ÷ 5 is 12");
    expect(t).toContain("D between 4 and 6 is the same event as N between 10 and 15");
  });
});
