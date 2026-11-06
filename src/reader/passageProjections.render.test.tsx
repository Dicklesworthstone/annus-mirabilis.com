import { describe, expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import type { ReactElement } from "react";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { groupTranslationUnits } from "./faces/TranslationParagraphs.tsx";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

const papers = ["mass-energy", "brownian-motion", "light-quanta", "special-relativity"] as const;
type PaperId = (typeof papers)[number];

async function journey(paperId: PaperId): Promise<ReactElement> {
  switch (paperId) {
    case "mass-energy":
      return (await import("../app/discover/mass-energy/page.tsx")).default();
    case "brownian-motion":
      return (await import("../app/discover/brownian-motion/page.tsx")).default();
    case "light-quanta":
      return (await import("../app/discover/light-quanta/page.tsx")).default();
    case "special-relativity":
      return (await import("../app/discover/special-relativity/page.tsx")).default();
  }
}

type Rendered = Readonly<{
  ids: ReadonlyMap<string, number>;
  menus: ReadonlyMap<string, readonly string[]>;
  gzipBytes: number;
}>;

/** Keep only anchors and menu links, so the four large source editions need not stay in memory. */
async function capture(element: ReactElement): Promise<Rendered> {
  const html = await exportMarkup(element);
  const ids = new Map<string, number>();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) {
    const id = match[1] as string;
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  const menus = new Map<string, readonly string[]>();
  for (const match of html.matchAll(
    /<details\b[^>]*data-passage-projections="([^"]+)"[^>]*>([\s\S]*?)<\/details>/g,
  )) {
    const anchor = match[1] as string;
    const body = match[2] as string;
    expect(menus.has(anchor)).toBe(false);
    expect(body).toContain("<summary");
    expect(body).not.toContain("<button");
    expect([...body.matchAll(/data-projection="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "german",
      "english",
      "explanation",
      "instrument",
      "journey",
    ]);
    menus.set(
      anchor,
      [...body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*data-passage-projection-link/g)].map(
        (m) => m[1] as string,
      ),
    );
  }
  return { ids, menus, gzipBytes: gzipSync(html).byteLength };
}

describe("passage projections in the actual static reader routes", () => {
  for (const paperId of papers) {
    test(`${paperId}: source, translation, explanation and journey destinations are real rendered anchors`, async () => {
      const edition = await loadBilingualEdition(paperId);
      if (!edition) throw new Error(`missing edition for ${paperId}`);
      const payload = await loadPaper(paperId);
      const german = await capture(await PaperPage({ paperId, face: "german" }));
      const english = await capture(await PaperPage({ paperId, face: "english" }));
      const parallel = await capture(await PaperPage({ paperId, face: "parallel" }));
      const explanation = await capture(
        paperId === "brownian-motion" ? await PaperReader() : await PaperPage({ paperId }),
      );
      const discovery = await capture(await journey(paperId));
      const rendered = new Map<string, Rendered>([
        [`/papers/${paperId}/view/german/`, german],
        [`/papers/${paperId}/view/english/`, english],
        [`/papers/${paperId}/view/parallel/`, parallel],
        [`/papers/${paperId}/`, explanation],
        [`/discover/${paperId}/`, discovery],
      ]);
      const paragraphs = edition.blocks.filter(
        (b) => b.kind === "paragraph" || b.kind === "footnote",
      );
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(german.menus.size).toBe(paragraphs.length);
      for (const paragraph of paragraphs) expect(german.menus.has(paragraph.id)).toBe(true);
      const englishGroups = groupTranslationUnits(
        edition.units,
        edition.alignment,
        edition.blocks,
      ).filter((g) => g.kind === "paragraph" || g.kind === "footnote");
      expect(english.menus.size).toBe(englishGroups.length);
      expect(parallel.menus.size).toBeGreaterThan(0);
      for (const group of englishGroups)
        expect(english.menus.has(group.units[0]?.id ?? "")).toBe(true);
      for (const anchor of parallel.menus.keys()) expect(anchor.startsWith("en-")).toBe(true);
      expect(explanation.menus.size).toBe(payload.arguments.length);
      for (const argument of payload.arguments)
        expect(explanation.menus.has(argument.id)).toBe(true);

      let checked = 0;
      let journeyLinks = 0;
      for (const [path, page] of rendered) {
        for (const [anchor, links] of page.menus) {
          expect(page.ids.get(anchor), `${path} departure ${anchor}`).toBe(1);
          expect(links.length).toBeGreaterThan(0);
          for (const href of links) {
            const url = new URL(href, "https://annus.example");
            if (!url.hash) continue; // Laboratory routes are covered by the corpus manifest test.
            const target = rendered.get(url.pathname);
            expect(target, `${path} → ${href}`).toBeDefined();
            expect(target?.ids.get(decodeURIComponent(url.hash.slice(1))), href).toBe(1);
            if (url.pathname.startsWith("/discover/")) journeyLinks++;
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(paragraphs.length * 2);
      expect(journeyLinks).toBeGreaterThan(0);
      console.log(
        `[rendered passage projections] ${paperId}: ${german.menus.size} German, ` +
          `${english.menus.size} English, ${parallel.menus.size} parallel, ` +
          `${explanation.menus.size} explanation menus; ` +
          `${checked} exact destinations; ${journeyLinks} journey links; ` +
          `server markup gzip bytes ${JSON.stringify(
            Object.fromEntries([...rendered].map(([path, page]) => [path, page.gzipBytes])),
          )}`,
      );
    }, 60_000);
  }
});
