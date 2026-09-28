import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MagnetConductorLab } from "../components/lab/MagnetConductorLab.tsx";
import { DECLARED_MODES, resolveCatalogueAddress } from "../experiments/catalogue.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { tapeForSettings } from "../experiments/permalink/sessionTape.ts";
import { SR02_DEFAULTS } from "../experiments/sr02/definition.ts";
import { decodeSr02Settings } from "../experiments/sr02/permalink.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/sr02/session.ts";
import { SR02_TAPE } from "../experiments/sr02/tape.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

// sr-02 is the one instrument on the site that declares a mode, and until dispatch 359 the site
// wrote `sr-02:apparatus` into the DOM for a reader in that view while no URL could reach it.
// These tests hold the two halves together: the catalogue decides what is addressable, and the
// laboratory serves exactly what the catalogue declares.

beforeEach(installDom);
afterEach(uninstallDom);

async function mounted(element: ReactNode, check: (container: HTMLElement) => Promise<void>) {
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(element);
    });
    await check(container);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
}

/** The three things a reader can see about which view they are in, read from one render. */
type Reading = { stamp: string | null; href: string | null; refusal: string };
function read(container: HTMLElement): Reading {
  const link = [...container.querySelectorAll("a")].find((a) =>
    (a.getAttribute("href") ?? "").startsWith("/lab/sr-02/"),
  );
  return {
    stamp:
      container.querySelector("[data-instrument-id]")?.getAttribute("data-instrument-id") ?? null,
    href: link?.getAttribute("href") ?? null,
    refusal: (
      container.querySelector('[data-refusal-code="undeclared-mode-link"]')?.textContent ?? ""
    ).trim(),
  };
}

async function at(url: string, check: (r: Reading) => void) {
  window.history.replaceState({}, "", url);
  await mounted(<MagnetConductorLab example={DEFAULT_PREPARED_EXAMPLE} />, async (container) => {
    check(read(container));
  });
}

test("the mode this test addresses is one the catalogue actually declares", () => {
  // Non-vacuity, on purpose: every case below would pass over an empty declaration set if the
  // resolver simply refused everything, so the population is named before it is used.
  const declared = DECLARED_MODES["sr-02"];
  expect(declared).toContain("apparatus");
  expect(declared).not.toContain("nonsense");
  expect(resolveCatalogueAddress("sr-02:apparatus")).toEqual({ id: "sr-02", mode: "apparatus" });
  expect("error" in resolveCatalogueAddress("sr-02:nonsense")).toBe(true);
});

test("a ?mode=apparatus link arrives in the apparatus state, and the bare route does not", async () => {
  // The stamp is the site's own witness for the state: MagnetConductorLab writes
  // data-instrument-id={apparatus ? "sr-02:apparatus" : "sr-02"}. The bare route is the control,
  // so a stamp that never changes cannot pass for a link that worked.
  await at("/lab/sr-02/?mode=apparatus", (r) => expect(r.stamp).toBe("sr-02:apparatus"));
  await at("/lab/sr-02/", (r) => expect(r.stamp).toBe("sr-02"));
});

test("the ONE share control carries the mode, and its link returns to the same state", async () => {
  // The round trip rides the tape, not a second ?mode= link: `mode` is an sr-02 parameter, so the
  // tape's initial conditions hold it. ec26d8d2 wrote a second link here and broke
  // src/testing/oneShareControl.test.ts; this is the same property through the one control.
  const tape = tapeForSettings(SR02_TAPE, { ...SR02_DEFAULTS, mode: "apparatus" });
  expect(tape, "sr-02 records no tape for the apparatus view").toBeTruthy();
  expect(tape?.initialConditions.mode).toBe("apparatus");
  const href = `/lab/sr-02/?tape=${encodeTapePermalink(tape as NonNullable<typeof tape>)}`;
  const back = decodeTapePermalink(new URL(`https://annus-mirabilis.com${href}`));
  expect(back.kind).toBe("success");
  await at(href, (r) => expect(r.stamp).toBe("sr-02:apparatus"));
});

test("an undeclared mode refuses in words instead of showing the default under its name", async () => {
  await at("/lab/sr-02/?mode=nonsense", (r) => {
    expect(r.refusal).toContain("does not offer");
    expect(r.refusal).toContain("nonsense");
    expect(r.stamp).toBe("sr-02");
  });
  // Paired with an in-domain value: the refusal element is absent, not merely empty, when the
  // link is good. Without this the assertion above would pass against a notice that is always on
  // screen, which is how a refusal gets credited that nothing detected.
  await at("/lab/sr-02/?mode=apparatus", (r) => expect(r.refusal).toBe(""));
  await at("/lab/sr-02/", (r) => expect(r.refusal).toBe(""));
});

test("the decoder reads every declared mode, and the tape is what writes one", () => {
  // The decoder stays (the invariant's own wording) so an older ?mode= link still opens. Both
  // directions, so a decoder that refused everything could not pass.
  for (const mode of DECLARED_MODES["sr-02"]) {
    const decoded = decodeSr02Settings(`?mode=${mode}`);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") expect(decoded.parameters.mode).toBe(mode);
  }
  expect(decodeSr02Settings("?mode=nonsense").kind).toBe("invalid");
  expect(decodeSr02Settings("").kind).toBe("none");
  // `analytic` is the default view and is deliberately not declared, so no link names it.
  expect(decodeSr02Settings("?mode=analytic").kind).toBe("invalid");
});

test("without JavaScript the link lands on the default view, which is what the page says", () => {
  // Honest limit rather than a claim: the site is a static export, so nothing reads the query
  // server-side. The static markup for the apparatus URL is the default view, and the noscript
  // notice tells the reader that in words.
  window.history.replaceState({}, "", "/lab/sr-02/?mode=apparatus");
  const html = renderToStaticMarkup(<MagnetConductorLab example={DEFAULT_PREPARED_EXAMPLE} />);
  expect(html).toContain('data-instrument-id="sr-02"');
  expect(html).not.toContain('data-instrument-id="sr-02:apparatus"');
  expect(html).toContain("?mode=apparatus link");
});
