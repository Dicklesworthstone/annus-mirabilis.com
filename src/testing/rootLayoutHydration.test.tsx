/**
 * THE PAGE HYDRATES IN ITS OWN BOUNDARY, SO A LATE PAGE CHUNK CANNOT UNWIND THE SITE'S SHELL
 * (dispatch 171).
 *
 * Live threw React #418 ("the server rendered HTML didn't match the client") on about one load in
 * 300 in Chromium, and React then re-rendered the whole document. On a dev server of HEAD, with a
 * random 0-300 ms delay on every /_next/ request, it came back 3 loads in 60 and 3 in 100, and
 * development React named the place every time: RootLayout > body, where it expected
 * <main id="main"> and found <div className="lab-route">, which is main's own first child. React
 * searches past unexpected siblings in <body>, so its cursor was already inside <main>. It had
 * begun hydrating <main>, a page component inside it suspended on a late chunk, and the work was
 * retried without the cursor put back. Removing the Suspense around GuidedTourTrail changed nothing
 * (3 in 100). Giving the page's children their own boundary inside <main> did: 0 in 300. A late
 * page chunk now suspends that boundary alone, and the shell around it hydrates without waiting.
 *
 * Two checks, server render then client hydration:
 * - the real RootLayout puts the page inside its own Suspense boundary in <main>;
 * - in a model of that shell, a page that arrives late leaves no hydration error, and the shell
 *   (a footer control) is live while the page is still pending. The same shell without the
 *   boundary is the control: its footer stays unhydrated until the page arrives, which is the
 *   coupling that let a late chunk unwind the shell.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, lazy, type ReactNode, Suspense } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import RootLayout from "../app/layout.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

const hydrated = (el: Element | null) =>
  el !== null && Object.keys(el).some((k) => k.startsWith("__reactFiber$"));

function PageContent() {
  return (
    <div className="lab-route">
      <p>The page</p>
    </div>
  );
}

/** A model of RootLayout's body: chrome, the page in <main>, chrome after it. */
function Shell({ page, boundary }: { page: ReactNode; boundary: boolean }) {
  return (
    <div>
      <header>
        <a href="/">Annus Mirabilis</a>
      </header>
      <main id="main">{boundary ? <Suspense fallback={null}>{page}</Suspense> : page}</main>
      <footer>
        <button type="button" id="footer-control">
          What this site stores
        </button>
      </footer>
    </div>
  );
}

/** Server-render with the page present, then hydrate with a page whose chunk has not arrived. */
async function hydrateWithLatePage(boundary: boolean) {
  const serverHtml = renderToString(<Shell page={<PageContent />} boundary={boundary} />);
  let arrive: (m: { default: typeof PageContent }) => void = () => {};
  const LatePage = lazy(
    () => new Promise<{ default: typeof PageContent }>((resolve) => (arrive = resolve)),
  );
  const container = createContainer();
  container.innerHTML = serverHtml;
  const recoverable: unknown[] = [];
  const consoleErrors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => consoleErrors.push(args.map(String).join(" "));
  try {
    const root = hydrateRoot(container, <Shell page={<LatePage />} boundary={boundary} />, {
      onRecoverableError: (error) => recoverable.push(error),
    });
    await act(async () => {});
    const shellLiveWhilePending = hydrated(container.querySelector("#footer-control"));
    await act(async () => arrive({ default: PageContent }));
    const pageHydrated = hydrated(container.querySelector(".lab-route"));
    await act(async () => root.unmount());
    return {
      serverHtml,
      shellLiveWhilePending,
      pageHydrated,
      recoverable,
      hydrationWarnings: consoleErrors.filter((e) => /hydrat|didn't match/i.test(e)),
    };
  } finally {
    console.error = originalError;
    removeContainer(container);
  }
}

describe("the root layout keeps a late page chunk from unwinding the shell (dispatch 171)", () => {
  test("RootLayout puts the page inside its own Suspense boundary in <main>", () => {
    const html = renderToString(RootLayout({ children: <p id="page-probe">page</p> }));
    // A completed boundary is marked <!--$--> ... <!--/$--> in the server HTML.
    expect(html).toContain('<main id="main"><!--$--><p id="page-probe">page</p><!--/$--></main>');
  });

  test("with the boundary, a late page leaves no hydration error and the shell is live meanwhile", async () => {
    const result = await hydrateWithLatePage(true);
    expect(result.serverHtml).toContain('<main id="main"><!--$--><div class="lab-route">');
    expect(result.recoverable).toEqual([]);
    expect(result.hydrationWarnings).toEqual([]);
    expect(result.shellLiveWhilePending).toBe(true);
    expect(result.pageHydrated).toBe(true);
  });

  test("control: without the boundary the shell waits on the late page", async () => {
    // Not a failure mode by itself; the coupling the boundary removes. If this ever reads true,
    // the model no longer shows what the boundary is for, and the check above proves nothing.
    const result = await hydrateWithLatePage(false);
    expect(result.shellLiveWhilePending).toBe(false);
    expect(result.pageHydrated).toBe(true);
  });
});
