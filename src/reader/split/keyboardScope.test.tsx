import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { AlignmentController } from "../faces/AlignmentController.tsx";
import type { AlignmentIndex } from "../faces/alignment.ts";

const index: AlignmentIndex = {
  sourceToTarget: new Map([
    ["s1-p1-s1", ["u1"]],
    ["s1-p1-s2", ["u2"]],
  ]),
  targetToSource: new Map([
    ["u1", ["s1-p1-s1"]],
    ["u2", ["s1-p1-s2"]],
  ]),
  orderedSentenceIds: ["s1-p1-s1", "s1-p1-s2"],
  orderedUnitIds: ["u1", "u2"],
};
let mounted: Root | undefined;
beforeEach(installDom);
afterEach(async () => {
  if (mounted) await act(async () => mounted?.unmount());
  mounted = undefined;
  await uninstallDom();
});

test("split sentence navigation stays inside the source and leaves companion keys native", async () => {
  document.body.innerHTML = `<main><div data-split-source-content><span data-source-sentence data-sentence-id="s1-p1-s1" id="s1-p1-s1" tabindex="0">Erstens.</span><span data-source-sentence data-sentence-id="s1-p1-s2" id="s1-p1-s2" tabindex="0">Zweitens.</span><span data-translation-unit-id="u1">First.</span><span data-translation-unit-id="u2">Second.</span></div><section id="companion" tabindex="0">Explanation</section><select id="choice"><option>German</option><option>English</option></select><div id="island"></div></main>`;
  const island = document.getElementById("island");
  if (!island) throw new Error("test island missing");
  mounted = createRoot(island);
  await act(async () =>
    mounted?.render(
      <AlignmentController
        index={index}
        containerSelector="[data-split-source-content]"
        keyboardScope="container"
      />,
    ),
  );
  for (const id of ["companion", "choice"]) {
    const outside = document.getElementById(id);
    outside?.focus();
    const arrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      outside?.dispatchEvent(arrow);
    });
    expect(arrow.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);
    expect(document.querySelector("[data-aligned-active]")).toBeNull();
  }
  const first = document.getElementById("s1-p1-s1");
  await act(async () => {
    first?.focus();
  });
  const next = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
  await act(async () => {
    first?.dispatchEvent(next);
  });
  expect(next.defaultPrevented).toBe(true);
  expect(document.activeElement?.id).toBe("s1-p1-s2");
  expect(
    document.querySelector('[data-translation-unit-id="u2"]')?.getAttribute("data-aligned-partner"),
  ).toBe("true");
  await act(async () => mounted?.unmount());
  mounted = undefined;
  const after = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
  document.getElementById("s1-p1-s2")?.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
