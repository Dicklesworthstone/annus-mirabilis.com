/**
 * A TEACHING TAPE'S LINK CHANGES WHAT THE READER SEES (am-3zt7).
 *
 * `tapeSettingsLinks.test.ts` proves every generated link is accepted by its laboratory's own
 * restore path. That reads the restore's RESULT. This reads the rendered form, which is the only
 * place a reader ever looks, and the two can disagree: a session can hold a value the form does not
 * show, and the form shows viscosity in mPa s where the session holds Pa s.
 *
 * WHY A CONTROL IS PART OF THE TEST. Measured 2026-09-28: of the 22 linked teaching tapes, 15 carry
 * settings identical to their laboratory's defaults, so following those links lands on a form that
 * looks exactly like opening the laboratory. An arrival assertion written against one of those is
 * true and proves nothing. This one is written against a tape whose settings differ, and it asserts
 * the BEFORE as well as the after, so it cannot pass by describing the defaults.
 */
import { expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { buildTapeLinks } from "../../scripts/generate-tape-links.ts";
import { TracerComparison } from "../components/lab/TracerLab.tsx";
import example from "../generated/bm01-example.json";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/** Every form value on the page, keyed by the stable part of its id. React's `useId` prefix differs
 *  between two mounts, so comparing raw ids compares two disjoint key sets and reports every field
 *  as changed. The range twin of each slider is dropped; it carries the same value. */
async function formAt(url: string): Promise<Record<string, string>> {
  await installDom();
  window.history.replaceState({}, "", url);
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(<TracerComparison example={example as never} />);
    });
    const out: Record<string, string> = {};
    for (const el of container.querySelectorAll("input, select")) {
      const name = (el.getAttribute("name") ?? el.getAttribute("id") ?? "").replace(
        /^:r[0-9a-z]+:-?/,
        "",
      );
      if (name && !name.endsWith("-range")) out[name] = (el as HTMLInputElement).value;
    }
    return out;
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
    await uninstallDom();
  }
}

test("einstein-0-8-micron's link puts Einstein's printed conditions in BM-01's form", async () => {
  const href = buildTapeLinks().links["einstein-0-8-micron"]?.href;
  expect(href, "einstein-0-8-micron has no generated link").toBeTruthy();

  const plain = await formAt("/lab/bm-01/");
  const withTape = await formAt(href as string);
  expect(Object.keys(plain).length).toBeGreaterThan(5);
  expect(Object.keys(withTape).length).toBe(Object.keys(plain).length);

  // The 1905 paper's stated conditions: T = 290.15 K, eta = 1.35 mPa s (0.00135 Pa s in SI, which
  // is what the tape records; the form is in mPa s, and reading the render is what shows that).
  expect(withTape.T).toBe("290.15");
  expect(withTape.eta).toBe("1.35");

  // The control, in the same run: without the link the form shows the laboratory's own defaults.
  // Without this the assertions above would pass against a laboratory that already opened there.
  expect(plain.T).toBe("293.15");
  expect(plain.eta).toBe("1");
});
