import { GlobalRegistrator } from "@happy-dom/global-registrator";

type TestIntersectionObserver = IntersectionObserver & { readonly targets: Set<Element> };
let intersectionObservers: Set<TestIntersectionObserver> | null = null;

export class TestIntersectionStateError extends DOMException {
  readonly refusalCode: "test-intersection-not-installed";

  constructor(refusalCode: "test-intersection-not-installed") {
    super("Install the DOM with explicit intersections first.", "InvalidStateError");
    this.refusalCode = refusalCode;
  }
}

function requireIntersectionState(): Set<TestIntersectionObserver> {
  if (!intersectionObservers)
    throw new TestIntersectionStateError("test-intersection-not-installed");
  return intersectionObservers;
}

export interface TestDomOptions {
  /** happy-dom has no layout engine: opt in to measured entries instead of its inert observer. */
  readonly intersections?: "visible" | "manual";
}

function intersectionEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  const bounds = target.getBoundingClientRect();
  return {
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: bounds,
    intersectionRect: isIntersecting ? bounds : new DOMRect(),
    rootBounds: null,
    time: performance.now(),
  };
}

const intersectionCallbacks = new WeakMap<IntersectionObserver, IntersectionObserverCallback>();

/** Emit only to observers of this actual element, so a wrongly attached ref cannot pass a test. */
export function emitTestIntersection(target: Element, isIntersecting: boolean): number {
  const observers = requireIntersectionState();
  let delivered = 0;
  for (const observer of observers) {
    if (!observer.targets.has(target)) continue;
    intersectionCallbacks.get(observer)?.([intersectionEntry(target, isIntersecting)], observer);
    delivered++;
  }
  return delivered;
}

export function observedTestIntersections(): readonly Element[] {
  const observers = requireIntersectionState();
  return [...new Set([...observers].flatMap((observer) => [...observer.targets]))];
}

function installTestIntersections(mode: "visible" | "manual") {
  const observers = new Set<TestIntersectionObserver>();
  intersectionObservers = observers;
  class MeasuredIntersectionObserver implements TestIntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly thresholds: readonly number[];
    readonly targets = new Set<Element>();

    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.root = options.root ?? null;
      this.rootMargin = options.rootMargin ?? "0px";
      this.thresholds = Array.isArray(options.threshold)
        ? [...options.threshold].sort((a, b) => a - b)
        : [options.threshold ?? 0];
      intersectionCallbacks.set(this, callback);
    }

    observe(target: Element) {
      if (this.targets.has(target)) return;
      this.targets.add(target);
      observers.add(this);
      if (mode === "visible") {
        // Real observers deliver their initial measurement asynchronously. Disconnect/unobserve
        // before this turn prevents a fabricated notification after React's effect cleanup.
        queueMicrotask(() => {
          if (this.targets.has(target)) {
            intersectionCallbacks.get(this)?.([intersectionEntry(target, true)], this);
          }
        });
      }
    }

    unobserve(target: Element) {
      this.targets.delete(target);
      if (!this.targets.size) observers.delete(this);
    }

    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MeasuredIntersectionObserver,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MeasuredIntersectionObserver,
  });
}

/**
 * The React DOM test harness this bead stands up (am-rt-snapshot-store-aft):
 * there is no `testing-library` in this repository, so remount, StrictMode,
 * and hydration behavior have never been exercised. `installDom` registers
 * happy-dom as the global DOM for the duration of one test; `uninstallDom`
 * tears it down so no state or timer leaks into the next test. Call both
 * around every test that mounts a React tree, never once per file: a shared
 * `document` across tests is exactly the kind of hidden global state this
 * bead's store replaces.
 */
export async function installDom(options: TestDomOptions = {}): Promise<void> {
  GlobalRegistrator.register({ url: "http://localhost/" });
  if (options.intersections) installTestIntersections(options.intersections);
  // React's `act()` refuses to run outside an environment that declares
  // this flag; without it every act() call warns and passive effects are
  // not guaranteed to flush before the next assertion.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

export async function uninstallDom(): Promise<void> {
  if (intersectionObservers) {
    for (const observer of intersectionObservers) observer.disconnect();
    intersectionObservers = null;
  }
  await GlobalRegistrator.unregister();
}

export function createContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

export function removeContainer(container: HTMLElement): void {
  container.remove();
}
