import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Compass } from "../reader/stack/Compass.tsx";
import type { StackFrame } from "../reader/stack/stackStore.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

function mockFrame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "brownian-section-1",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "foundation", id: "mean-variance-rms" },
    title: "Mean, variance and RMS",
    question: "How do we measure fluctuating displacements?",
    triggerId: "btn-1",
    scrollFraction: 0.2,
    lab: null,
    ...overrides,
  };
}

describe("Compass (am-read-return-stack-oxa)", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  it("renders null when frame is undefined", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Compass frame={undefined} onReturn={() => {}} />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders question, title, and return button for active frame", async () => {
    let returned = false;
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Compass
          frame={mockFrame()}
          onReturn={() => {
            returned = true;
          }}
        />,
      );
    });

    const nav = container.querySelector("[data-compass]");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Your place in the argument");

    const question = container.querySelector("[data-compass-question]");
    expect(question?.textContent).toBe("How do we measure fluctuating displacements?");

    const idea = container.querySelector("[data-compass-idea]");
    expect(idea?.textContent).toBe("Mean, variance and RMS");

    const returnBtn = container.querySelector("[data-compass-return]") as HTMLButtonElement | null;
    expect(returnBtn).not.toBeNull();
    returnBtn?.click();
    expect(returned).toBe(true);
  });

  it("renders depth limit replacement notice when depthLimitReplaced is true", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Compass frame={mockFrame()} depthLimitReplaced={true} onReturn={() => {}} />);
    });

    const notice = container.querySelector("[data-compass-depth-limit]");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("deepest explanation was replaced");
  });

  it("omits depth limit notice when depthLimitReplaced is false", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Compass frame={mockFrame()} depthLimitReplaced={false} onReturn={() => {}} />);
    });

    const notice = container.querySelector("[data-compass-depth-limit]");
    expect(notice).toBeNull();
  });
});
