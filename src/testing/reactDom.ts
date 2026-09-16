import { GlobalRegistrator } from "@happy-dom/global-registrator";

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
export async function installDom(): Promise<void> {
  GlobalRegistrator.register({ url: "http://localhost/" });
  // React's `act()` refuses to run outside an environment that declares
  // this flag; without it every act() call warns and passive effects are
  // not guaranteed to flush before the next assertion.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

export async function uninstallDom(): Promise<void> {
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
