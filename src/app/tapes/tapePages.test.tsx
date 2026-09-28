/**
 * The teaching-tape pages render what the records hold (am-2rl9).
 *
 * The point of these pages is that a reader can reach a tape at all: measured 2026-09-27, all 21
 * authored tapes reached no reader by any route. So the assertions here are about reachability and
 * about honesty, not about layout.
 *
 * WHAT IT DOES NOT CLAIM. Rendering here is not the built page. An island's placement and what a
 * reader without JavaScript sees are answered by a built page and a browser; these pages carry no
 * island and no script, which is why a server render is close to the whole story for them, but it is
 * not the whole story.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import TapePage from "./[tape]/page.tsx";
import TapesIndex from "./page.tsx";

const { tapes } = loadTeachingTapes();

function dom(html: string) {
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("the teaching-tape pages", () => {
  test("the index lists every tape, and links each to its instrument", () => {
    const document = dom(renderToStaticMarkup(TapesIndex()));
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(tapes.length).toBeGreaterThan(15);
    const missing = tapes
      .filter((t) => !hrefs.includes(`/tapes/${t.tapeId}/`))
      .map((t) => t.tapeId);
    expect(missing).toEqual([]);
    for (const experimentId of new Set(tapes.map((t) => t.experimentId)))
      expect(hrefs, `no link to ${experimentId}`).toContain(`/lab/${experimentId}/`);
  });

  test("every tape's own page renders its title, its steps and its recorded numbers", async () => {
    let stepsSeen = 0;
    let numbersSeen = 0;
    for (const tape of tapes) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const document = dom(html);
      expect(document.querySelector("h1")?.textContent, tape.tapeId).toBe(tape.title);
      const items = document.querySelectorAll(".tape-steps > li");
      expect(items.length, `${tape.tapeId} rendered no step`).toBe(tape.steps.length);
      stepsSeen += items.length;
      const text = document.body.textContent ?? "";
      // The LINK, not the id in the prose. The page used to print the raw "sr-03" beside the
      // instrument's name and this read it out of the body text; it now shows "SR-03" and the
      // lowercase id lives only in the address. Reading the anchor is the stronger form of the
      // same question, and it is the one the assertion's message was always asking.
      const labHrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
      expect(
        labHrefs.some((href) => href.startsWith(`/lab/${tape.experimentId}/`)),
        `${tape.tapeId} does not link its instrument`,
      ).toBe(true);
      for (const step of tape.steps)
        for (const value of step.expected) {
          numbersSeen += 1;
          expect(text, `${tape.tapeId} drops ${value.label}`).toContain(value.label);
          expect(text, `${tape.tapeId} drops the value of ${value.label}`).toContain(
            String(value.value),
          );
        }
    }
    // Both loops must have run: 34 steps and 16 carrying numbers on 2026-09-27.
    expect(stepsSeen).toBeGreaterThan(20);
    expect(numbersSeen).toBeGreaterThan(0);
  });

  test("every walkthrough leads back to the passage its instrument interrogates", async () => {
    // The link is generated from the instrument's manifest `sourceRefs`, so this asserts two
    // separate things and says which is which: that every declared reference names a section
    // that EXISTS, read from the paper records here rather than through the tape loader, and
    // that the page renders a link for each one.
    const papers = new Map<string, Set<string>>();
    for (const file of readdirSync(join(process.cwd(), "content", "papers"))) {
      if (!file.endsWith(".json")) continue;
      const record = JSON.parse(
        readFileSync(join(process.cwd(), "content", "papers", file), "utf8"),
      ) as { id?: string; sections?: { id?: string }[] };
      const slug = file.replace(/\.json$/, "");
      papers.set(slug, new Set((record.sections ?? []).map((x) => String(x.id))));
    }
    expect(papers.size).toBeGreaterThan(3);

    // THE MANIFESTS, NOT THE LOADER'S OUTPUT. The first version of this read `tape.passages`,
    // which is what the loader has already resolved: a reference to a section that does not exist
    // is DROPPED there, so the check could only ever see references that resolve. Planting
    // `id: s99` in sr-03's manifest left it green at 24 links instead of 25. Reading the manifests
    // here is what makes a dangling reference visible.
    const dangling: string[] = [];
    for (const file of readdirSync(join(process.cwd(), "content", "experiments"))) {
      if (!file.endsWith(".yaml")) continue;
      const manifest = parseYaml(
        readFileSync(join(process.cwd(), "content", "experiments", file), "utf8"),
      ) as { sourceRefs?: { paper?: string; id?: string }[] };
      for (const ref of manifest.sourceRefs ?? []) {
        const sections = papers.get(String(ref.paper));
        if (!sections) dangling.push(`${file}: no paper ${String(ref.paper)}`);
        else if (!sections.has(String(ref.id)))
          dangling.push(`${file}: ${String(ref.paper)} has no section ${String(ref.id)}`);
      }
    }

    let links = 0;
    for (const tape of tapes) {
      for (const passage of tape.passages) {
        expect(passage.href).toBe(`/papers/${passage.paper}/${passage.sectionId}/`);
        links += 1;
      }
      if (tape.passages.length === 0) continue;
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const hrefs = [...dom(html).querySelectorAll("nav.tape-onward a")].map((a) =>
        a.getAttribute("href"),
      );
      expect(hrefs, `${tape.tapeId} does not link its passages`).toEqual(
        tape.passages.map((x) => x.href),
      );
    }
    expect(dangling).toEqual([]);
    console.log(`[tape passages] ${links} links from ${tapes.length} walkthroughs into the papers`);
    // Non-vacuity: a resolver that returned nothing would satisfy every assertion above.
    expect(links).toBeGreaterThan(15);
  });

  test("a tape page says the numbers are recorded, not computed", async () => {
    const first = tapes[0];
    expect(first).toBeDefined();
    if (!first) return;
    const html = renderToStaticMarkup(
      await TapePage({ params: Promise.resolve({ tape: first.tapeId }) }),
    );
    const text = dom(html).body.textContent ?? "";
    // The honesty line is the reason this page may show numbers at all: without it the page would
    // read as an instrument's output, which it is not.
    expect(text).toContain("not a result this page computed");
    expect(text).toContain("Nothing here runs the instrument");
  });

  test("every page is reachable with no script: no button, and every control is an anchor", async () => {
    const pages = [renderToStaticMarkup(TapesIndex())];
    for (const tape of tapes.slice(0, 4))
      pages.push(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
    for (const html of pages) {
      const document = dom(html);
      // noScriptControls.ts hides every enabled button when scripts do not run, so a page whose way
      // onward is a button has no way onward. These pages have none by construction; this keeps it so.
      expect(document.querySelectorAll("button").length).toBe(0);
      expect(document.querySelectorAll("a").length).toBeGreaterThan(0);
    }
  });
});
