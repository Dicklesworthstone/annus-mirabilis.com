import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { attachSplitReader } from "./controller.ts";

let cleanup: (() => void) | undefined;
beforeEach(installDom);
afterEach(async () => {
  cleanup?.();
  cleanup = undefined;
  await uninstallDom();
});

function windowWidth(width: number) {
  (
    window as unknown as {
      happyDOM: { setWindowSize(size: { width: number; height: number }): void };
    }
  ).happyDOM.setWindowSize({ width, height: 900 });
}

function comparison(width = 1280, search = "", hash = "") {
  windowWidth(width);
  window.history.replaceState(
    null,
    "",
    `/papers/special-relativity/s1/view/split/${search}${hash}`,
  );
  const root = document.createElement("div");
  root.innerHTML = `
    <a data-split-section-link href="/papers/special-relativity/s0/view/split/">Introduction</a>
    <fieldset hidden disabled data-split-controls>
      <select data-split-source-choice><option>parallel</option><option>german</option><option>english</option></select>
      <select data-split-companion-choice><option>reading</option><option>results</option></select>
      <button data-split-swap>Swap pane order</button>
    </fieldset>
    <p data-split-notice hidden role="status"></p>
    <nav data-split-tabs><a id="split-source-tab" href="#split-source-pane" data-split-tab="source">German and English</a><a id="split-companion-tab" href="#split-companion-pane" data-split-tab="companion">Explanation</a></nav>
    <div data-split-columns>
      <section id="split-source-pane" data-split-role="source"><h2 id="split-source-heading" data-split-source-label>German and English</h2><a data-split-source-face-link href="/papers/special-relativity/s1/view/parallel/">Open source</a>
        <div id="split-row-s1-p1" data-split-source-row="s1-p1"><p data-split-language="german"><span id="s1-p1">Deutsch</span></p><p data-split-language="english"><span id="en-s1-p1-s1">English</span><a data-action="show-aligned-source" href="#s1-p1">Show source</a></p><a data-split-go="companion" href="#pane-b--argument">Explanation of this paragraph</a></div>
      </section>
      <section id="split-companion-pane" data-split-role="companion"><h2 id="split-companion-heading" data-split-companion-label>Explanation</h2><a data-split-companion-face-link href="/papers/special-relativity/s1/">Open explanation</a><div data-split-explanation><article id="pane-b--argument"><span id="argument"></span><p>Actual explanation content.</p><a href="#split-row-s1-p1" data-split-go="source">Read the source</a><details><summary>Steps</summary><p id="inside-step">An explained step</p></details></article></div><div data-split-results hidden><article id="result-energy">Actual result</article><a href="#pane-b--argument" data-split-go="explanation">Read this explanation</a></div></section>
    </div>`;
  document.body.append(root);
  cleanup = attachSplitReader(root, {
    paper: "special-relativity",
    section: "s1",
    sections: ["s0", "s1"],
    argumentSections: { argument: "s1" },
    sectionHrefs: {
      s0: "/papers/special-relativity/s0/view/split/",
      s1: "/papers/special-relativity/s1/view/split/",
    },
    faceHrefs: {
      parallel: "/papers/special-relativity/s1/view/parallel/",
      german: "/papers/special-relativity/s1/view/german/",
      english: "/papers/special-relativity/s1/view/english/",
      reading: "/papers/special-relativity/s1/",
      results: "/papers/special-relativity/s1/view/results/",
    },
  });
  return root;
}
const q = <T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T => {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing ${selector}`);
  return el;
};
function click(root: HTMLElement, selector: string, options: MouseEventInit = {}) {
  q(root, selector).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...options }),
  );
}
function change(root: HTMLElement, selector: string, value: string) {
  const select = q<HTMLSelectElement>(root, selector);
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("real split reader controller", () => {
  test("desktop has both full panes and source choice changes only the rendered language", () => {
    const root = comparison();
    expect(q(root, "[data-split-controls]").hidden).toBe(false);
    expect(q(root, "[data-split-role=source]").hidden).toBe(false);
    expect(q(root, "[data-split-role=companion]").hidden).toBe(false);
    change(root, "[data-split-source-choice]", "english");
    expect(q(root, "[data-split-language=german]").hidden).toBe(true);
    expect(q(root, "[data-split-language=english]").hidden).toBe(false);
    expect(new URL(window.location.href).searchParams.get("panes")).toBe("english,reading");
    expect(q<HTMLAnchorElement>(root, "[data-split-section-link]").search).toContain(
      "panes=english%2Creading",
    );
    expect(q(root, "[data-split-explanation]").textContent).toContain(
      "Actual explanation content.",
    );
  });

  for (const width of [320, 390]) {
    test(`${width}px tabs are keyboard-operable and cross-pane links reveal their target`, () => {
      const root = comparison(width);
      expect(q(root, "[data-split-tabs]").getAttribute("role")).toBe("tablist");
      expect(q(root, "[data-split-role=companion]").hidden).toBe(true);
      const sourceTab = q(root, "[data-split-tab=source]");
      sourceTab.focus();
      sourceTab.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
      expect(document.activeElement).toBe(q(root, "[data-split-tab=companion]"));
      expect(q(root, "[data-split-tab=companion]").getAttribute("aria-selected")).toBe("true");
      expect(q(root, "[data-split-role=source]").hidden).toBe(true);
      click(root, '[data-split-go="source"]');
      expect(q(root, "[data-split-role=source]").hidden).toBe(false);
      expect(window.location.hash).toBe("#split-row-s1-p1");
      click(root, '[data-split-go="companion"]');
      expect(q(root, "[data-split-role=companion]").hidden).toBe(false);
      expect(window.location.hash).toBe("#pane-b--argument");
    });
  }

  test("reversed custom pairs, result links and history restore the visible content", () => {
    const root = comparison(390, "?panes=results,english");
    expect(q(root, "[data-split-columns]").firstElementChild?.id).toBe("split-companion-pane");
    expect(q(root, "[data-split-results]").hidden).toBe(false);
    click(root, '[data-split-go="explanation"]');
    expect(q(root, "[data-split-results]").hidden).toBe(true);
    expect(q(root, "[data-split-explanation]").hidden).toBe(false);
    window.history.replaceState(
      null,
      "",
      "/papers/special-relativity/s1/view/split/?panes=german,results#result-energy",
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(q(root, "[data-split-results]").hidden).toBe(false);
    expect(q(root, "[data-split-role=companion]").hidden).toBe(false);
    expect(q(root, "[data-split-language=english]").hidden).toBe(true);
  });

  test("an incoming explanation fragment opens its pane and a nested native disclosure", () => {
    const root = comparison(320, "?panes=english,results", "#inside-step");
    expect(q(root, "[data-split-explanation]").hidden).toBe(false);
    expect(q(root, "[data-split-role=companion]").hidden).toBe(false);
    expect(q<HTMLDetailsElement>(root, "details").open).toBe(true);
  });

  test("the Results URL produced by controls survives reload and Back, including pane hashes", () => {
    const root = comparison(390);
    change(root, "[data-split-source-choice]", "english");
    change(root, "[data-split-companion-choice]", "results");
    const saved = new URL(window.location.href);
    expect(saved.hash).toBe("#split-companion-pane");
    expect(saved.searchParams.get("panes")).toBe("english,results");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(q(root, "[data-split-results]").hidden).toBe(false);
    expect(q<HTMLSelectElement>(root, "[data-split-companion-choice]").value).toBe("results");
    cleanup?.();
    cleanup = undefined;
    root.remove();
    const reloaded = comparison(390, saved.search, saved.hash);
    expect(q(reloaded, "[data-split-results]").hidden).toBe(false);
    click(reloaded, '[data-split-tab="source"]');
    click(reloaded, '[data-split-tab="companion"]');
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(q(reloaded, "[data-split-results]").hidden).toBe(false);
    expect(q(reloaded, "[data-split-explanation]").hidden).toBe(true);
  });

  test("unsupported pairs are disclosed and never represented by misleading selected labels", () => {
    const root = comparison(390, "?panes=gloss,facsimile");
    expect(q(root, "[data-split-notice]").hidden).toBe(false);
    expect(q(root, "[data-split-notice]").textContent).toContain("unavailable");
    expect(q<HTMLSelectElement>(root, "[data-split-source-choice]").value).toBe("parallel");
    expect(q<HTMLSelectElement>(root, "[data-split-companion-choice]").value).toBe("reading");
  });

  test("modified links preserve browser behavior, and cleanup stops responding", () => {
    const root = comparison(320);
    const link = q(root, '[data-split-go="companion"]');
    const modifiedClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    link.dispatchEvent(modifiedClick);
    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(q(root, "[data-split-role=companion]").hidden).toBe(true);
    cleanup?.();
    cleanup = undefined;
    expect(q(root, "[data-split-role=companion]").hidden).toBe(false);
    expect(q(root, "[data-split-controls]").hidden).toBe(true);
    change(root, "[data-split-source-choice]", "german");
    expect(q(root, "[data-split-language=english]").hidden).toBe(false);
  });
});
