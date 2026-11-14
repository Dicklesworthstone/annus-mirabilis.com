"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";

const LOADERS = {
  "light-quanta": () => import("./InlinePhotoelectricInvestigation.tsx"),
  "special-relativity": () => import("./InlineClockInvestigation.tsx"),
  "mass-energy": () => import("./InlineMassEnergyInvestigation.tsx"),
};
export type ChapterInvestigationPaper = keyof typeof LOADERS;

/**
 * A native disclosure always contains the standalone lab link. Even a direct laboratory hash
 * only opens the disclosure: loading is an explicit action, including in reading-only mode.
 * Once loaded, the owner stays mounted through closing, reopening and reader history changes.
 */
export function LazyChapterInvestigationLab({
  paper,
  laboratoryAnchor,
  promptId,
  instrumentId,
  label,
}: {
  paper: ChapterInvestigationPaper;
  laboratoryAnchor: string;
  promptId: string;
  instrumentId: string;
  label: string;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [ready, setReady] = useState(false);
  const [requested, setRequested] = useState(0);
  const [Lab, setLab] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(true);
    const target = `#${laboratoryAnchor}`;
    const reveal = () => {
      if (disclosure.current) disclosure.current.open = true;
    };
    const followHash = () => {
      if (window.location.hash === target) reveal();
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link?.getAttribute("href") === target) reveal();
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    window.addEventListener("popstate", followHash);
    document.addEventListener("click", followLink);
    return () => {
      window.removeEventListener("hashchange", followHash);
      window.removeEventListener("popstate", followHash);
      document.removeEventListener("click", followLink);
    };
  }, [laboratoryAnchor]);

  useEffect(() => {
    if (!requested) return;
    let active = true;
    setFailed(false);
    void LOADERS[paper]().then(
      (module) => {
        if (active) setLab(() => module.default);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [paper, requested]);

  return (
    <details
      ref={disclosure}
      id={laboratoryAnchor}
      data-chapter-lab={instrumentId}
      data-inline-lab-mounted={String(Lab !== null)}
    >
      <summary>Open {label} in this reading</summary>
      <p className="fine">
        <a href={`/lab/${instrumentId}/`}>Open {label} on its own page</a>, where the worked example
        is available without JavaScript.
      </p>
      {Lab ? (
        <Lab />
      ) : (
        <>
          <p>
            The experiment loads only when you ask, including in reading-only mode. Your task and
            saved investigation remain available while it is closed.
          </p>
          <button
            type="button"
            data-load-experiment
            disabled={!ready || (requested > 0 && !failed)}
            onClick={() => setRequested((attempt) => attempt + 1)}
          >
            {failed ? "Retry loading this experiment" : "Load this experiment"}
          </button>
          {requested > 0 && (
            <p className="fine" role="status">
              {failed
                ? "The experiment could not load. Your task and saved work are unchanged; retry or use the standalone link."
                : "Loading the experiment."}
            </p>
          )}
        </>
      )}
      <p className="fine">
        <a href={`#${promptId}`}>Return to your prediction and explanation</a>
      </p>
    </details>
  );
}
