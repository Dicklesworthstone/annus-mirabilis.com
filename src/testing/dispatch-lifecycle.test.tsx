import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ExperimentDispatch,
  type ExperimentViewProps,
  type ViewLoader,
  type ViewLoaders,
} from "../experiments/dispatch.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);

function instrument() {
  const events: string[] = [];
  let loads = 0;
  function View({ instanceId, presentation }: ExperimentViewProps) {
    const [steps, setSteps] = useState(0);
    useEffect(() => {
      events.push(`mount:${instanceId}`);
      return () => {
        events.push(`dispose:${instanceId}`);
      };
    }, [instanceId]);
    return (
      <button type="button" data-steps={steps} onClick={() => setSteps((value) => value + 1)}>
        {instanceId}: {steps} ({presentation})
      </button>
    );
  }
  const loader: ViewLoader = async () => {
    loads += 1;
    return { default: View };
  };
  return {
    loader,
    events,
    get loads() {
      return loads;
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>("button[data-steps]");
  expect(button).not.toBeNull();
  await act(async () => {
    button?.click();
  });
}

function steps(container: HTMLElement) {
  return container.querySelector("button[data-steps]")?.getAttribute("data-steps");
}

describe("dispatcher preserves the world, but not another instance's state", () => {
  test("parent and presentation updates do not reload, reset or dispose the running view", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const fixture = instrument();
    try {
      await act(async () => {
        root.render(
          <ExperimentDispatch
            id="bm-06"
            instanceId="run:1"
            viewLoaders={{ "bm-06": fixture.loader }}
          />,
        );
      });
      await flush();
      await advance(container);
      await advance(container);
      await act(async () => {
        // A newly assembled loader map is harmless when its loader is stable.
        root.render(
          <ExperimentDispatch
            id="bm-06"
            instanceId="run:1"
            presentation="tour"
            sourceHref="#changed"
            viewLoaders={{ "bm-06": fixture.loader }}
          />,
        );
      });
      await flush();
      expect(steps(container)).toBe("2");
      expect(container.textContent).toContain("(tour)");
      expect(fixture.loads).toBe(1);
      expect(fixture.events).toEqual(["mount:run:1"]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
    expect(fixture.events).toEqual(["mount:run:1", "dispose:run:1"]);
  });

  test("changing instance identity disposes the previous run and starts with clean state", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const fixture = instrument();
    const loaders: ViewLoaders = { "bm-06": fixture.loader };
    try {
      await act(async () => {
        root.render(<ExperimentDispatch id="bm-06" instanceId="old" viewLoaders={loaders} />);
      });
      await flush();
      await advance(container);
      await act(async () => {
        root.render(<ExperimentDispatch id="bm-06" instanceId="new" viewLoaders={loaders} />);
      });
      await flush();
      expect(steps(container)).toBe("0");
      expect(fixture.loads).toBe(1);
      expect(fixture.events).toEqual(["mount:old", "dispose:old", "mount:new"]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("switching catalogue id cannot inherit state when one view serves both", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const fixture = instrument();
    const loaders: ViewLoaders = { "bm-06": fixture.loader, "bm-07": fixture.loader };
    try {
      await act(async () => {
        root.render(<ExperimentDispatch id="bm-06" instanceId="slot" viewLoaders={loaders} />);
      });
      await flush();
      await advance(container);
      await act(async () => {
        root.render(<ExperimentDispatch id="bm-07" instanceId="slot" viewLoaders={loaders} />);
      });
      await flush();
      expect(steps(container)).toBe("0");
      expect(fixture.events).toEqual(["mount:slot", "dispose:slot", "mount:slot"]);
      expect(fixture.loads).toBe(1);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("two mounted instances share loaded code, never mutable view state", async () => {
    const containerA = createContainer();
    const containerB = createContainer();
    const rootA = createRoot(containerA);
    const rootB = createRoot(containerB);
    const fixture = instrument();
    const loaders: ViewLoaders = { "bm-06": fixture.loader };
    try {
      await act(async () => {
        rootA.render(<ExperimentDispatch id="bm-06" instanceId="a" viewLoaders={loaders} />);
        rootB.render(<ExperimentDispatch id="bm-06" instanceId="b" viewLoaders={loaders} />);
      });
      await flush();
      await advance(containerA);
      expect(steps(containerA)).toBe("1");
      expect(steps(containerB)).toBe("0");
      expect(fixture.loads).toBe(1);
    } finally {
      await act(async () => {
        rootA.unmount();
        rootB.unmount();
      });
      removeContainer(containerA);
      removeContainer(containerB);
    }
  });
});
