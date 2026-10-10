import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * WHAT THE PREDICT GATE IS ALLOWED TO HIDE (am-ig23).
 *
 * `html[data-detail] [data-predict-response="awaiting"]` gives `display: none`, which is right for the
 * response plot -- AGENTS.md says it must be hidden "before the first change" so a reader states a
 * prediction before seeing the answer. It is wrong for anything a reader needs in order TO predict, and
 * wrong for a refusal: "a refusal is a museum label: freeze the illegal step, show the reason, and keep
 * the last legal state", and a hidden label is not a label.
 *
 * THE DEFECT THIS WAS WRITTEN FROM. On bm-08 the reason was lifted out of the gated region in an earlier
 * pass and the STALENESS MARKING was not, so a reader with an armed prediction was told why their
 * settings were refused and was not told that the numbers still on screen are from the previous ones.
 * It was found by a browser check waiting 63 times on
 * `[data-currency-state="refused"][data-refusal-code="off-replay-grid"]` and resolving each time to a
 * hidden element -- which is to say it was invisible to every unit test in the repository, because
 * happy-dom computes no styles and the element was present and readable the whole time.
 *
 * SO THIS TEST ASKS A STRUCTURAL QUESTION, NOT A STYLE ONE: is the element inside a gated ancestor? A
 * descendant cannot un-hide itself from an ancestor's `display: none`, so containment IS the property,
 * and it is answerable without a layout engine. That is the whole reason this can live in the bun lane
 * while the defect it guards was only ever observable in a browser.
 *
 * MEASURED BEFORE IT WAS WRITTEN, across all 33 laboratory routes: 27 render an execution chrome and
 * exactly two -- bm-05 and bm-08 -- had it inside a gated region. Those two spread `gate.response` over
 * the whole `div.lab-results`; the other 25 spread it on the response-showing children (bm-01's
 * histogram and table, lq-08's plot), which leaves the chrome visible. The two were brought into line
 * with the twenty-five rather than the convention being changed.
 *
 * The exact set of chrome-bearing labs is recorded rather than counted, for the reason AGENTS.md gives:
 * a count passes when a lab silently loses its execution label, and an identity does not.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = resolve(root, "src/app/lab");
const GATED = '[data-predict-response="awaiting"]';
const pause = () => new Promise((r) => setTimeout(r, 5));

/**
 * Everything a reader must be able to see WHILE a prediction is armed.
 *
 * `.execution-chrome` is the one that renders unconditionally, so it is what gives this test its force
 * on a page nobody has refused. The other four appear only after a refusal and are listed so that
 * moving a notice INTO the gate fails here too, rather than waiting for a browser lane to notice.
 */
const MUST_STAY_VISIBLE = [
  ".execution-chrome",
  "[data-currency-state]",
  "[data-apply-failure]",
  "[data-refusal-code]",
  ".notice.error",
] as const;

async function mount(route: string) {
  const mod = await import(resolve(APP, route, "page.tsx"));
  const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
  const jsx = (out instanceof Promise ? await out : out) as ReactElement;
  const container = createContainer();
  const reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(jsx);
  });
  // The gate reads its persistence port in an effect, so `open` is only correct after the effects
  // have run; a single pause left some labs reporting no gated region at all.
  for (let i = 0; i < 40; i++)
    await act(async () => {
      await pause();
    });
  return { container, reactRoot };
}

const routes = readdirSync(APP)
  .filter((d) => /^(bm|lq|me|sr)-\d\d$/.test(d))
  .sort();

/**
 * The laboratories that render an execution chrome, measured 2026-10-10 and written down afterwards.
 *
 * The six absent ones render none at all: bm-02, bm-03, bm-07, lq-02, sr-02 and sr-03. That is a
 * separate gap -- bm-07's form refusal can never carry a staleness marking because the lab has no
 * surface to carry one -- and it is recorded here so that it is a known absence rather than a silent
 * one. Adding a chrome to one of those labs fails this test by name, which is the moment to delete its
 * line from this list.
 */
const CHROME_BEARING = [
  "bm-01",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-08",
  "lq-01",
  "lq-03",
  "lq-04",
  "lq-05",
  "lq-06",
  "lq-07",
  "lq-08",
  "lq-09",
  "me-01",
  "me-02",
  "me-03",
  "sr-01",
  "sr-04",
  "sr-05",
  "sr-06",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
];

describe("the predict gate hides the response and nothing a reader needs in order to predict", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  const hidden: string[] = [];
  const withChrome: string[] = [];
  let gatedRegions = 0;
  let examined = 0;

  for (const route of routes) {
    test(`${route}: no execution chrome, currency or refusal surface inside the predict gate`, async () => {
      const page = await mount(route);
      const c = page.container;
      examined += 1;
      gatedRegions += c.querySelectorAll(GATED).length;
      if (c.querySelector(".execution-chrome")) withChrome.push(route);
      const found: string[] = [];
      for (const sel of MUST_STAY_VISIBLE)
        for (const el of c.querySelectorAll(sel))
          if (el.closest(GATED) !== null) found.push(`${sel} inside ${GATED}`);
      await act(async () => {
        page.reactRoot.unmount();
      });
      removeContainer(c);
      for (const f of found) hidden.push(`${route}: ${f}`);
      expect(found).toEqual([]);
    }, 120_000);
  }

  test("the sweep reached the labs, their gates and their chrome", () => {
    console.log(
      `[census] predict-gate visibility examined ${examined} laboratory route(s) (minimum ${routes.length}); ` +
        `${gatedRegions} gated region(s) found; ${withChrome.length} lab(s) render an execution chrome; ` +
        `${hidden.length} surface(s) inside a gated region${hidden.length ? `: ${hidden.join("; ")}` : ""}`,
    );
    // A selector that matched nothing, or a gate that never armed, would make every assertion above
    // pass while examining nothing. Both are asserted rather than assumed.
    expect(examined).toBe(routes.length);
    expect(gatedRegions).toBeGreaterThan(20);
    expect([...withChrome].sort()).toEqual(CHROME_BEARING);
  });
});
