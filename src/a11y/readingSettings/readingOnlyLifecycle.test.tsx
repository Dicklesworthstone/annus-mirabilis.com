import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, useEffect } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  ExperimentDispatch,
  type ExperimentViewProps,
  type ViewLoader,
  type ViewLoaders,
} from "../../experiments/dispatch.tsx";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";

const logger = getLogger("a11y-reading-only");
let root: Root | undefined;
let container: HTMLElement;
let restoreProbe: (() => void) | undefined;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  restoreProbe?.();
  restoreProbe = undefined;
  removeContainer(container);
  await uninstallDom();
});

function trackedView() {
  const counts = { imports: 0, mounts: 0, disposals: 0, active: 0 };
  function View({ instanceId }: ExperimentViewProps) {
    useEffect(() => {
      counts.mounts++;
      counts.active++;
      return () => {
        counts.disposals++;
        counts.active--;
      };
    }, []);
    return <p data-live-experiment={instanceId}>An interactive comparison</p>;
  }
  const loader: ViewLoader = async () => {
    counts.imports++;
    return { default: View };
  };
  return { counts, loader, View };
}

function experiment(viewLoaders: ViewLoaders, readingOnly?: boolean, instanceId = "reading-test") {
  return (
    <ExperimentDispatch
      id="bm-06"
      instanceId={instanceId}
      viewLoaders={viewLoaders}
      readingOnly={readingOnly}
    />
  );
}

async function mount(viewLoaders: ViewLoaders, readingOnly?: boolean) {
  root = createRoot(container);
  await act(async () => root?.render(experiment(viewLoaders, readingOnly)));
}

async function preference(value: "on" | "off") {
  await act(async () => {
    document.documentElement.dataset.readingOnly = value;
    // MutationObserver delivery is asynchronous, as in the real preferences panel.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function load() {
  const button = container.querySelector<HTMLButtonElement>("[data-load-experiment]");
  expect(button).not.toBeNull();
  expect(button?.disabled).toBe(false);
  await act(async () => button?.click());
}

function staticCaseRemains() {
  expect(container.querySelector("[data-static-worked-case]")?.textContent).toBeTruthy();
  expect(container.querySelector("[data-explanation]")?.textContent).toBeTruthy();
}

function passed(testId: string, message: string) {
  logger.log({
    testId,
    beadId: "am-a11y-reading-only-6wwd",
    instrumentId: "bm-06",
    outcome: "passed",
    message,
  });
}

describe("reading-only owns the entire live loading lifecycle", () => {
  test("the server serves the worked case without starting a lazy import", () => {
    const { counts, loader } = trackedView();
    const html = renderToString(experiment({ "bm-06": loader }));
    expect(counts.imports).toBe(0);
    expect(counts.mounts).toBe(0);
    expect(html).toContain("data-static-worked-case");
    expect(html).toContain("data-explanation");
    expect(html).toContain('data-reading-only-instrument="pending"');
    expect(html).not.toContain("data-live-experiment");
    passed("server-defers-live-import", "No-script markup keeps the worked case without live imports.");
  });

  test("a saved on preference hydrates without importing or mounting the live view", async () => {
    const { counts, loader } = trackedView();
    const view = experiment({ "bm-06": loader });
    container.innerHTML = renderToString(view);
    document.documentElement.dataset.readingOnly = "on";
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, view, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(counts.imports).toBe(0);
    expect(counts.active).toBe(0);
    staticCaseRemains();
    await load();
    expect(counts.imports).toBe(1);
    expect(counts.active).toBe(1);
    staticCaseRemains();
    passed("saved-on-hydration", "Saved reading-only defers all live work until the load action.");
  });

  test("the default preference hydrates the same markup and then enables interaction", async () => {
    const { counts, loader } = trackedView();
    const view = experiment({ "bm-06": loader });
    container.innerHTML = renderToString(view);
    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, view, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(counts.imports).toBe(1);
    expect(counts.active).toBe(1);
    staticCaseRemains();
    passed("default-hydration", "Default hydration is consistent and enables the live comparison.");
  });

  test("blocked storage cannot bypass the pre-paint preference or break later toggles", async () => {
    const { counts, loader } = trackedView();
    document.documentElement.dataset.readingOnly = "on";
    let storageReads = 0;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        storageReads++;
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
    await mount({ "bm-06": loader });
    expect(counts.imports).toBe(0);
    expect(storageReads).toBe(0);
    await preference("off");
    expect(counts.imports).toBe(1);
    expect(counts.active).toBe(1);
    staticCaseRemains();
    passed("blocked-storage-preference", "The applied preference works without reading blocked storage.");
  });

  test("enabling reading-only disposes live resources and revokes an earlier explicit load", async () => {
    const { counts, loader } = trackedView();
    await mount({ "bm-06": loader });
    expect(counts.active).toBe(1);
    await preference("on");
    expect(counts.active).toBe(0);
    expect(counts.disposals).toBe(1);
    staticCaseRemains();
    await load();
    expect(counts.active).toBe(1);
    await preference("off");
    expect(counts.active).toBe(1);
    expect(counts.disposals).toBe(1);
    await preference("on");
    expect(counts.active).toBe(0);
    expect(counts.disposals).toBe(2);
    expect(counts.imports).toBe(1);
    staticCaseRemains();
    passed("preference-revokes-load", "Re-enabling reading-only releases resources and asks before loading again.");
  });

  test("a module resolving after reading-only is enabled cannot mount a hidden view", async () => {
    const { counts, View } = trackedView();
    let resolveModule: ((module: { default: typeof View }) => void) | undefined;
    const loader: ViewLoader = () => {
      counts.imports++;
      return new Promise((resolve) => {
        resolveModule = resolve;
      });
    };
    await mount({ "bm-06": loader });
    expect(counts.imports).toBe(1);
    expect(counts.active).toBe(0);
    await preference("on");
    expect(resolveModule).toBeDefined();
    await act(async () => resolveModule?.({ default: View }));
    expect(counts.mounts).toBe(0);
    staticCaseRemains();
    await load();
    expect(counts.active).toBe(1);
    passed("pending-import-revoked", "A late module completion cannot start resources without permission.");
  });

  test("an explicit load belongs to one experiment instance", async () => {
    const { counts, loader } = trackedView();
    const loaders = { "bm-06": loader };
    await mount(loaders, true);
    await load();
    expect(counts.active).toBe(1);
    await act(async () => root?.render(experiment(loaders, true, "another-reading-test")));
    expect(counts.active).toBe(0);
    expect(counts.disposals).toBe(1);
    staticCaseRemains();
    await load();
    expect(counts.active).toBe(1);
    expect(container.querySelector('[data-live-experiment="another-reading-test"]')).not.toBeNull();
    passed("load-scoped-to-instance", "A different experiment instance requires its own explicit load.");
  });

  test("a controlled preference takes effect without retaining a prior load grant", async () => {
    const { counts, loader } = trackedView();
    const loaders = { "bm-06": loader };
    await mount(loaders, true);
    await load();
    await act(async () => root?.render(experiment(loaders, false)));
    expect(counts.active).toBe(1);
    await act(async () => root?.render(experiment(loaders, true)));
    expect(counts.active).toBe(0);
    expect(container.querySelector("[data-load-experiment]")).not.toBeNull();
    staticCaseRemains();
    passed("controlled-preference-revokes-load", "A controlled reading-only change revokes the earlier grant.");
  });

  test("reading-only defers GPU probing and the probe releases its temporary context", async () => {
    const { counts, loader } = trackedView();
    document.documentElement.dataset.readingOnly = "on";
    Object.defineProperty(window, "WebGLRenderingContext", { configurable: true, value: class {} });
    let probes = 0;
    let released = 0;
    const probe = spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      probes++;
      return {
        getExtension: () => ({ loseContext: () => released++ }),
      } as unknown as WebGLRenderingContext;
    });
    restoreProbe = () => probe.mockRestore();
    await mount({ "bm-06": { webgl: loader } });
    expect(probes).toBe(0);
    expect(counts.imports).toBe(0);
    await load();
    expect(probes).toBeGreaterThan(0);
    expect(released).toBe(probes);
    expect(counts.active).toBe(1);
    passed("gpu-probe-after-load", "GPU capability checks wait for permission and release their probe contexts.");
  });
});
