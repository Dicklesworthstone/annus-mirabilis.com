/**
 * Einstein's printed references to his own relativity paper are links a reader can follow.
 *
 * The mass-energy paper cites the relativity paper three times: its footnote 1), "l. c. § 8" for
 * the light-energy transformation it imports, and "l. c. § 10" for the electron's kinetic energy.
 * Each is a reference inline in the German source block and in the aligned English unit, and each
 * must open the section it names. A target naming a paper or section that does not exist would
 * be a link to nothing, so every cross-paper target in the content is checked against the
 * paper's own section list.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { PAPER_SLUGS } from "../../content/schemas/source.pure.ts";
import { PaperPage } from "../PaperPage.tsx";
import { referenceHref } from "./referenceHref.ts";

const ROOT = process.cwd();

describe("referenceHref", () => {
  test("a paper, or a paper and section, opens that page", () => {
    expect(referenceHref("special-relativity/s8")).toBe("/papers/special-relativity/s8/");
    expect(referenceHref("special-relativity")).toBe("/papers/special-relativity/");
  });

  test("anything else stays an id on this page", () => {
    expect(referenceHref("s0-p4")).toBe("#s0-p4");
    // A first segment that is not a paper is not guessed at.
    expect(referenceHref("relativity/s8")).toBe("#relativity/s8");
    expect(referenceHref("special-relativity/s8/p1")).toBe("#special-relativity/s8/p1");
  });
});

type Found = { file: string; text: string; targetId: string };

function referencesIn(value: unknown, file: string, out: Found[]): void {
  if (Array.isArray(value)) {
    for (const v of value) referencesIn(v, file, out);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.kind === "reference" && typeof o.targetId === "string" && typeof o.text === "string")
      out.push({ file, text: o.text, targetId: o.targetId });
    for (const v of Object.values(o)) referencesIn(v, file, out);
  }
}

function contentReferences(): Found[] {
  const out: Found[] = [];
  for (const layer of ["source-blocks", "translation-units"]) {
    for (const paper of readdirSync(join(ROOT, "content", layer))) {
      const dir = join(ROOT, "content", layer, paper);
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
        const file = `content/${layer}/${paper}/${name}`;
        referencesIn(load(readFileSync(join(ROOT, file), "utf8")), file, out);
      }
    }
  }
  return out;
}

function sectionsOf(paper: string): string[] {
  const raw = JSON.parse(readFileSync(join(ROOT, "content/papers", `${paper}.json`), "utf8"));
  return (raw.sections as { id: string }[]).map((s) => s.id);
}

describe("every cross-paper reference in the content opens a page that exists", () => {
  const refs = contentReferences();
  const crossPaper = refs.filter((r) =>
    (PAPER_SLUGS as readonly string[]).includes(r.targetId.split("/")[0] ?? ""),
  );

  test("mass-energy's three printed references are links, in the German and the English", () => {
    // Identity, not census: these references are printed on p. 639 and p. 641 and never change.
    for (const layer of ["source-blocks", "translation-units"]) {
      const here = crossPaper.filter((r) => r.file.startsWith(`content/${layer}/mass-energy/`));
      expect(here.map((r) => `${r.text} -> ${r.targetId}`).sort()).toEqual([
        "Ann. d. Phys. 17. p. 891. 1905 -> special-relativity",
        "l. c. § 10 -> special-relativity/s10",
        "l. c. § 8 -> special-relativity/s8",
      ]);
    }
  });

  test("each target's paper and section exist", () => {
    // Non-vacuity: without the mass-energy references this loop would check nothing.
    expect(crossPaper.length).toBeGreaterThan(0);
    for (const r of crossPaper) {
      const [paper, section] = r.targetId.split("/");
      const sections = sectionsOf(paper as string);
      if (section)
        expect({ file: r.file, section, ok: sections.includes(section) }).toEqual({
          file: r.file,
          section,
          ok: true,
        });
    }
  });
});

describe("the reader can follow them", () => {
  // The English face renders the translation units, and the parallel face renders both the German
  // source blocks and the English units, so it carries each link twice. The German face is not
  // tested here: mass-energy's is still the draft face, drawn from the ledger, not the blocks.
  test("mass-energy's English face links § 8, § 10 and footnote 1) to the relativity paper", async () => {
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: "mass-energy", face: "english" } as never),
    );
    expect(html).toMatch(/href="\/papers\/special-relativity\/s8\/"[^>]*>l\. c\. § 8</);
    expect(html).toMatch(/href="\/papers\/special-relativity\/s10\/"[^>]*>l\. c\. § 10</);
    expect(html).toMatch(/href="\/papers\/special-relativity\/"[^>]*>Ann\. d\. Phys\. 17/);
  });

  test("the parallel face carries each link in both columns", async () => {
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: "mass-energy", face: "parallel" } as never),
    );
    const count = (href: string) => html.split(`href="${href}"`).length - 1;
    expect(count("/papers/special-relativity/s8/")).toBe(2);
    expect(count("/papers/special-relativity/s10/")).toBe(2);
    expect(count("/papers/special-relativity/")).toBe(2);
  });
});
