"use client";

import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { parseReadingOnly } from "../../a11y/readingSettings/schema.ts";
import type { DeskExperimentId } from "./model.ts";

const Allocation = lazy(() =>
  import("../../components/lab/HistoricalModeAllocationLab.tsx").then((m) => ({
    default: m.HistoricalModeAllocationLab,
  })),
);
const Displacements = lazy(() =>
  import("../../reader/entrances/SignedDisplacementExercise.tsx").then((m) => ({
    default: m.SignedDisplacementExercise,
  })),
);
const Galilean = lazy(() =>
  import("../../components/lab/sr04/HistoricalGalileanLab.tsx").then((m) => ({
    default: m.HistoricalGalileanLab,
  })),
);
const Optics = lazy(() =>
  import("../../components/lab/shelf/HistoricalShelfLab.tsx").then((m) => ({
    default: m.HistoricalShelfLab,
  })),
);

class ExperimentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        The interactive experiment could not load. The worked example below remains available.
        Reload this page to try again, or use the experiment's separate page when one is linked.
      </p>
    ) : (
      this.props.children
    );
  }
}

function LiveExperiment({ id }: { id: DeskExperimentId }) {
  switch (id) {
    case "lq-02":
      return <Allocation restoreSettings={false} />;
    case "signed-displacement":
      return <Displacements />;
    case "sr-04":
      return <Galilean restoreSettingsFromUrl={false} />;
    default:
      return <Optics instrumentId={id} />;
  }
}

/** Explicit opening is also the reading-only escape hatch; no physics bundle mounts on page load. */
export function HistoricalExperiment({
  id,
  title,
  standalonePath,
  children,
}: {
  id: DeskExperimentId;
  title: string;
  standalonePath?: string | undefined;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [readingOnly, setReadingOnly] = useState(false);
  useEffect(() => {
    setReady(true);
    const root = document.documentElement;
    const sync = () => setReadingOnly(parseReadingOnly(root.dataset.readingOnly));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-reading-only"] });
    return () => observer.disconnect();
  }, []);
  return (
    <section
      className="desk-experiment"
      aria-label={title}
      data-desk-experiment={id}
      data-loading-policy="explicit"
      data-reading-only-instrument={readingOnly ? "on" : "off"}
    >
      <h3>{title}</h3>
      <div className="desk-experiment-actions" hidden={!ready}>
        {readingOnly && !open ? (
          <p className="fine">
            Reading-only is on. The worked example stays available; you can choose to load this
            experiment.
          </p>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`desk-live-${id}`}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close experiment" : "Open experiment"}
        </button>
        {standalonePath ? <a href={standalonePath}>Open on its own page</a> : null}
      </div>
      <div className="desk-live" id={`desk-live-${id}`}>
        {open ? (
          <ExperimentBoundary>
            <Suspense
              fallback={
                <p role="status">Loading the experiment. The worked example remains readable.</p>
              }
            >
              <LiveExperiment id={id} />
            </Suspense>
          </ExperimentBoundary>
        ) : null}
      </div>
      <details className="desk-worked-case" open>
        <summary>Static worked example</summary>
        {children}
      </details>
      <noscript>
        <p className="fine">
          The worked example and sources are complete without JavaScript. Changing its settings
          requires JavaScript.
        </p>
      </noscript>
    </section>
  );
}
