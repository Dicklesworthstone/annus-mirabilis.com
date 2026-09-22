/**
 * The inline facsimile loads its viewer only when the reader chooses the facsimile face, and the
 * viewer still arrives. The viewer used to be a static import, so it shipped in the first bundle
 * of every reading page; it is now fetched with the page map. What this file can prove is the
 * behaviour: nothing before the face is chosen, the viewer after. What is in the first bundle is a
 * property of the build, and is measured by `bun scripts/run-perf-budgets.ts`, not here.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GET } from "../../app/papers/[paper]/facsimile.json/route.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { InlineFacsimile } from "./InlineFacsimile.tsx";

beforeEach(async () => {
  await installDom();
  // The viewer embeds the scan in an <iframe>. With loading off, happy-dom does not reach for the
  // network; it refuses the load and reports the refusal on console.error, which the test below
  // collects and checks rather than letting it print as if something had gone wrong.
  (
    window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }
  ).happyDOM.settings.disableIframePageLoading = true;
});
afterEach(uninstallDom);

/** The real page map for a paper, as its build-time route serves it. */
async function realMap(paper: string): Promise<string> {
  const response = await GET(new Request(`http://localhost/papers/${paper}/facsimile.json`), {
    params: Promise.resolve({ paper }),
  });
  return response.text();
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe("the inline facsimile on a reading page", () => {
  test("fetches nothing and shows no viewer until the facsimile face is chosen, then shows it", async () => {
    const body = await realMap("mass-energy");
    const requested: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      requested.push(String(input));
      return new Response(body, { headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const readerRoot = document.createElement("div");
    readerRoot.setAttribute("data-reader-root", "");
    readerRoot.dataset.view = "reading";
    const mount = document.createElement("div");
    readerRoot.append(mount);
    document.body.append(readerRoot);
    let root: Root | undefined;
    try {
      root = createRoot(mount);
      await act(async () => root?.render(<InlineFacsimile paperId="mass-energy" />));
      await settle();

      const panel = mount.querySelector<HTMLElement>("[data-inline-facsimile-panel]");
      expect(panel?.hidden).toBe(true);
      expect(requested).toEqual([]);
      expect(mount.querySelector(".facsimile-reader")).toBeNull();

      const logged: string[] = [];
      const realError = console.error;
      console.error = (...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      };
      try {
        readerRoot.dataset.view = "facsimile";
        await settle();
      } finally {
        console.error = realError;
      }
      // Every error logged while the viewer mounted is happy-dom declining to load the scan into
      // its iframe, and nothing else: a React error here would fail this line.
      expect(
        logged.filter(
          (line) => !line.includes('iframe page "http://localhost/papers/pdfs/ap-18-639.pdf'),
        ),
      ).toEqual([]);

      expect(panel?.hidden).toBe(false);
      expect(requested).toEqual(["/papers/mass-energy/facsimile.json"]);
      // The viewer itself, not the loading notice: its root class is the one the standalone
      // facsimile page renders.
      expect(mount.querySelector(".facsimile-reader")).not.toBeNull();
      expect(mount.querySelector(".facsimile-reader iframe")?.getAttribute("src")).toContain(
        "/papers/pdfs/ap-18-639.pdf",
      );
    } finally {
      act(() => root?.unmount());
      globalThis.fetch = realFetch;
    }
  });
});
