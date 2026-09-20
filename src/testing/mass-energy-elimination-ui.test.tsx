import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { LinearProofExplorer } from "../equations/derivations/LinearProofExplorer.tsx";
import type { LinearProofView } from "../equations/derivations/linearProofView.ts";
import generated from "../generated/mass-energy-elimination.json";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

const proof = generated as LinearProofView;
beforeEach(installDom);
afterEach(uninstallDom);
const states = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-linear-step]")].map((e) =>
    e.getAttribute("data-step-state"),
  );

test("the complete conditional proof is server rendered without requiring any answer", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<LinearProofExplorer proof={proof} />);
  expect(container.querySelectorAll("[data-linear-step]").length).toBe(5);
  expect(container.querySelectorAll("math").length).toBe(10);
  expect(states(container)).toEqual(Array(5).fill("supported"));
  expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
  expect(container.textContent).toContain("does not prove conservation");
  expect(container.textContent).toContain("If the two offsets differ");
});

test("omitting the offset retains the first two steps and blocks only the dependent conclusions", async () => {
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(<LinearProofExplorer proof={proof} restoreSettings={false} />);
    });
    const before = [...container.querySelectorAll("[data-proof-equation]")].map((e) => e.innerHTML);
    await act(async () => {
      container.querySelector<HTMLInputElement>('[data-proof-premise="offset"]')!.click();
    });
    expect(states(container)).toEqual(["supported", "supported", "blocked", "blocked", "blocked"]);
    expect(
      [...container.querySelectorAll("[data-proof-equation]")].map((e) => e.innerHTML),
    ).toEqual(before);
    expect(container.querySelector("[data-proof-status]")!.textContent).toContain("2 of 5");
    expect(container.querySelector("[data-proof-share]")!.getAttribute("href")).toContain(
      "mep-off=offset",
    );
    await act(async () => {
      container.querySelector<HTMLInputElement>('[data-proof-premise="offset"]')!.click();
    });
    expect(states(container)).toEqual(Array(5).fill("supported"));
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});

test("valid configuration links restore only the opted-in instance and IDs remain distinct", async () => {
  window.history.replaceState({}, "", "/papers/mass-energy/?mep=1&mep-off=offset");
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <>
          <LinearProofExplorer proof={proof} />
          <LinearProofExplorer proof={proof} restoreSettings={false} />
        </>,
      );
    });
    const instances = container.querySelectorAll<HTMLElement>("[data-linear-proof]");
    expect(states(instances[0]!)).toEqual([
      "supported",
      "supported",
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(states(instances[1]!)).toEqual(Array(5).fill("supported"));
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});

test("an ambiguous shared configuration preserves the all-premise argument with a visible notice", async () => {
  window.history.replaceState({}, "", "/papers/mass-energy/?mep=1&mep-off=offset&mep-off=moving");
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(<LinearProofExplorer proof={proof} />);
    });
    expect(states(container)).toEqual(Array(5).fill("supported"));
    expect(container.textContent).toContain("unsupported or ambiguous");
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});

test("compact and expanded views keep the same equation nodes, step order and conclusions", async () => {
  const container = createContainer(),
    root = createRoot(container);
  try {
    await act(async () => {
      root.render(<LinearProofExplorer proof={proof} restoreSettings={false} />);
    });
    const before = [...container.querySelectorAll("[data-proof-equation]")];
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "compact";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector("[data-linear-proof]")!.getAttribute("data-proof-mode")).toBe(
      "compact",
    );
    expect(
      [...container.querySelectorAll<HTMLDetailsElement>(".linear-step-detail")].every(
        (e) => !e.open,
      ),
    ).toBe(true);
    expect([...container.querySelectorAll("[data-proof-equation]")]).toEqual(before);
    expect(states(container)).toEqual(Array(5).fill("supported"));
    await act(async () => {
      select.value = "full";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      [...container.querySelectorAll<HTMLDetailsElement>(".linear-step-detail")].every(
        (e) => e.open,
      ),
    ).toBe(true);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});
