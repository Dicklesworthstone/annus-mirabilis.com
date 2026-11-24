import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BM06_DEFAULTS,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
} from "../../experiments/bm06/definition.ts";
import {
  type AcceptedSnapshot,
  createInstanceStore,
} from "../../experiments/store/instanceStore.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { DistributionComparison } from "./DistributionComparison.tsx";
import { DistributionPlot } from "./DistributionPlot.tsx";

function createOwner() {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "distribution-comparison-test",
    initialParameters: BM06_DEFAULTS,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  return {
    store,
    async accept(
      patch: Partial<typeof BM06_DEFAULTS> = {},
      command: "setup-change" | "measurement-change" = "setup-change",
    ) {
      const token = store.issue(command, patch);
      const evaluated = await evaluateBm06(token.parameters);
      expect(evaluated.kind).toBe("accepted");
      if (evaluated.kind !== "accepted")
        throw new Error("The fixture must be an accepted calculation.");
      expect(store.publish({ ...token, ...evaluated.data, final: true }).accepted).toBe(true);
      return store.getSnapshot().accepted as AcceptedSnapshot;
    },
  };
}

test("no-JavaScript keeps the worked curve and table without inert comparison controls", async () => {
  const owner = createOwner();
  const snapshot = await owner.accept();
  const html = renderToStaticMarkup(
    <>
      <DistributionPlot snapshot={snapshot} clipId="static-comparison" />
      <DistributionComparison snapshot={snapshot} requestState="accepted" />
    </>,
  );
  expect(html).toContain("Read the curve as numbers");
  expect(html).toContain("The accepted density at the plotted points");
  expect(html).not.toContain("Hold this accepted distribution");
  expect(html).not.toContain("Replace held distribution");
  expect(html).not.toContain("Clear held distribution");
  expect(html).toContain("Comparing two calculations requires JavaScript");
  expect(html).not.toContain("data-held-run-id");
});

describe("holding a real accepted BM-06 distribution", () => {
  let container: HTMLElement;
  let root: Root;
  let owner: ReturnType<typeof createOwner>;

  async function render() {
    const view = owner.store.getSnapshot();
    const snapshot = view.accepted as AcceptedSnapshot;
    await act(async () =>
      root.render(<DistributionComparison snapshot={snapshot} requestState={view.status} />),
    );
    const details = container.querySelector("details");
    if (details) details.open = true;
  }

  beforeEach(async () => {
    installDom();
    container = createContainer();
    root = createRoot(container);
    owner = createOwner();
    await owner.accept();
    await render();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  async function press(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }

  function values(label: string) {
    const row = [...container.querySelectorAll("tbody tr")].find(
      (item) => item.querySelector("th")?.textContent === label,
    );
    expect(row).toBeDefined();
    return [...(row?.querySelectorAll("td") ?? [])].map((cell) => cell.textContent);
  }

  function points(className: string) {
    const plot = container.querySelector(`polyline.${className}`);
    expect(plot).not.toBeNull();
    return (plot?.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
  }

  test("holding changes no scientific state and wider curves share one scale", async () => {
    const before = owner.store.getSnapshot();
    await press("Hold this accepted distribution");
    expect(owner.store.getSnapshot()).toBe(before);
    const held = before.accepted as AcceptedSnapshot;
    const current = await owner.accept({ t: 4 });
    await render();

    expect(container.querySelector("[data-held-run-id]")?.getAttribute("data-held-run-id")).toBe(
      held.runId,
    );
    expect(
      container.querySelector("[data-distribution-comparison]")?.getAttribute("data-run-id"),
    ).toBe(current.runId);
    expect(values("Elapsed time (s)")).toEqual(["1", "4"]);
    expect(values("Temperature (K)")).toEqual(["293.15", "293.15"]);
    const narrow = points("comparison-curve");
    const wide = points("curve");
    const heldCurve = container.querySelector("polyline.comparison-curve");
    const latestCurve = container.querySelector("polyline.curve");
    expect(heldCurve?.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(heldCurve?.getAttribute("fill")).toBe("none");
    expect(latestCurve?.getAttribute("stroke")).toBe("currentColor");
    expect(latestCurve?.getAttribute("stroke-dasharray")).toBeNull();
    const width = (curve: number[][]) => (curve.at(-1)?.[0] ?? 0) - (curve[0]?.[0] ?? 0);
    expect(width(wide)).toBeCloseTo(2 * width(narrow), 10);
    expect(wide[Math.floor(wide.length / 2)]?.[1]).toBeGreaterThan(
      narrow[Math.floor(narrow.length / 2)]?.[1] ?? 0,
    );

    const acceptedState = owner.store.getSnapshot();
    await press("Replace held distribution");
    expect(owner.store.getSnapshot()).toBe(acceptedState);
    expect(values("Elapsed time (s)")).toEqual(["4", "4"]);
    await press("Clear held distribution");
    expect(owner.store.getSnapshot()).toBe(acceptedState);
    expect(container.querySelector("[data-held-run-id]")).toBeNull();
  });

  test("pending and refused requests cannot relabel accepted data", async () => {
    await press("Hold this accepted distribution");
    await owner.accept({ t: 4 });
    const current = await owner.accept({ lower: -2e-6, upper: 2e-6 }, "measurement-change");
    await render();
    const curves = [points("comparison-curve"), points("curve")];
    const request = owner.store.issue("setup-change", { t: -1 });
    await render();
    expect(
      container
        .querySelector("[data-comparison-request-state]")
        ?.getAttribute("data-comparison-request-state"),
    ).toBe("pending");
    expect(values("Elapsed time (s)")).toEqual(["1", "4"]);
    expect(values("Selected interval (μm)")).toEqual(["[−1, 1]", "[−2, 2]"]);
    expect(owner.store.getSnapshot().accepted).toBe(current);

    const evaluated = await evaluateBm06(request.parameters);
    expect(evaluated.kind).toBe("refused");
    if (evaluated.kind !== "refused") throw new Error("Negative elapsed time must be refused.");
    expect(owner.store.refuse(request, evaluated.refusal).accepted).toBe(true);
    await render();
    expect(container.textContent).toContain("The requested settings were refused");
    expect(values("Elapsed time (s)")).toEqual(["1", "4"]);
    expect([points("comparison-curve"), points("curve")]).toEqual(curves);
    expect(owner.store.getSnapshot().accepted).toBe(current);
  });

  test("zero elapsed time remains a point distribution, with no invented density", async () => {
    await press("Hold this accepted distribution");
    await owner.accept({ t: 0 });
    await render();
    expect(container.querySelector("polyline.curve")).toBeNull();
    expect(container.querySelector("line.curve")).not.toBeNull();
    expect(container.querySelector("desc")?.textContent).toContain("not a finite density height");
    expect(values("Distribution")[1]).toBe(
      "All probability at the starting point; no finite density",
    );
    expect(values("RMS displacement (μm)")[1]).toBe("0");

    // Holding the zero-time result must preserve a visible, dashed point marker when a
    // later finite curve arrives. A polyline-only theme selector cannot supply these strokes.
    await press("Replace held distribution");
    await owner.accept({ t: 4 });
    await render();
    const pointShapes = [
      container.querySelector("line.comparison-curve"),
      container.querySelector("path.comparison-curve"),
    ];
    for (const shape of pointShapes) {
      expect(shape).not.toBeNull();
      expect(shape?.getAttribute("fill")).toBe("none");
      expect(shape?.getAttribute("stroke")).toBe("currentColor");
      expect(shape?.getAttribute("stroke-width")).toBe("2");
      expect(shape?.getAttribute("stroke-dasharray")).toBe("6 4");
    }
    expect(values("Elapsed time (s)")).toEqual(["0", "4"]);
    expect(values("Distribution")[0]).toBe(
      "All probability at the starting point; no finite density",
    );
  });
});
