import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Formula } from "../components/edition/Formula.tsx";
import { JourneyInPreparation } from "../discovery/JourneyInPreparation.tsx";
import { MassEnergyArgumentWorkbench } from "../discovery/MassEnergyArgumentWorkbench.tsx";
import {
  ARGUMENT_STEPS,
  decodeArgument,
  encodeArgument,
  WORKED_ARGUMENT,
} from "../discovery/massEnergyArgument.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

const equations = Object.fromEntries(
  ARGUMENT_STEPS.map((card) => [card.id, <Formula key={card.id} latex={card.latex} />]),
);

async function mounted(check: (container: HTMLElement) => Promise<void>) {
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<MassEnergyArgumentWorkbench equations={equations} />);
    });
    await check(container);
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
}

async function click(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) =>
      element.getAttribute("aria-label") === label || element.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  expect(button?.disabled).toBe(false);
  await act(async () => {
    button?.click();
  });
}

function outcome(container: HTMLElement) {
  return container.querySelector("[data-argument-outcome]")?.getAttribute("data-argument-outcome");
}

describe("mass-energy argument reading and interaction", () => {
  test("all equations compile and the SSR deck is readable before JavaScript", () => {
    const html = renderToStaticMarkup(<MassEnergyArgumentWorkbench equations={equations} />);
    expect(html).toContain("<math");
    expect(html).toContain("<noscript>");
    expect(html).toContain('data-ready="false"');
    for (const card of ARGUMENT_STEPS) expect(html).toContain(card.title);
    const shell = document.createElement("div");
    shell.innerHTML = html;
    expect(shell.querySelectorAll(".argument-deck > li").length).toBe(16);
    expect(Array.from(shell.querySelectorAll("button")).every((button) => button.disabled)).toBe(
      true,
    );
    expect(shell.querySelectorAll(".argument-deck math").length).toBe(16);
  });

  test("the worked route, relaxed premise, focus return and repair are real controls", async () => {
    await mounted(async (container) => {
      await click(container, "Load the two-ledger route");
      expect(outcome(container)).toBe("inertia-derived");
      await click(container, "Remove: Admit the unchanged-offset premise");
      expect(outcome(container)).toBe("offset-unresolved");
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Add: Admit the unchanged-offset premise",
      );
      await click(container, "Add: Admit the unchanged-offset premise");
      // Appending a premise cannot retroactively support earlier algebra.
      expect(outcome(container)).toBe("offset-unresolved");
      for (let i = 0; i < 4; i++)
        await click(container, "Move earlier: Admit the unchanged-offset premise");
      expect(outcome(container)).toBe("inertia-derived");
      await click(container, "Move later: Admit the unchanged-offset premise");
      expect(outcome(container)).toBe("offset-unresolved");
    });
  });

  test("the assumed-rest-energy branch is shown as a consistency check", async () => {
    await mounted(async (container) => {
      await click(container, "Explore the assumed-rest-energy route");
      expect(outcome(container)).toBe("consistency-check");
      expect(
        container
          .querySelector('[data-card-id="rest-energy-check"]')
          ?.getAttribute("data-step-status"),
      ).toBe("consistency-only");
      await click(container, "Clear selected cards");
      expect(outcome(container)).toBe("incomplete");
      expect(container.querySelectorAll(".argument-selection > li").length).toBe(0);
    });
  });

  test("shared state is restored and recomputed, never trusted as an assessment", async () => {
    window.history.replaceState(
      {},
      "",
      `/discover/mass-energy/investigate/${encodeArgument(WORKED_ARGUMENT)}&outcome=consistency-check`,
    );
    await mounted(async (container) => {
      expect(outcome(container)).toBe("inertia-derived");
      expect(container.querySelectorAll(".argument-selection > li").length).toBe(14);
      expect(container.textContent).toContain("Restored the shared card order");
    });
  });

  test("invalid shared state leaves an usable empty workbench with an explanation", async () => {
    window.history.replaceState(
      {},
      "",
      "/discover/mass-energy/investigate/?proof=2&steps=inertia-loss",
    );
    await mounted(async (container) => {
      expect(outcome(container)).toBe("incomplete");
      expect(container.textContent).toContain("No shared cards were applied");
      await click(container, "Load the two-ledger route");
      expect(outcome(container)).toBe("inertia-derived");
    });
  });

  test("share links discard unrelated query fields and are invalidated by edits", async () => {
    window.history.replaceState(
      {},
      "",
      "/discover/mass-energy/investigate/?note=private&other=discard",
    );
    await mounted(async (container) => {
      await click(container, "Load the two-ledger route");
      await click(container, "Create a share link without the note");
      const anchor = container.querySelector<HTMLAnchorElement>(".argument-share a");
      expect(anchor).not.toBeNull();
      const url = new URL(anchor!.href);
      expect(url.searchParams.has("note")).toBe(false);
      expect(url.searchParams.has("other")).toBe(false);
      expect(url.hash).toBe("#argument-workbench");
      const shared = decodeArgument(url.search);
      expect(shared.kind).toBe("argument");
      if (shared.kind === "argument") expect(shared.order).toEqual(WORKED_ARGUMENT);
      await click(container, "Remove: Admit the unchanged-offset premise");
      expect(container.querySelector(".argument-share")).toBeNull();
    });
  });

  test("front-door link does not present the investigation as Journey IV", () => {
    const render = (paperId: string) =>
      renderToStaticMarkup(
        <JourneyInPreparation
          paperId={paperId}
          germanTitle="Source title"
          englishTitle="Working title"
        />,
      );
    const mass = render("mass-energy");
    expect(mass).toContain('href="/discover/mass-energy/investigate/"');
    expect(mass).toContain("data-journey-in-preparation");
    // It says what the investigation is not, in plain words, and nothing of review
    // (D-2026-09-25-no-review-status-banners).
    expect(mass).toContain("is not the");
    expect(mass).toContain("full journey or its historical knowledge shelf");
    expect(mass).not.toContain("reviewed");
    for (const paper of ["brownian-motion", "light-quanta", "special-relativity"]) {
      expect(render(paper)).not.toContain("/discover/mass-energy/investigate/");
    }
  });
});
