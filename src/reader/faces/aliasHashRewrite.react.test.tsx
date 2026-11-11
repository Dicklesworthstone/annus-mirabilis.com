import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { AliasHashRewrite } from "./AliasHashRewrite.tsx";

let root: Root | null = null;
const aliases = { "s0-p8": "s0-p7", "s0-p9": "s0-p7", "s1-p4": "s1-p3" };

beforeEach(async () => {
  await installDom();
  document.body.innerHTML =
    '<span id="s0-p8" data-alias-of="s0-p7"></span><span id="s0-p9" data-alias-of="s0-p7"></span><p id="s0-p7">The surviving paragraph.</p>';
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

async function mount() {
  root = createRoot(createContainer());
  await act(async () => root?.render(createElement(AliasHashRewrite, { aliases })));
}

describe("retired address canonicalisation", () => {
  test("arrival and later fragment navigation replace the address without adding a history entry", async () => {
    window.history.replaceState(
      { keep: "reader-state" },
      "",
      "/papers/mass-energy/view/english/#s0-p8",
    );
    const before = window.history.length;
    await mount();
    expect(window.location.hash).toBe("#s0-p7");
    expect(window.history.length).toBe(before);
    expect(window.history.state).toEqual({ keep: "reader-state" });
    window.history.pushState({ keep: "next-entry" }, "", "#s0-p9");
    const length = window.history.length;
    await act(async () => window.dispatchEvent(new Event("hashchange")));
    expect(window.location.hash).toBe("#s0-p7");
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual({ keep: "next-entry" });
  });

  test("a section view leaves an absent successor untouched", async () => {
    window.history.replaceState(null, "", "#s1-p4");
    await mount();
    expect(window.location.hash).toBe("#s1-p4");
  });

  test("a live target alone does not conceal a missing static alias", async () => {
    document.getElementById("s0-p8")?.remove();
    window.history.replaceState(null, "", "#s0-p8");
    await mount();
    expect(window.location.hash).toBe("#s0-p8");
  });
});
