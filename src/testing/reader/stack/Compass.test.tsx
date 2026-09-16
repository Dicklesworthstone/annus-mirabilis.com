import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Compass } from "../../../reader/stack/Compass.tsx";
import type { StackFrame } from "../../../reader/stack/stackStore.ts";
import { installDom, uninstallDom } from "../../reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

function frame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "brownian-4",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "foundation", id: "mean-variance-rms" },
    title: "Mean, variance and RMS",
    question: "What does the displacement mean square tell us?",
    triggerId: "trigger-1",
    scrollFraction: 0.2,
    lab: null,
    ...overrides,
  };
}

function render(element: React.ReactElement): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("Compass: hidden when no clarification is open", () => {
  test("renders nothing when frame is undefined", () => {
    const { container, unmount } = render(<Compass frame={undefined} onReturn={() => {}} />);
    expect(container.querySelector("nav")).toBeNull();
    unmount();
  });
});

describe("Compass: the question, the idea, and a way back", () => {
  test("shows the question and the opened idea as an accessible landmark", () => {
    const { container, unmount } = render(<Compass frame={frame()} onReturn={() => {}} />);
    const nav = container.querySelector("nav[data-compass]");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBeTruthy();
    expect(container.querySelector("[data-compass-question]")?.textContent).toBe(
      "What does the displacement mean square tell us?",
    );
    expect(container.querySelector("[data-compass-idea]")?.textContent).toBe(
      "Mean, variance and RMS",
    );
    expect(container.querySelector("[data-compass-return]")).not.toBeNull();
    unmount();
  });

  test("clicking return invokes onReturn exactly once", () => {
    let calls = 0;
    const { container, unmount } = render(
      <Compass
        frame={frame()}
        onReturn={() => {
          calls++;
        }}
      />,
    );
    const button = container.querySelector<HTMLButtonElement>("[data-compass-return]")!;
    act(() => {
      button.click();
    });
    expect(calls).toBe(1);
    unmount();
  });

  test("shows the depth-limit note only when depthLimitReplaced is true", () => {
    const notReplaced = render(<Compass frame={frame()} onReturn={() => {}} />);
    expect(notReplaced.container.querySelector("[data-compass-depth-limit]")).toBeNull();
    notReplaced.unmount();

    const replaced = render(<Compass frame={frame()} depthLimitReplaced onReturn={() => {}} />);
    expect(replaced.container.querySelector("[data-compass-depth-limit]")).not.toBeNull();
    expect(replaced.container.querySelector("[data-compass-depth-limit]")?.textContent).toContain(
      "replaced",
    );
    replaced.unmount();
  });
});
