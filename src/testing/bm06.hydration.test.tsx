import { expect, test } from "bun:test";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { BrownianComparison } from "../components/lab/BrownianLab.tsx";
import example from "../generated/bm06-example.json";
import { exportMarkup } from "./exportMarkup.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

test("BM-06 hydrates its complete static readings without replacing the server tree", async () => {
  const element = <BrownianComparison example={example} />;
  const markup = await exportMarkup(element);
  await installDom();
  window.history.replaceState({}, "", "/lab/bm-06/");
  const container = createContainer();
  const recoverable: unknown[] = [];
  let root: Root | undefined;
  try {
    // Parsing the emitted HTML exposes invalid nesting that a client-only mount cannot detect.
    container.innerHTML = markup;
    const apply = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const settings = apply.closest<HTMLFieldSetElement>("fieldset")!;
    expect(settings.disabled).toBe(true);

    await act(async () => {
      root = hydrateRoot(container, element, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    expect(container.querySelector('button[type="submit"]')).toBe(apply);
    expect(settings.disabled).toBe(false);
  } finally {
    await act(async () => root?.unmount());
    removeContainer(container);
    await uninstallDom();
  }
});
