import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPaper } from "../content/server";
import { prerequisiteName } from "../equations/SemanticEquation.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperReader } from "./PaperReader.tsx";

/*
  A prerequisite link says which lesson it opens. Named by the equation note alone it could not:
  note titles repeat ("What it asserts" is on nine Brownian relations, "Particle radius" on three
  records), so on a section page one name led to as many as five different lessons. The whole-paper
  page cannot show this, because its explorer cards load on opening; the section pages render them.
*/
const PREFIX = "Read the prerequisite: ";

/** Each link's accessible name (aria-label, else its text) grouped to the set of its hrefs. */
function namesToHrefs(html: string): Map<string, Set<string>> {
  const byName = new Map<string, Set<string>>();
  for (const m of html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gis)) {
    const attrs = m[1] ?? "";
    const href = /href="([^"]*)"/i.exec(attrs)?.[1] ?? "";
    const name =
      /aria-label="([^"]*)"/i.exec(attrs)?.[1] ?? (m[2] ?? "").replace(/<[^>]+>/g, "").trim();
    byName.set(name, (byName.get(name) ?? new Set()).add(href));
  }
  return byName;
}

async function sectionPages() {
  const { paper } = await loadPaper("brownian-motion");
  return Promise.all(
    paper.sections.map(async (s) => ({
      id: s.id,
      html: await exportMarkup(await PaperReader({ section: s.id })),
    })),
  );
}

describe("equation prerequisite links name their lesson", () => {
  test("the name carries the lesson's title, and falls back to the note's without one", () => {
    expect(prerequisiteName("What it asserts", "Random walks")).toBe(
      "Read the prerequisite: Random walks, for What it asserts",
    );
    expect(prerequisiteName("What it asserts", undefined)).toBe(
      "Read the prerequisite: What it asserts",
    );
  });

  test("on every Brownian section page, each prerequisite name reaches one lesson", async () => {
    let names = 0;
    for (const { id, html } of await sectionPages()) {
      const byName = namesToHrefs(html);
      for (const [name, hrefs] of byName) {
        if (!name.startsWith(PREFIX)) continue;
        names++;
        expect({ section: id, name, destinations: hrefs.size }).toEqual({
          section: id,
          name,
          destinations: 1,
        });
        // The lesson is named, not only the note: a fallback name means a title went missing.
        expect(name).toContain(", for ");
      }
    }
    // Non-vacuity: the section pages render explorer cards with prerequisite links.
    expect(names).toBeGreaterThan(0);
  });

  test("planted negative: names made from the note title alone collide again", async () => {
    let collided = 0;
    for (const { html } of await sectionPages()) {
      const noteOnly = html.replace(
        /aria-label="Read the prerequisite: [^"]*, for ([^"]*)"/g,
        'aria-label="Read the prerequisite: $1"',
      );
      for (const [name, hrefs] of namesToHrefs(noteOnly))
        if (name.startsWith(PREFIX) && hrefs.size > 1) collided++;
    }
    expect(collided).toBeGreaterThan(0);
  });
});
