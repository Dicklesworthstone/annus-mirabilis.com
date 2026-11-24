"use client";

import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type BrownianCompanionMode, useBrownianLab } from "./BrownianLabContext.tsx";
import { useBrownianSource } from "./BrownianSourceContext.tsx";
import { BrownianSourcePanel } from "./BrownianSourcePanel.tsx";
import { readingPlace } from "./holdPlace.ts";
import { type Place, scrollToKeep } from "./keepPlace.ts";
import { PinnedEquationCard } from "./layout/PinnedEquationCompanion.tsx";
import { usePinnedEquations } from "./layout/PinnedEquationContext.tsx";
import "./brownianLabCompanion.css";

const BrownianLabPanel = lazy(() => import("./BrownianLabPanel.tsx"));
const noSubscription = () => () => {};
const noPin = () => null;

/** Real companion views share state; no URL query, passage replacement, or second laboratory. */
export function BrownianLabCompanion({
  children,
  slot,
}: {
  children: ReactNode;
  slot?: "column" | "sheet" | undefined;
}) {
  const lab = useBrownianLab();
  const source = useBrownianSource();
  const pins = usePinnedEquations();
  const pin = useSyncExternalStore(
    pins?.subscribe ?? noSubscription,
    pins?.getSnapshot ?? noPin,
    pins?.getServerSnapshot ?? noPin,
  );
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const place = useRef<{ at: Place; mode: string } | null>(null);
  useEffect(() => setReady(true), []);
  const showingPin = !!pin?.pinned && pin.visible;
  const mode = showingPin ? "equation" : (lab?.mode ?? "notes");
  useLayoutEffect(() => {
    const previous = place.current;
    place.current = null;
    if (previous?.mode !== mode || !previous.at.passage.isConnected) return;
    const delta = scrollToKeep(previous.at, window.innerHeight);
    if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "instant" });
  }, [mode]);
  function rememberPlace(nextMode: string) {
    place.current = null;
    if (mode === nextMode) return;
    const reader = root.current?.closest("[data-reader-root]");
    if (!reader) return;
    const at = readingPlace([...reader.querySelectorAll("[data-unit]")], window.innerHeight);
    if (at) place.current = { at, mode: nextMode };
  }
  function show(next: BrownianCompanionMode) {
    rememberPlace(next);
    pins?.showPinned(false);
    lab?.showMode(next);
    if (next === "original") source?.reveal();
  }
  return (
    <div
      ref={root}
      data-companion=""
      data-brownian-companion={slot ?? "passage"}
      data-companion-mode={mode}
      data-companion-kind={mode === "notes" ? "explanation" : mode}
    >
      {lab ? (
        <nav className="reader-companion-nav" aria-label={`Companion view (${slot ?? "passage"})`}>
          <button
            type="button"
            className="secondary"
            aria-pressed={mode === "notes"}
            disabled={!ready}
            onClick={() => show("notes")}
          >
            Notes
          </button>
          {source ? (
            <button
              type="button"
              className="secondary"
              aria-pressed={mode === "original"}
              disabled={!ready}
              onClick={() => show("original")}
            >
              Original
            </button>
          ) : null}
          <button
            type="button"
            className="secondary"
            aria-pressed={mode === "laboratory"}
            disabled={!ready}
            onClick={() => show("laboratory")}
          >
            Laboratory
          </button>
          {pin?.pinned ? (
            <button
              type="button"
              className="secondary"
              aria-pressed={showingPin}
              onClick={() => {
                rememberPlace("equation");
                pins?.showPinned(true);
              }}
            >
              Pinned equation
            </button>
          ) : null}
        </nav>
      ) : null}
      <div hidden={mode !== "notes"} data-brownian-companion-notes>
        {children}
      </div>
      {source ? (
        <div hidden={mode !== "original"} data-brownian-companion-original>
          <BrownianSourcePanel active={mode === "original"} slot={slot} />
        </div>
      ) : null}
      {lab ? (
        <div hidden={mode !== "laboratory"} data-brownian-companion-laboratory>
          {lab.laboratory ? (
            <Suspense fallback={<p className="fine">Loading the tracer controls…</p>}>
              <BrownianLabPanel active={mode === "laboratory"} slot={slot} />
            </Suspense>
          ) : lab.loadError ? (
            <div role="alert" className="notice">
              <p>{lab.loadError}</p>
              <button type="button" onClick={() => void lab.ensureLaboratory()}>
                Try loading the tracer controls again
              </button>
              <p>
                <a href="/lab/bm-01/">Open the tracer laboratory</a>
              </p>
            </div>
          ) : lab.loading ? (
            <p role="status" className="fine">
              Loading the tracer controls…
            </p>
          ) : null}
        </div>
      ) : null}
      {pins && showingPin ? <PinnedEquationCard store={pins} slot={slot} /> : null}
    </div>
  );
}
