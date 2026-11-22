import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { loadMillikanOverlay } from "../../../experiments/lq08/millikanRecord.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { MillikanFigure6Panel } from "./MillikanFigure6Panel.tsx";

type Plottable = Extract<MillikanOverlayResult, { kind: "plottable" }>;
const loaded = loadMillikanOverlay();
if (loaded.kind !== "plottable") throw new TypeError("The current Millikan source was withheld.");
const data: Plottable = loaded;
const evidence = data.evidence;
const exclusionReason = data.points[5]?.slopeExclusionReason;
if (!evidence || !exclusionReason)
  throw new TypeError("The current source must carry its provenance and excluded-row reason.");

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

function required<T extends Element>(container: ParentNode, selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new TypeError(`Missing inspection element: ${selector}`);
  return found;
}

function geometry(container: ParentNode) {
  return Array.from(container.querySelectorAll("circle[data-frequency-hz]"), (point) =>
    ["data-dataset-row-index", "data-frequency-hz", "data-intercept-volts", "cx", "cy"].map(
      (name) => point.getAttribute(name),
    ),
  );
}

describe("Millikan's measured points lead to their source record", () => {
  test("the served markup includes every row's tokens, uncertainty and source links without script", () => {
    const container = createContainer();
    try {
      container.innerHTML = renderToStaticMarkup(<MillikanFigure6Panel data={data} />);
      const plain = required(container, '[data-testid="static-details-fallback"]');
      expect(
        Array.from(plain.querySelectorAll('[data-testid="tokens-table"]'), (table) =>
          table.getAttribute("data-dataset-row-index"),
        ),
      ).toEqual(["0", "1", "2", "3", "4", "5"]);
      expect(plain.textContent).toContain("118.2 × 10¹³");
      expect(plain.textContent).toContain(".52");
      expect(plain.textContent).toContain("No printed token recorded");
      expect(plain.textContent).toContain("each column's stated unit");
      expect(plain.textContent).not.toContain("All numerical columns mapped");
      expect(plain.textContent).toContain("A Direct Photoelectric Determination");
      expect(plain.textContent).not.toContain("cit-millikan-1916");
      expect(plain.querySelector('a[href$="#page=93"]')).not.toBeNull();
      expect(plain.querySelector('a[href$="#page=102"]')).not.toBeNull();
      expect(container.textContent).toContain(evidence.dataset.uncertainty.description);
      expect(container.textContent).toContain("residual-based standard error");
      expect(container.textContent).toContain("not an experimental confidence interval for h");
      expect(container.textContent).toContain(exclusionReason);
      expect(container.querySelector('[data-testid="crop-rendered"]')).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).toContain("no publication decision is recorded");
    } finally {
      removeContainer(container);
    }
  });

  test("a plotted point and a table link select the same original row without changing the plotted readings", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => root.render(<MillikanFigure6Panel data={data} />));
      const before = geometry(container);
      const lastPoint = required<SVGAElement>(container, '[data-inspect-point="5"]');
      expect(lastPoint.getAttribute("aria-label")).toContain("mercury line 2,535 Å");
      expect(lastPoint.closest("svg")?.getAttribute("role")).toBe("group");
      await act(() => {
        lastPoint.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      const inspector = required<HTMLDetailsElement>(container, "[data-millikan-inspection]");
      expect(inspector.open).toBe(true);
      expect(required(container, "[data-selected-source-row]").getAttribute("data-selected-source-row"))
        .toBe("5");
      expect(required(container, "[data-selected-source-row]").textContent)
        .toContain(exclusionReason);
      await act(() => required<HTMLButtonElement>(inspector, '[data-step-btn="2"]').click());
      const scriptedTokens = required(inspector, 'section[aria-labelledby$="-panel"] [data-testid="tokens-table"]');
      expect(scriptedTokens.getAttribute("data-dataset-row-index")).toBe("5");
      expect(scriptedTokens.textContent).toContain("118.2 × 10¹³");
      expect(scriptedTokens.textContent).toContain(".52");
      await act(() => required<HTMLAnchorElement>(container, '[data-inspect-row="3"]').click());
      expect(required(inspector, 'section[aria-labelledby$="-panel"] [data-testid="tokens-table"]')
        .getAttribute("data-dataset-row-index")).toBe("3");
      expect(required(container, "[data-selected-source-row]").textContent).toContain("3,650 Å");
      expect(geometry(container)).toEqual(before);
    } finally {
      await act(() => root.unmount());
      removeContainer(container);
    }
  });

  test("both comparison panes keep their own selection and every local evidence anchor resolves uniquely", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(
          <>
            <MillikanFigure6Panel data={data} />
            <MillikanFigure6Panel data={data} />
          </>,
        ),
      );
      const panels = Array.from(container.querySelectorAll('[data-testid="millikan-fig6-panel"]'));
      expect(panels).toHaveLength(2);
      const first = panels[0];
      const second = panels[1];
      if (!first || !second) throw new TypeError("Missing comparison pane.");
      const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const panel of panels) {
        const inspector = required(panel, "[data-millikan-inspection]");
        for (const link of panel.querySelectorAll('[data-inspect-point], [data-inspect-row]')) {
          expect(link.getAttribute("href")).toBe(`#${inspector.id}`);
          expect(document.getElementById(inspector.id)).toBe(inspector);
        }
      }
      await act(() => required<HTMLAnchorElement>(first, '[data-inspect-row="5"]').click());
      expect(required(first, "[data-selected-source-row]").getAttribute("data-selected-source-row"))
        .toBe("5");
      expect(required(second, "[data-selected-source-row]").getAttribute("data-selected-source-row"))
        .toBe("0");
    } finally {
      await act(() => root.unmount());
      removeContainer(container);
    }
  });

  test("an older admitted payload still displays its points but offers no invented source inspection", () => {
    const { evidence: omitted, ...withoutEvidence } = data;
    expect(omitted).toBeDefined();
    const legacy: Plottable = {
      ...withoutEvidence,
      points: data.points.map((point) => {
        const oldPoint = { ...point };
        delete oldPoint.rowIndex;
        return oldPoint;
      }),
    };
    const html = renderToStaticMarkup(<MillikanFigure6Panel data={legacy} />);
    expect(html).toContain('data-intercept-volts="0.52"');
    expect(html).not.toContain("data-millikan-inspection");
    expect(html).not.toContain("data-inspect-point");
    expect(html).not.toContain("data-dataset-row-index");
    expect(html).not.toContain("data-source-row");
    expect(html).not.toContain("NaN");
    expect(html).toContain("Displayed point 1");
    expect(html).toContain("Displayed point 6");
    expect(html).toContain("describe only this list");
    expect(html).not.toContain('data-testid="dataset-evidence-reveal"');
  });
});
