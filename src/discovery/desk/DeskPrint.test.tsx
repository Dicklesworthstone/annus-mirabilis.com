import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { DeskPrint } from "./DeskPrint.tsx";

describe("printing the complete desk without losing the reader's choices", () => {
  let root: ReturnType<typeof createRoot>;
  beforeEach(async () => {
    await installDom();
    document.body.innerHTML = `
      <div id="print-controller"></div>
      <article class="desk-page">
        <details id="reader-open" open><summary>An open answer</summary>Answer text</details>
        <details id="reader-closed"><summary>A closed source</summary>Source text</details>
      </article>
      <details id="outside-desk"><summary>Elsewhere</summary>Other content</details>`;
    root = createRoot(document.getElementById("print-controller") as HTMLElement);
    await act(async () => root.render(<DeskPrint />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });
  const details = (id: string) => document.getElementById(id) as HTMLDetailsElement;

  test("repeated beforeprint events open desk details and afterprint restores exactly the prior state", () => {
    window.dispatchEvent(new Event("beforeprint"));
    expect(details("reader-open").open).toBe(true);
    expect(details("reader-closed").open).toBe(true);
    expect(details("outside-desk").open).toBe(false);
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));
    expect(details("reader-open").open).toBe(true);
    expect(details("reader-closed").open).toBe(false);
    expect(details("outside-desk").open).toBe(false);
  });

  test("leaving the desk during printing restores its closed details and removes print listeners", async () => {
    window.dispatchEvent(new Event("beforeprint"));
    expect(details("reader-closed").open).toBe(true);
    await act(async () => root.render(null));
    expect(details("reader-closed").open).toBe(false);
    window.dispatchEvent(new Event("beforeprint"));
    expect(details("reader-closed").open).toBe(false);
  });
});
