import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { BoundaryLedgerLab } from "../components/lab/me03/BoundaryLedgerLab.tsx";
import { validateArgumentComparison } from "../content/schemas/source.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/me03/session.ts";
import labDigests from "../generated/lab-source-digests.json";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { loadPaperMargins } from "./marginRecords.ts";
import { PaperMargins } from "./PaperMargins.tsx";

const margins = loadPaperMargins("mass-energy");
const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };
let container: HTMLElement;
let root: Root | undefined;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  removeContainer(container);
  await uninstallDom();
});

function comparisonLink(presetId: string, source = margins): HTMLAnchorElement {
  const markup = document.createElement("div");
  markup.innerHTML = renderToStaticMarkup(<PaperMargins margins={source} paperId="mass-energy" />);
  const link = markup.querySelector<HTMLAnchorElement>(
    '[data-comparison-preset="' + presetId + '"]',
  );
  assert.ok(link, "The comparison did not render its selected preset.");
  return link;
}

function modePressed(label: string): boolean {
  return [...container.querySelectorAll("button")].some(
    (button) =>
      button.textContent?.trim() === label && button.getAttribute("aria-pressed") === "true",
  );
}

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++)
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 10)));
  expect(condition()).toBe(true);
}

for (const entry of [
  {
    presetId: "me-03-box-1906",
    label: "The 1906 photon in a box",
    selector: '[data-view-id="me-03-photon-box"]',
  },
  {
    presetId: "me-03-four-momentum-opposite-pulses",
    label: "Modern four-momentum",
    selector: '[data-mode="four-momentum"][data-view-id="me-03-boundary-ledger"]',
  },
]) {
  test(
    entry.presetId + " opens the accepted mode through the real comparison link and laboratory",
    async () => {
      const link = comparisonLink(entry.presetId);
      const href = link.getAttribute("href");
      expect(href?.startsWith("/lab/me-03/?tape=")).toBe(true);
      history.replaceState(null, "", href ?? "/lab/me-03/");
      root = createRoot(container);
      await act(async () => {
        root?.render(
          <BoundaryLedgerLab
            example={example}
            instanceId={"comparison-" + entry.presetId}
            showComparison={false}
          />,
        );
      });
      // The mode buttons and plot select accepted parameters, not the editable draft. A ?mode=
      // link that merely fills that draft cannot pass this check.
      await until(() => modePressed(entry.label));
      expect(modePressed("The 1905 energy ledger")).toBe(false);
      expect(container.querySelector(entry.selector)).not.toBeNull();
      const laboratory = container.querySelector<HTMLElement>("section.laboratory-shell");
      expect(laboratory?.dataset.pending).toBe("false");
      expect(laboratory?.dataset.inputRevision).toBe(laboratory?.dataset.acceptedInputRevision);
      expect(container.textContent).not.toContain("settings are loaded. The drawing still shows");
    },
  );
}

test("a missing comparison preset keeps the laboratory and names the manual selection", () => {
  const missingId = "me-03-absent-comparison";
  const missing = {
    ...margins,
    notes: margins.notes.map((note) =>
      note.comparison
        ? {
            ...note,
            comparison: {
              ...note.comparison,
              arguments: note.comparison.arguments.map((argument) =>
                argument.id === "box-1906" ? { ...argument, presetId: missingId } : argument,
              ),
            },
          }
        : note,
    ),
  };
  const link = comparisonLink(missingId, missing);
  expect(link.getAttribute("href")).toBe("/lab/me-03/");
  expect(link.textContent).toContain("choose the 1906 box");
  expect(link.parentElement?.textContent).toContain("usual settings");
});

test("comparison records retain an authored preset and refuse malformed preset identifiers", () => {
  const comparison = margins.notes.find((note) => note.comparison)?.comparison;
  expect(comparison).toBeDefined();
  if (!comparison) return;
  const box = comparison.arguments.find((argument) => argument.id === "box-1906");
  expect(box?.presetId).toBe("me-03-box-1906");
  for (const presetId of ["", " ", 7, null]) {
    expect(() =>
      validateArgumentComparison({
        ...comparison,
        arguments: comparison.arguments.map((argument) =>
          argument.id === "box-1906" ? { ...argument, presetId } : argument,
        ),
      }),
    ).toThrow("needs a presetId");
  }
});
