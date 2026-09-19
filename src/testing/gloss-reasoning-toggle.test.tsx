import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { GlossReasoningToggle } from "../reader/faces/GlossReasoningToggle.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

test("both initial states are native uncontrolled checkboxes, usable without a client handler", () => {
  for (const initial of [true, false]) {
    const shell = document.createElement("div");
    shell.innerHTML = renderToStaticMarkup(<GlossReasoningToggle initiallyChecked={initial} />);
    const box = shell.querySelector<HTMLInputElement>("input")!;
    expect(box.checked).toBe(initial);
    expect(box.disabled).toBe(false);
    box.click();
    expect(box.checked).toBe(!initial);
  }
});

test("hydrated controls update only their own face and leave source content in place", async () => {
  const container = createContainer(), root = createRoot(container);
  try {
    await act(async () => { root.render(<>
      <article className="gloss-face" data-reasoning-words="off"><GlossReasoningToggle /><p data-source>Unchanged source</p></article>
      <article className="gloss-face" data-reasoning-words="on"><GlossReasoningToggle initiallyChecked /><p data-source>Other source</p></article>
    </>); });
    const faces = container.querySelectorAll<HTMLElement>("article");
    const source = faces[0]!.querySelector("[data-source]");
    await act(async () => { faces[0]!.querySelector<HTMLInputElement>("input")!.click(); });
    expect(faces[0]!.dataset.reasoningWords).toBe("on");
    expect(faces[1]!.dataset.reasoningWords).toBe("on");
    expect(faces[0]!.querySelector("[data-source]")).toBe(source);
    await act(async () => { faces[1]!.querySelector<HTMLInputElement>("input")!.click(); });
    expect(faces[0]!.dataset.reasoningWords).toBe("on");
    expect(faces[1]!.dataset.reasoningWords).toBe("off");
  } finally { await act(async () => { root.unmount(); }); removeContainer(container); }
});
