/**
 * What the reader's notebook does on a page, pinned before its loading changes (TanElk's
 * dispatch 114: "Tests alone first"). The store, storage, export and quarantine have their own
 * tests; nothing tested the mount: the bookmarks, the save menu, the recap line and the launcher.
 *
 * It mounts on a real section page rendered by PaperPage as the export renders it, so a change
 * to the page's passages fails here first. Layout is not available here, so the reading place
 * `remember()` records on scroll (it asks which passage is in view) is not covered.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { PaperPage } from "../PaperPage.tsx";
import { mountReaderNotebook, type RecapMemory } from "./browser.ts";
import { exportNotebookJson } from "./export.ts";
import { NotebookLauncher } from "./NotebookLauncher.tsx";
import { createNotebookStore, type NotebookStorage } from "./notebookStore.ts";
import { emptyNotebook } from "./schema.ts";

const PAPER = "light-quanta";
const SECTION = "s5";
const PAGE = { pathname: `/papers/${PAPER}/${SECTION}/`, search: "", hash: "" };
const TIMEOUT = 60_000;

let rendered: Promise<string> | null = null;
function sectionPage(): Promise<string> {
  rendered ??= (async () => exportMarkup(await PaperPage({ paperId: PAPER, section: SECTION })))();
  return rendered;
}

function memoryStorage(raw: string | null = null) {
  let value = raw;
  const storage: NotebookStorage = {
    maxBytes: 64_000,
    read: () => (value === null ? { status: "missing" } : { status: "ok", value }),
    write: (document) => {
      value = JSON.stringify(document);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve: () => {},
    discardFallback: () => {},
  };
  return { storage, saved: () => value };
}

function recapMemory(): RecapMemory & { dismissedHrefs: string[] } {
  const dismissedHrefs: string[] = [];
  return {
    dismissedHrefs,
    dismissed: () => dismissedHrefs.at(-1) ?? null,
    dismiss: (href) => {
      dismissedHrefs.push(href);
    },
  };
}

async function mount(raw: string | null = null, location = PAGE, memory = recapMemory()) {
  document.body.innerHTML = `<header><a id="trigger" href="/notebook/">Notebook</a><div id="host"></div></header><main id="main">${await sectionPage()}</main>`;
  const { storage, saved } = memoryStorage(raw);
  const store = createNotebookStore(storage);
  const dispose = mountReaderNotebook(
    document.getElementById("host") as HTMLElement,
    document.getElementById("trigger") as HTMLAnchorElement,
    store,
    () => location,
    memory,
  );
  const passages = [
    ...document.querySelectorAll<HTMLElement>("main article.reader-passage[data-unit][id]"),
  ];
  return { store, saved, dispose, passages, memory };
}

function frameFor(anchor: string) {
  return { paper: PAPER, anchor, view: "reading", detail: 1, lens: "paper", open: "" };
}

beforeEach(installDom);
afterEach(uninstallDom);

describe("without JavaScript", () => {
  test("the launcher is a real link to the notebook page, and nothing else is rendered", () => {
    expect(renderToStaticMarkup(<NotebookLauncher />)).toBe(
      '<a href="/notebook/">Notebook</a><div class="notebook-host"></div>',
    );
  });
});

describe("mounted on a reading page", () => {
  test(
    "every passage gets one bookmark, beside its heading",
    async () => {
      const { passages, dispose } = await mount();
      expect(passages.length).toBeGreaterThan(0);
      for (const passage of passages) {
        const toggles = passage.querySelectorAll(".notebook-save-toggle");
        expect(toggles.length).toBe(1);
        const controls = toggles[0]?.parentElement;
        expect(controls?.nextElementSibling?.tagName).toBe("H3");
        expect(toggles[0]?.hasAttribute("data-saved")).toBe(false);
      }
      dispose();
      expect(document.querySelectorAll(".notebook-save-toggle").length).toBe(0);
    },
    TIMEOUT,
  );

  test(
    "saving a question stores it, marks the bookmark, persists, and exports",
    async () => {
      const { passages, store, saved, dispose } = await mount();
      const passage = passages[0] as HTMLElement;
      const toggle = passage.querySelector<HTMLButtonElement>(".notebook-save-toggle");
      toggle?.click();
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      const save = [...passage.querySelectorAll<HTMLButtonElement>(".notebook-save-item")].find(
        (b) => b.textContent === "Save question",
      );
      expect(save).toBeTruthy();
      save?.click();

      const entries = store.getSnapshot().document.entries;
      expect(entries.length).toBe(1);
      expect(entries[0]?.kind).toBe("question");
      expect(entries[0]?.frame.paper).toBe(PAPER);
      expect(entries[0]?.frame.anchor).toBe(passage.id);
      const question = passage.querySelector(".passage-question")?.textContent?.trim() ?? "";
      expect(question.length).toBeGreaterThan(0);
      expect(entries[0]?.text).toBe(question);

      expect(toggle?.hasAttribute("data-saved")).toBe(true);
      expect(toggle?.getAttribute("aria-label")).toEndWith("(already in your notebook)");
      expect(saved()).toContain(passage.id);
      expect(exportNotebookJson(store.getSnapshot().document)).toContain(question);

      // The same question again is refused, and says so.
      if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
      [...passage.querySelectorAll<HTMLButtonElement>(".notebook-save-item")]
        .find((b) => b.textContent === "Save question")
        ?.click();
      expect(store.getSnapshot().document.entries.length).toBe(1);
      expect(document.querySelector(".notebook-announcement")?.textContent).toBe(
        "This entry is already in your notebook.",
      );
      dispose();
    },
    TIMEOUT,
  );

  test(
    "a notebook saved earlier marks exactly its passages when the page opens",
    async () => {
      const passageIds = [
        ...(await sectionPage()).matchAll(/<article[^>]*\sid="(arg-[a-z0-9-]+)"/g),
      ].map((m) => m[1] ?? "");
      const target = passageIds[passageIds.length - 1] ?? "";
      const document0 = {
        ...emptyNotebook(),
        entries: [
          {
            id: "n1",
            text: "An earlier question",
            kind: "question",
            frame: frameFor(target),
            title: "Earlier",
            createdAt: "2026-09-20T10:00:00.000Z",
          },
        ],
      };
      const { passages, dispose } = await mount(JSON.stringify(document0));
      for (const passage of passages)
        expect(passage.querySelector(".notebook-save-toggle")?.hasAttribute("data-saved")).toBe(
          passage.id === target,
        );
      dispose();
    },
    TIMEOUT,
  );

  test(
    "the Notebook link opens the notebook over the page",
    async () => {
      const { dispose } = await mount();
      const trigger = document.getElementById("trigger") as HTMLAnchorElement;
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      trigger.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(document.querySelector("dialog[open]")).toBeTruthy();
      dispose();
    },
    TIMEOUT,
  );
});

describe("the recap line", () => {
  const withPlace = (anchor: string) =>
    JSON.stringify({
      ...emptyNotebook(),
      lastPlace: {
        frame: frameFor(anchor),
        title: "Where you were",
        recap: "A recap.",
        recapKind: "authored-recap",
      },
    });

  test(
    "is offered on /papers/, links to the saved place, and dismissal is remembered",
    async () => {
      const papers = { pathname: "/papers/", search: "", hash: "" };
      const { dispose, memory } = await mount(
        withPlace("arg-lq-independent-configurations"),
        papers,
      );
      const line = document.querySelector(".notebook-recap");
      expect(line?.querySelector("a")?.textContent).toBe(
        "Continue where you left off: Where you were",
      );
      const href = line?.querySelector("a")?.getAttribute("href") ?? "";
      expect(href).toContain(`/papers/${PAPER}/`);
      line?.querySelector<HTMLButtonElement>(".notebook-recap-dismiss")?.click();
      expect(document.querySelector(".notebook-recap")).toBeNull();
      expect(memory.dismissedHrefs).toEqual([href]);
      dispose();
    },
    TIMEOUT,
  );

  test(
    "is not offered on a reading page",
    async () => {
      const { dispose } = await mount(withPlace("arg-lq-independent-configurations"));
      expect(document.querySelector(".notebook-recap")).toBeNull();
      dispose();
    },
    TIMEOUT,
  );
});
