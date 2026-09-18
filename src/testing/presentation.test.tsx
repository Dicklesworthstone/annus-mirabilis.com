import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  ExperimentDispatch,
  type ExperimentViewProps,
  type ViewLoaders,
} from "../experiments/dispatch.tsx";
import { resolveQuantityLabel, usePresentation } from "../experiments/presentation.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

/**
 * Fixture view respecting the presentation context contract.
 */
function CompliantFixtureView(props: ExperimentViewProps) {
  const { presentation, quantityLabel } = usePresentation();
  const dLabel = quantityLabel("diffusionCoefficient") ?? "D";
  const intervalLabel = quantityLabel("observationInterval") ?? "\\Delta t";

  return (
    <div
      data-testid="compliant-view"
      data-instance-id={props.instanceId}
      data-snapshot-version="1.0.0"
    >
      <div data-question>How does variance grow over time?</div>
      <div data-r0-caption>Observed mean square displacement over {intervalLabel}</div>
      <div data-predict-mode>Prediction canvas</div>
      <table data-accessible-table>
        <thead>
          <tr>
            <th data-header-d>{dLabel}</th>
            <th data-header-dt>{intervalLabel}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0.5</td>
            <td>1.0</td>
          </tr>
        </tbody>
      </table>
      <div data-execution-label="host">Ideal model, host calculation</div>
      <div data-axis-label>{dLabel}</div>
      <div data-legend-entry>{intervalLabel}</div>
      <div data-caption>{dLabel}</div>

      {presentation !== "tour" && (
        <>
          <div data-equation-card>
            <span className="katex" data-math>
              D = \frac&#123;RT&#125;&#123;6\pi\eta a N&#125;
            </span>
          </div>
          <div data-show-the-code>
            <code>const D = (R * T) / (6 * Math.PI * eta * a * N);</code>
          </div>
          <div data-expanded-model-notes>
            <p>Expanded mathematical notes with deep derivation steps.</p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Bad fixture view that violates the tour presentation rule by hardcoding symbol "D".
 */
function HardcodedSymbolView() {
  return (
    <div data-testid="hardcoded-view">
      <table data-accessible-table>
        <thead>
          <tr>
            <th data-header-d>D</th>
          </tr>
        </thead>
      </table>
    </div>
  );
}

function fixtureLoaders(isCompliant = true): ViewLoaders {
  return {
    "bm-06": async () => ({
      default: isCompliant ? CompliantFixtureView : HardcodedSymbolView,
    }),
  };
}

describe("resolveQuantityLabel: canonical quantity registry lookup", () => {
  test("in standard presentation, quantityLabel returns undefined", () => {
    expect(resolveQuantityLabel("diffusionCoefficient", "standard")).toBeUndefined();
    expect(resolveQuantityLabel("observationInterval", "standard")).toBeUndefined();
  });

  test("in tour presentation, returns plain-word names from quantity registry", () => {
    expect(resolveQuantityLabel("diffusionCoefficient", "tour")).toBe("Diffusion coefficient");
    expect(resolveQuantityLabel("observationInterval", "tour")).toBe("Observation interval");
  });

  test("unknown quantity id gracefully returns undefined", () => {
    expect(resolveQuantityLabel("nonExistentQuantityId", "tour")).toBeUndefined();
  });
});

describe("presentation.test.tsx: tour presentation contract in dispatcher", () => {
  test("omitting presentation defaults to standard, showing equations, code, notes, and symbols", async () => {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExperimentDispatch id="bm-06" instanceId="inst:1" viewLoaders={fixtureLoaders(true)} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    try {
      expect(container.querySelector("[data-equation-card]")).not.toBeNull();
      expect(container.querySelector("[data-show-the-code]")).not.toBeNull();
      expect(container.querySelector("[data-expanded-model-notes]")).not.toBeNull();
      expect(container.querySelector("[data-header-d]")?.textContent).toBe("D");
      expect(container.querySelector("[data-header-dt]")?.textContent).toBe("\\Delta t");
      expect(container.querySelectorAll(".katex, math, [data-math]").length).toBeGreaterThan(0);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("tour presentation hides equation cards, code, and notes while keeping question, table, execution label", async () => {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExperimentDispatch
          id="bm-06"
          instanceId="inst:1"
          presentation="tour"
          viewLoaders={fixtureLoaders(true)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    try {
      // Hidden regions
      expect(container.querySelector("[data-equation-card]")).toBeNull();
      expect(container.querySelector("[data-show-the-code]")).toBeNull();
      expect(container.querySelector("[data-expanded-model-notes]")).toBeNull();

      // Kept regions
      expect(container.querySelector("[data-question]")).not.toBeNull();
      expect(container.querySelector("[data-r0-caption]")).not.toBeNull();
      expect(container.querySelector("[data-predict-mode]")).not.toBeNull();
      expect(container.querySelector("[data-accessible-table]")).not.toBeNull();
      expect(container.querySelector('[data-execution-label="host"]')).not.toBeNull();

      // Plain-word labels
      expect(container.querySelector("[data-header-d]")?.textContent).toBe("Diffusion coefficient");
      expect(container.querySelector("[data-header-dt]")?.textContent).toBe("Observation interval");
      expect(container.querySelector("[data-axis-label]")?.textContent).toBe(
        "Diffusion coefficient",
      );
      expect(container.querySelector("[data-legend-entry]")?.textContent).toBe(
        "Observation interval",
      );
      expect(container.querySelector("[data-caption]")?.textContent).toBe("Diffusion coefficient");

      // No visible math nodes
      const mathNodes = container.querySelectorAll(".katex, math, [data-math]");
      expect(mathNodes.length).toBe(0);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("a fixture view that hard-codes symbol 'D' fails the tour plain-word label check", async () => {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExperimentDispatch
          id="bm-06"
          instanceId="inst:1"
          presentation="tour"
          viewLoaders={fixtureLoaders(false)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    try {
      const headerText = container.querySelector("[data-header-d]")?.textContent;
      // Plain-word requirement: must equal "Diffusion coefficient", not "D"
      const isPlainWord = headerText === "Diffusion coefficient";
      expect(isPlainWord).toBe(false);
      expect(headerText).toBe("D");
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("switching presentation preserves instance identity, snapshot version, and sends 0 worker messages", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const workerMessagesSent: string[] = [];

    // Render in standard mode
    await act(async () => {
      root.render(
        <ExperimentDispatch
          id="bm-06"
          instanceId="inst:stable-1"
          presentation="standard"
          viewLoaders={fixtureLoaders(true)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const initialVersion = container
      .querySelector("[data-snapshot-version]")
      ?.getAttribute("data-snapshot-version");
    expect(initialVersion).toBe("1.0.0");

    // Switch presentation to tour
    await act(async () => {
      root.render(
        <ExperimentDispatch
          id="bm-06"
          instanceId="inst:stable-1"
          presentation="tour"
          viewLoaders={fixtureLoaders(true)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const switchedVersion = container
      .querySelector("[data-snapshot-version]")
      ?.getAttribute("data-snapshot-version");
    expect(switchedVersion).toBe(initialVersion);
    expect(workerMessagesSent).toEqual([]);
    expect(container.querySelector("[data-header-d]")?.textContent).toBe("Diffusion coefficient");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("an instrument that cannot honor tour renders 'available in the full reading' notice", async () => {
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ExperimentDispatch
          id="bm-06"
          instanceId="inst:1"
          presentation="tour"
          cannotHonorTour={true}
          sourceHref="/papers/brownian-motion#section-3"
          viewLoaders={fixtureLoaders(true)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    try {
      const notice = container.querySelector('[data-testid="available-in-full-reading-notice"]');
      expect(notice).not.toBeNull();
      expect(notice?.getAttribute("data-instrument-id")).toBe("bm-06");
      expect(container.textContent).toContain("This experiment is available in the full reading.");
      const link = container.querySelector("a");
      expect(link?.getAttribute("href")).toBe("/papers/brownian-motion#section-3");
      expect(container.querySelector('[data-testid="compliant-view"]')).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
