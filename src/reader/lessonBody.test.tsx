/**
 * The clarification dialog loads a lesson's body when it opens (lessonBody.ts). These run the
 * loader against the lesson page the export really builds, rendered here by the page component
 * itself inside the layout's <main>, so a change to that page's structure fails here first.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import FoundationPage from "../app/foundations/[concept]/page.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import {
  extractLesson,
  lessonPageHref,
  loadLessonBody,
  type MountedConstruction,
} from "./lessonBody.ts";
import { PaperReader } from "./PaperReader.tsx";

async function lessonPage(concept: string): Promise<string> {
  const page = await FoundationPage({ params: Promise.resolve({ concept }) });
  // Rendered as the export renders it: a lesson's construction is a lazy island, which a cold
  // renderToStaticMarkup would leave out of the page this loader fetches.
  return `<!doctype html><html><body><main id="main">${await exportMarkup(page)}</main></body></html>`;
}

function slotFor(id: string): HTMLElement {
  const slot = document.createElement("div");
  slot.setAttribute("data-lesson-body", id);
  slot.innerHTML = '<p class="fine">Loading the lesson.</p>';
  document.body.append(slot);
  return slot;
}

function fetchFrom(pages: Record<string, string>, calls: string[] = []) {
  return (async (input: RequestInfo | URL) => {
    const href = String(input);
    calls.push(href);
    const html = pages[href];
    return new Response(html ?? "missing", { status: html ? 200 : 404 });
  }) as typeof fetch;
}

beforeEach(installDom);
afterEach(uninstallDom);

describe("extractLesson", () => {
  test("lifts the lesson from its page, one heading level down, with the dialog's landmark name", async () => {
    const html = await lessonPage("mean-variance-rms");
    const source = new DOMParser().parseFromString(html, "text/html");
    const before = source.querySelector("main .foundation-lesson");
    expect(before).not.toBeNull();
    const h2 = before?.querySelectorAll("h2").length ?? 0;
    expect(h2).toBeGreaterThan(0);

    const lesson = extractLesson(html, document);
    expect(lesson?.classList.contains("foundation-lesson")).toBe(true);
    // Every part heading moved from h2 (under the page's h1) to h3 (under the dialog's h2).
    expect(lesson?.querySelectorAll("h2").length).toBe(0);
    // Level by level: the page's h2s are the dialog's h3s, and its h3s its h4s.
    expect(lesson?.querySelectorAll("h3").length).toBe(h2);
    expect(lesson?.querySelectorAll("h4").length).toBe(before?.querySelectorAll("h3").length ?? 0);
    // The text is the page's text: same words, so nothing was dropped on the way in.
    expect(lesson?.textContent).toBe(before?.textContent);
    // The prerequisites landmark carries the dialog's context, as FoundationBody gives it there.
    for (const nav of lesson?.querySelectorAll('nav[aria-label^="Prerequisites for "]') ?? [])
      expect(nav.getAttribute("aria-label")?.endsWith("(clarification panel)")).toBe(true);
    // Lesson links still carry data-foundation, which the reader intercepts to open nested lessons.
    expect(lesson?.querySelectorAll("[data-foundation]").length).toBeGreaterThan(0);
  });

  test("a page with no lesson body gives null, not an empty lesson", () => {
    expect(
      extractLesson("<html><body><main><p>Not a lesson</p></main></body></html>", document),
    ).toBe(null);
  });
});

describe("loadLessonBody", () => {
  test("fills the slot once, and mounts a lesson's construction into its own slot", async () => {
    const calls: string[] = [];
    const mounts: string[] = [];
    const mount = (slot: HTMLElement, id: string): MountedConstruction => {
      mounts.push(`${id}:${slot.getAttribute("data-construction-slot")}:${slot.childNodes.length}`);
      return { unmount: () => {} };
    };
    const fetchImpl = fetchFrom(
      { [lessonPageHref("derivatives")]: await lessonPage("derivatives") },
      calls,
    );
    const slot = slotFor("derivatives");
    expect(await loadLessonBody(slot, { fetch: fetchImpl, mount })).toBe("loaded");
    expect(slot.dataset.lessonState).toBe("loaded");
    expect(slot.hasAttribute("aria-busy")).toBe(false);
    expect(slot.querySelector(".foundation-lesson")).not.toBeNull();
    // The copied construction is gone; an empty slot waits for the live one.
    expect(slot.querySelector(".foundation-construction, .foundation-extension")).toBeNull();
    expect(mounts).toEqual(["derivatives:derivatives:0"]);
    // A second open neither fetches nor mounts again.
    expect(await loadLessonBody(slot, { fetch: fetchImpl, mount })).toBe("skipped");
    expect(calls).toEqual([lessonPageHref("derivatives")]);
    expect(mounts.length).toBe(1);
  });

  test("a lesson with no construction mounts nothing", async () => {
    const mounts: string[] = [];
    const slot = slotFor("mean-variance-rms");
    const result = await loadLessonBody(slot, {
      fetch: fetchFrom({
        [lessonPageHref("mean-variance-rms")]: await lessonPage("mean-variance-rms"),
      }),
      mount: (_slot, id) => {
        mounts.push(id);
        return { unmount: () => {} };
      },
    });
    expect(result).toBe("loaded");
    expect(mounts).toEqual([]);
  });

  test("a failed fetch says so with a real link, and the next open tries again", async () => {
    const calls: string[] = [];
    const slot = slotFor("mean-variance-rms");
    expect(await loadLessonBody(slot, { fetch: fetchFrom({}, calls) })).toBe("failed");
    const link = slot.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/foundations/mean-variance-rms/");
    expect(slot.textContent).toContain("did not load here");
    expect(await loadLessonBody(slot, { fetch: fetchFrom({}, calls) })).toBe("failed");
    expect(calls.length).toBe(2);
  });

  test("a construction that cannot mount leaves the loaded lesson in place", async () => {
    const slot = slotFor("derivatives");
    const result = await loadLessonBody(slot, {
      fetch: fetchFrom({ [lessonPageHref("derivatives")]: await lessonPage("derivatives") }),
      mount: () => {
        throw new Error("chunk failed");
      },
    });
    expect(result).toBe("loaded");
    expect(slot.querySelector(".foundation-lesson")).not.toBeNull();
    expect(slot.querySelector("[data-construction-slot] a")?.getAttribute("href")).toBe(
      "/foundations/derivatives/",
    );
  });
});

describe("the paper page ships lesson titles, not lesson bodies", () => {
  test("every clarification panel has a heading and a load slot, and no lesson body", async () => {
    const html = await exportMarkup(await PaperReader());
    const page = new DOMParser().parseFromString(html, "text/html");
    const panels = [...page.querySelectorAll("[data-foundation-panel]")];
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) {
      const id = panel.getAttribute("data-foundation-panel");
      expect(panel.querySelector("h2")?.id).toBe(`clarification-${id}`);
      expect(panel.querySelector("[data-lesson-body]")?.getAttribute("data-lesson-body")).toBe(id);
      expect(panel.querySelector(".foundation-lesson")).toBeNull();
    }
  });
});
