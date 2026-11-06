import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { openCommandPalette } from "../../search/CommandPalette.ts";
import { createSearchEngine } from "../../search/core.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { revealTimelineTarget } from "./filters.ts";
import { TimelineFilters } from "./TimelineFilters.tsx";

let mounted: Root;
let content: HTMLElement;

beforeEach(async () => {
  await installDom();
  window.history.replaceState(null, "", "/timeline/");
  document.body.innerHTML = `
    <article id="timeline-content">
      <div id="filters"></div>
      <section id="timeline-year-1905"><article id="t-received">The paper dates</article></section>
      <section id="timeline-long-arc">
        <section id="t-boundary-1904">The boundary</section>
        <div id="timeline-post-1904"><article id="t-parallel">Parallel work</article></div>
      </section>
      <section id="timeline-later-confirmations"><article id="t-later">Later evidence</article></section>
      <a href="#timeline-later-confirmations">Later evidence track</a>
    </article>`;
  content = document.getElementById("timeline-content") as HTMLElement;
  mounted = createRoot(document.getElementById("filters") as HTMLElement);
  await act(async () => mounted.render(<TimelineFilters />));
});
afterEach(async () => {
  await act(async () => mounted.unmount());
  await uninstallDom();
});

function checkbox(group: string): HTMLInputElement {
  return content.querySelector(`input[aria-controls="${group}"]`) as HTMLInputElement;
}

describe("the mounted timeline filters", () => {
  test("hiding supplementary groups leaves paper dates and the boundary readable", async () => {
    expect(content.querySelector("fieldset")?.hidden).toBe(false);
    await act(async () => {
      checkbox("timeline-post-1904").click();
      checkbox("timeline-later-confirmations").click();
    });
    expect(document.getElementById("timeline-post-1904")?.hidden).toBe(true);
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
    expect(document.getElementById("t-received")?.closest("[hidden]")).toBeNull();
    expect(document.getElementById("t-boundary-1904")?.closest("[hidden]")).toBeNull();
  });

  test("a followed fragment restores its group and synchronizes the checkbox", async () => {
    await act(async () => checkbox("timeline-later-confirmations").click());
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
    await act(async () => {
      window.location.hash = "#t-later";
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(false);
    expect(checkbox("timeline-later-confirmations").checked).toBe(true);
  });

  test("a link to the current fragment still works after that track has been hidden", async () => {
    window.location.hash = "#timeline-later-confirmations";
    await act(async () => checkbox("timeline-later-confirmations").click());
    await act(async () => {
      content.querySelector<HTMLAnchorElement>('a[href="#timeline-later-confirmations"]')?.click();
    });
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(false);
    expect(checkbox("timeline-later-confirmations").checked).toBe(true);
  });

  test("a full-route link outside the timeline reopens an unchanged fragment", async () => {
    await act(async () => {
      window.history.replaceState(null, "", "/timeline/#t-later");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const link = document.createElement("a");
    link.href = "/timeline/#t-later";
    document.body.append(link);
    await act(async () => checkbox("timeline-later-confirmations").click());
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
    await act(async () => link.click());
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(false);
    expect(checkbox("timeline-later-confirmations").checked).toBe(true);
  });

  test("keyboard selection in the real search palette reveals the same hidden destination", async () => {
    await act(async () => {
      window.history.replaceState(null, "", "/timeline/#t-later");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => checkbox("timeline-later-confirmations").click());
    const engine = createSearchEngine([
      {
        id: "timeline:later",
        type: "timeline",
        paper: "light-quanta",
        section: "",
        lang: "en",
        title: "Later evidence",
        text: "The later experimental test.",
        terms: [],
        route: "/timeline/",
        anchor: "t-later",
        face: "",
        scopeLabel: "Later evidence",
      },
    ]);
    let close = () => {};
    let destination = "";
    try {
      await act(async () => {
        close = openCommandPalette({
          load: async () => ({ engine, buildDigest: "test", profile: "scaffold", papers: [] }),
          navigate: (href) => {
            destination = href;
            // The target must be visible before native navigation attempts to scroll to it.
            expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(false);
          },
        });
        const input = document.querySelector<HTMLInputElement>("dialog input");
        if (input) input.value = "Later evidence";
      });
      expect(document.querySelectorAll("dialog .search-option")).toHaveLength(1);
      expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
      await act(async () => {
        document
          .querySelector<HTMLInputElement>("dialog input")
          ?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
          );
      });
      expect(destination).toBe("/timeline/#t-later");
      expect(window.location.hash).toBe("#t-later");
      expect(document.querySelector("dialog[data-search-dialog]")).toBeNull();
      expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(false);
      expect(checkbox("timeline-later-confirmations").checked).toBe(true);
    } finally {
      close();
    }
  });

  test("modified links and a different document do not change the current filters", async () => {
    await act(async () => checkbox("timeline-later-confirmations").click());
    const link = document.createElement("a");
    document.body.append(link);
    link.href = "/timeline/#t-later";
    await act(async () => {
      window.addEventListener("click", (event) => event.preventDefault(), { once: true });
      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }),
      );
    });
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
    link.href = "/papers/#t-later";
    await act(async () => {
      window.addEventListener("click", (event) => event.preventDefault(), { once: true });
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(document.getElementById("timeline-later-confirmations")?.hidden).toBe(true);
  });

  test("an invalid or outside fragment neither throws nor opens an unrelated group", () => {
    expect(revealTimelineTarget(content, "#%zz")).toBeNull();
    expect(revealTimelineTarget(content, "#absent")).toBeNull();
    expect(revealTimelineTarget(content, "#t-boundary-1904")).toBeNull();
  });
});
