import { VisibilityCoordinator } from "./visibility.ts";

export interface VisibilityControlledSession {
  setSchedulingPaused(paused: boolean): void;
}

/**
 * Bind the actual laboratory region to its existing owner. These laboratories calculate only
 * after an explicit action, so reduced motion keeps manual calculations available. Visibility
 * pauses dispatch, preserving the accepted result, queued input, worker and random stream.
 */
export function bindLaboratoryVisibility(
  element: HTMLElement,
  session: VisibilityControlledSession,
  observationRegion: HTMLElement = element,
): () => void {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return () => {};
  const hasObserver = typeof view.IntersectionObserver === "function";
  const coordinator = new VisibilityCoordinator({
    initialDocumentVisible: document.visibilityState !== "hidden",
    // Wait for the first measured intersection before starting work. Browsers without the
    // observer retain their manual controls and still pause for background tabs and pagehide.
    initialIntersecting: !hasObserver,
  });
  let disposed = false;
  const update = () => {
    if (disposed) return;
    session.setSchedulingPaused(!coordinator.canStepManually);
    element.dataset.labVisibility = coordinator.pauseReason ?? "visible";
  };
  const visibility = () => {
    coordinator.setDocumentVisibility(document.visibilityState !== "hidden");
    update();
  };
  const hide = () => {
    coordinator.setPageHide(true);
    update();
  };
  const show = () => {
    coordinator.setPageHide(false);
    visibility();
  };
  const observer = hasObserver
    ? new view.IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === observationRegion) coordinator.setIntersection(entry.isIntersecting);
        }
        update();
      })
    : null;
  document.addEventListener("visibilitychange", visibility);
  view.addEventListener("pagehide", hide);
  view.addEventListener("pageshow", show);
  update();
  observer?.observe(observationRegion);
  return () => {
    disposed = true;
    observer?.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    view.removeEventListener("pagehide", hide);
    view.removeEventListener("pageshow", show);
    // Unmount's owner cleanup decides whether to disconnect. Never dispatch queued work here.
  };
}
