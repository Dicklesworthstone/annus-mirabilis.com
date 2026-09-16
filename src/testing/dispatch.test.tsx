import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ExperimentDispatch, type ViewLoaders } from "../experiments/dispatch.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

/** Two fixture views, so a wrong-instrument leak would be visible: if the unknown-id case ever rendered a substitute, it would render one of these. */
const rendered: string[] = [];
function fixtureLoaders(): ViewLoaders {
  rendered.length = 0;
  return {
    "bm-06": async () => ({
      default: (props: { instanceId: string }) => {
        rendered.push(`bm-06:${props.instanceId}`);
        return <div data-testid="fixture-bm-06">bm-06 fixture view</div>;
      },
    }),
    "bm-07": async () => ({
      default: (props: { instanceId: string }) => {
        rendered.push(`bm-07:${props.instanceId}`);
        return <div data-testid="fixture-bm-07">bm-07 fixture view</div>;
      },
    }),
  };
}

async function renderDispatch(container: HTMLElement, id: string, viewLoaders: ViewLoaders = {}) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<ExperimentDispatch id={id} instanceId="test:1" viewLoaders={viewLoaders} />);
  });
  // Flush the microtask queue so a lazy-loaded fixture view's dynamic
  // import resolves and Suspense commits its real child before assertions.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe("ExperimentDispatch: the unknown-id planted negative", () => {
  test("an unknown id renders the explicit 'not available here' state and no other instrument renders", async () => {
    const container = createContainer();
    const loaders = fixtureLoaders();
    const root = await renderDispatch(container, "wright-flyer", loaders);
    try {
      expect(container.querySelector('[data-testid="unknown-experiment-notice"]')).not.toBeNull();
      expect(container.textContent).toContain("This experiment is not available here.");
      expect(container.textContent).toContain("wright-flyer");
      expect(container.querySelector('[data-testid="fixture-bm-06"]')).toBeNull();
      expect(container.querySelector('[data-testid="fixture-bm-07"]')).toBeNull();
      expect(rendered).toEqual([]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("a catalogue id outside the registered five is 'unknown to the fixture set' but still resolves in-preparation, not a substitute view", async () => {
    const container = createContainer();
    const loaders = fixtureLoaders();
    const root = await renderDispatch(container, "lq-01", loaders);
    try {
      expect(container.querySelector('[data-testid="in-preparation-notice"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="fixture-bm-06"]')).toBeNull();
      expect(container.querySelector('[data-testid="fixture-bm-07"]')).toBeNull();
      expect(rendered).toEqual([]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});

describe("ExperimentDispatch: in-preparation state", () => {
  test("a catalogue id without a manifest shows the notice, with no controls or numbers", async () => {
    const container = createContainer();
    const root = await renderDispatch(container, "bm-02");
    try {
      const notice = container.querySelector('[data-testid="in-preparation-notice"]');
      expect(notice).not.toBeNull();
      expect(notice?.getAttribute("data-instrument-id")).toBe("bm-02");
      expect(container.querySelector("input, button, canvas, svg")).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("bm-05's authored question renders in the notice", async () => {
    const container = createContainer();
    // bm-05 is registered (has a real owner), but this test supplies no
    // view loader, so it renders through the same in-preparation surface
    // ("registered but no live view wired yet") -- see dispatch.tsx's
    // documented behavior for that branch. It still carries bm-05's
    // authored question because the notice reads it from the resolved
    // registry entry, not from catalogue status alone.
    const root = await renderDispatch(container, "bm-05");
    try {
      expect(container.textContent).toContain(
        "After many steps, what will changing the step law while keeping its variance do?",
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});

describe("ExperimentDispatch: registered id with a real fixture view loader", () => {
  test("lazy-loads and renders the supplied view, with the mode-less address on the root", async () => {
    const container = createContainer();
    const loaders = fixtureLoaders();
    const root = await renderDispatch(container, "bm-06", loaders);
    try {
      const view = container.querySelector('[data-testid="fixture-bm-06"]');
      expect(view).not.toBeNull();
      expect(rendered).toEqual(["bm-06:test:1"]);
      const address = container.querySelector("[data-instrument-id]");
      expect(address?.getAttribute("data-instrument-id")).toBe("bm-06");
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("two dispatches of different registered ids never cross-render each other's view", async () => {
    const containerA = createContainer();
    const containerB = createContainer();
    const loaders = fixtureLoaders();
    const rootA = await renderDispatch(containerA, "bm-06", loaders);
    const rootB = await renderDispatch(containerB, "bm-07", loaders);
    try {
      expect(containerA.querySelector('[data-testid="fixture-bm-06"]')).not.toBeNull();
      expect(containerA.querySelector('[data-testid="fixture-bm-07"]')).toBeNull();
      expect(containerB.querySelector('[data-testid="fixture-bm-07"]')).not.toBeNull();
      expect(containerB.querySelector('[data-testid="fixture-bm-06"]')).toBeNull();
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
