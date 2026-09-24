/**
 * A whole-paper page loads each passage's steps from its section page when they open
 * (stepsBody.ts). These run the loader between the two pages the export really builds, rendered
 * here by PaperPage itself, so a change to either page's structure fails here first.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { CONSTRUCTION_SELECTOR } from "./lessonBody.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";
import { extractSteps, forgetStepsPages, loadStepsBody } from "./stepsBody.ts";

const PAPER = "special-relativity";
let wholePage = "";
const sectionPages: Record<string, string> = {};

/*
  The pages render once, on the first test that needs them, inside that test's own timeout: the
  whole paper and its section pages take seconds, and bun:test's typed beforeAll takes no timeout.
*/
let rendered: Promise<void> | null = null;
function renderPages(): Promise<void> {
  rendered ??= (async () => {
    wholePage = await exportMarkup(await PaperPage({ paperId: PAPER }));
    const sections = new Set(
      [...wholePage.matchAll(/data-steps-src="\/papers\/special-relativity\/([a-z0-9-]+)\/"/g)].map(
        (m) => m[1] ?? "",
      ),
    );
    for (const section of sections)
      sectionPages[`/papers/${PAPER}/${section}/`] =
        `<!doctype html><html><body><main id="main">${await exportMarkup(
          await PaperPage({ paperId: PAPER, section }),
        )}</main></body></html>`;
  })();
  return rendered;
}
const RENDER_TIMEOUT = 120_000;

beforeEach(() => {
  installDom();
  forgetStepsPages();
});
afterEach(uninstallDom);

function fetchFrom(pages: Record<string, string>, calls: string[] = []) {
  return (async (input: RequestInfo | URL) => {
    const href = String(input);
    calls.push(href);
    const html = pages[href];
    return new Response(html ?? "missing", { status: html ? 200 : 404 });
  }) as typeof fetch;
}

/** Everything in a steps disclosure after its summary, with constructions left out. */
function stepsText(details: Element): string {
  const copy = details.cloneNode(true) as Element;
  copy.querySelector(":scope > summary")?.remove();
  for (const c of copy.querySelectorAll(`${CONSTRUCTION_SELECTOR}, [data-construction-slot]`))
    c.remove();
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

function mountWholePage(): HTMLElement[] {
  document.body.innerHTML = `<main id="main">${wholePage}</main>`;
  return [...document.querySelectorAll<HTMLElement>("[data-steps-body]")];
}

describe("the whole-paper page", () => {
  test(
    "holds a link in place of every passage's steps, and the section page holds the steps",
    async () => {
      await renderPages();
      const placeholders = mountWholePage();
      const units = document.querySelectorAll("article[data-unit]").length;
      expect(units).toBeGreaterThan(0);
      // One placeholder per passage, each the only thing after its disclosure's summary.
      expect(placeholders.length).toBe(units);
      for (const p of placeholders) {
        const details = p.parentElement;
        expect(details?.matches('details.local-steps[data-reading="2"]')).toBe(true);
        expect(details?.children.length).toBe(2);
        // The disclosure's section is the section page it names, and the link goes to the passage.
        const section = details?.closest("section.reader-section")?.id;
        const argument = p.getAttribute("data-steps-body");
        expect(p.dataset.stepsSrc).toBe(`/papers/${PAPER}/${section}/`);
        expect(p.querySelector("a")?.getAttribute("href")).toBe(
          `/papers/${PAPER}/${section}/#${argument}`,
        );
      }
      // No steps blocks were rendered here: no embedded lesson and no derivation list inside R2.
      expect(document.querySelectorAll('details[data-reading="2"] .foundation-inline').length).toBe(
        0,
      );
      // Every section page does render its passages' steps inline, with no placeholder.
      for (const html of Object.values(sectionPages)) {
        expect(html).not.toContain("data-steps-body");
        expect(html).toContain('<details class="local-steps reading-version" data-reading="2">');
      }
    },
    RENDER_TIMEOUT,
  );
});

describe("extractSteps", () => {
  test(
    "lifts one passage's steps from its section page, without the summary",
    async () => {
      await renderPages();
      const placeholders = mountWholePage();
      const p = placeholders[0];
      const argument = p?.getAttribute("data-steps-body") ?? "";
      const html = sectionPages[p?.dataset.stepsSrc ?? ""] ?? "";
      const source = new DOMParser()
        .parseFromString(html, "text/html")
        .getElementById(argument)
        ?.querySelector('details[data-reading="2"]');
      expect(source).toBeTruthy();
      const nodes = extractSteps(html, argument, document);
      expect(nodes?.length).toBeGreaterThan(0);
      const holder = document.createElement("div");
      holder.append(...(nodes ?? []));
      expect(holder.querySelector("summary")).toBeNull();
      // Compare like with like: the source side drops embedded lessons' constructions (stepsText),
      // so the lifted side does too. loadStepsBody mounts them afresh rather than reusing this
      // markup, and a passage whose steps embed a lesson with a construction made the one-sided
      // comparison fail on text that is present, as it should be, on both sides.
      for (const c of holder.querySelectorAll(`${CONSTRUCTION_SELECTOR}, [data-construction-slot]`))
        c.remove();
      const text = (holder.textContent ?? "").replace(/\s+/g, " ").trim();
      expect(text.length).toBeGreaterThan(200);
      expect(text).toBe(stepsText(source as Element));
    },
    RENDER_TIMEOUT,
  );

  test(
    "a page without the passage, or a malformed id, gives null",
    async () => {
      await renderPages();
      const html = Object.values(sectionPages)[0] ?? "";
      expect(extractSteps(html, "arg-no-such-passage", document)).toBeNull();
      expect(extractSteps(html, "not an id", document)).toBeNull();
      expect(extractSteps("<p>No steps</p>", "arg-sr-synchronization", document)).toBeNull();
    },
    RENDER_TIMEOUT,
  );
});

describe("loadStepsBody", () => {
  test(
    "fills every passage, fetching each section page once, and mounts constructions at their level",
    async () => {
      await renderPages();
      const placeholders = mountWholePage();
      const calls: string[] = [];
      const mounts: string[] = [];
      const results = await Promise.all(
        placeholders.map((p) =>
          loadStepsBody(p, {
            fetch: fetchFrom(sectionPages, calls),
            mount: (slot, id, level) => {
              mounts.push(`${id}@${level}`);
              slot.textContent = `mounted ${id}`;
              return { unmount: () => {} };
            },
          }),
        ),
      );
      expect(results.every((r) => r === "loaded")).toBe(true);
      expect([...calls].sort()).toEqual(Object.keys(sectionPages).sort());
      expect(document.querySelectorAll("[data-steps-body]").length).toBe(0);

      // Each disclosure now reads as its section page's does, summary and constructions aside.
      const expectedMounts: string[] = [];
      for (const details of document.querySelectorAll<HTMLDetailsElement>(
        'details[data-reading="2"]',
      )) {
        expect(details.dataset.stepsState).toBe("loaded");
        expect(details.hasAttribute("aria-busy")).toBe(false);
        const article = details.closest("article");
        const section = details.closest("section.reader-section")?.id;
        const source = new DOMParser()
          .parseFromString(sectionPages[`/papers/${PAPER}/${section}/`] ?? "", "text/html")
          .getElementById(article?.id ?? "")
          ?.querySelector('details[data-reading="2"]');
        expect(stepsText(details)).toBe(stepsText(source as Element));
        for (const c of source?.querySelectorAll(CONSTRUCTION_SELECTOR) ?? [])
          expectedMounts.push(
            `${c.getAttribute("data-foundation-construction")}@${c.querySelector("h2, h3, h4, h5")?.tagName.slice(1)}`,
          );
      }
      // The constructions the section page runs are the ones mounted here, at the same depth.
      expect(expectedMounts.length).toBeGreaterThan(0);
      expect(mounts.sort()).toEqual(expectedMounts.sort());
      expect(document.querySelectorAll(CONSTRUCTION_SELECTOR).length).toBe(0);

      // Lifting brought in no id the page already had.
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      expect(ids.length).toBe(new Set(ids).size);

      // Loaded is loaded: a second call does nothing.
      const again = document.querySelector<HTMLElement>('details[data-reading="2"] > *');
      expect(await loadStepsBody(again as HTMLElement)).toBe("skipped");
    },
    RENDER_TIMEOUT,
  );

  test(
    "a failed load keeps the link, says so once, and loads on the next opening",
    async () => {
      await renderPages();
      const [p] = mountWholePage();
      const details = p?.parentElement as HTMLDetailsElement;
      expect(await loadStepsBody(p as HTMLElement, { fetch: fetchFrom({}) })).toBe("failed");
      expect(details.dataset.stepsState).toBe("failed");
      expect(p?.isConnected).toBe(true);
      expect(p?.querySelector("a")?.getAttribute("href")).toContain(`/papers/${PAPER}/`);
      expect(p?.textContent).toContain("The steps did not load here.");
      // The failure was not remembered: the next opening fetches again and fills the passage.
      expect(await loadStepsBody(p as HTMLElement, { fetch: fetchFrom({}) })).toBe("failed");
      expect(p?.querySelectorAll("[data-steps-failed]").length).toBe(1);
      const calls: string[] = [];
      expect(
        await loadStepsBody(p as HTMLElement, {
          fetch: fetchFrom(sectionPages, calls),
          mount: () => ({ unmount: () => {} }),
        }),
      ).toBe("loaded");
      expect(calls.length).toBe(1);
      expect(details.querySelector("[data-steps-body]")).toBeNull();
    },
    RENDER_TIMEOUT,
  );

  test(
    "a placeholder naming no section page is refused without a fetch",
    async () => {
      await renderPages();
      const [p] = mountWholePage();
      p?.setAttribute("data-steps-src", "https://example.com/");
      const calls: string[] = [];
      expect(await loadStepsBody(p as HTMLElement, { fetch: fetchFrom(sectionPages, calls) })).toBe(
        "failed",
      );
      expect(calls.length).toBe(0);
    },
    RENDER_TIMEOUT,
  );
});

/*
  Brownian motion is rendered by PaperReader, not PaperPage (d16a45ca). Its steps embed whole
  lessons, so they were nearly half its page; the same loader lifts them from its section pages.
*/
let brownian: Promise<{ whole: string; sections: Record<string, string> }> | null = null;
function brownianPages() {
  brownian ??= (async () => {
    const whole = await exportMarkup(await PaperReader({}));
    const sections: Record<string, string> = {};
    for (const m of whole.matchAll(/data-steps-src="(\/papers\/brownian-motion\/[a-z0-9-]+\/)"/g)) {
      const src = m[1] ?? "";
      const section = src.split("/")[3] ?? "";
      sections[src] ??= `<!doctype html><html><body><main id="main">${await exportMarkup(
        await PaperReader({ section }),
      )}</main></body></html>`;
    }
    return { whole, sections };
  })();
  return brownian;
}

describe("Brownian motion's whole-paper page (PaperReader)", () => {
  test(
    "holds a link for every passage's steps, and lifts each from its section page",
    async () => {
      const { whole, sections } = await brownianPages();
      document.body.innerHTML = `<main id="main">${whole}</main>`;
      const units = document.querySelectorAll("article[data-unit]").length;
      const placeholders = [...document.querySelectorAll<HTMLElement>("[data-steps-body]")];
      expect(units).toBeGreaterThan(0);
      expect(placeholders.length).toBe(units);
      expect(document.querySelectorAll('details[data-reading="2"] .foundation-inline').length).toBe(
        0,
      );
      const results = await Promise.all(
        placeholders.map((p) =>
          loadStepsBody(p, { fetch: fetchFrom(sections), mount: () => ({ unmount: () => {} }) }),
        ),
      );
      expect(results.every((r) => r === "loaded")).toBe(true);
      // Each passage now reads as its section page's does, embedded lessons included.
      for (const details of document.querySelectorAll('details[data-reading="2"]')) {
        const id = details.closest("article")?.id ?? "";
        const section = details.closest("section.reader-section")?.id;
        const source = new DOMParser()
          .parseFromString(sections[`/papers/brownian-motion/${section}/`] ?? "", "text/html")
          .getElementById(id)
          ?.querySelector('details[data-reading="2"]');
        expect(stepsText(details)).toBe(stepsText(source as Element));
      }
      expect(
        document.querySelectorAll('details[data-reading="2"] .foundation-inline').length,
      ).toBeGreaterThan(0);
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      expect(ids.length).toBe(new Set(ids).size);
    },
    RENDER_TIMEOUT,
  );
});
