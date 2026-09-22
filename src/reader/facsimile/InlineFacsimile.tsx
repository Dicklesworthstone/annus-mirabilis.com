"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { type FacsimileAvailability, facsimileMapPath, readFacsimileResponse } from "./wire.ts";

/*
  THE VIEWER IS FETCHED WITH THE PAGE MAP, NOT WITH THE PAGE. This component sits on every reading
  page so the facsimile face can open without leaving the explanation, but the viewer inside it
  (FacsimilePanel, FacsimileEnhancer and facsimileReader.css) renders only after the reader picks
  that face and the page map has loaded. It was a static import, so the whole viewer shipped in the
  first bundle of every reading page: on BUILD 19 it shared chunk 5877 with ReaderController, on a
  /papers/brownian-motion route 88 brotli bytes over its 204,800 budget. It now loads when the face
  is chosen, in parallel with the page-map fetch that has to happen first anyway, so a reader who
  opens the facsimile waits no longer than before. The standalone facsimile page (FaceFallback)
  still imports the panel directly: there it IS the first paint.
*/
const loadPanel = () => import("./FacsimilePanel.tsx");
const FacsimilePanel = lazy(() => loadPanel().then((m) => ({ default: m.FacsimilePanel })));

/** Reader face changes never replace the explanation/laboratory subtree.
 * Nothing is fetched until this instance's reader explicitly selects the facsimile face.
 */
export function InlineFacsimile({ paperId }: { paperId: string }) {
  const host = useRef<HTMLElement>(null);
  const cached = useRef<FacsimileAvailability | null>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<FacsimileAvailability | null>(null);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState<string | undefined>();

  useEffect(() => {
    const root = host.current?.closest<HTMLElement>("[data-reader-root]");
    if (!root) return;
    const update = () => {
      const segments = window.location.pathname.split("/").filter(Boolean);
      const candidate =
        segments[0] === "papers" && segments[1] === paperId ? segments[2] : undefined;
      setSection(candidate && /^s\d+$/.test(candidate) ? candidate : undefined);
      const active = root.dataset.view === "facsimile";
      root.toggleAttribute("data-facsimile-inline-active", active);
      setVisible(active);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-view"] });
    return () => {
      observer.disconnect();
      root.removeAttribute("data-facsimile-inline-active");
    };
  }, [paperId]);

  // `attempt` IS A DEPENDENCY ON PURPOSE, and its FIXABLE autofix is a defect.
  //
  // a11y aside, biome's useExhaustiveDependencies reports it as "more dependencies than
  // necessary" because the body never READS it. It does not need to: incrementing it is the only
  // thing that re-runs this effect. The retry control at the bottom of this component does
  // `cached.current = null; setAttempt((value) => value + 1)`, and with `attempt` removed from
  // the list that button would clear the cache, bump state, and never refetch. Applying the
  // suggested fix turns "Retry source access" into a control that does nothing, silently.
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is a re-run trigger for the retry control, not an unused read; removing it breaks "Retry source access".
  useEffect(() => {
    if (!visible || cached.current) return;
    void loadPanel();
    const abort = new AbortController();
    let active = true;
    setFailure(false);
    void fetch(facsimileMapPath(paperId), { signal: abort.signal, credentials: "same-origin" })
      .then((response) => readFacsimileResponse(response, paperId))
      .then((availability) => {
        if (!active) return;
        cached.current = availability;
        setResult(availability);
      })
      .catch(() => {
        if (active && !abort.signal.aborted) setFailure(true);
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [paperId, visible, attempt]);

  const explanationHref = section ? `/papers/${paperId}/${section}/` : `/papers/${paperId}/`;
  const faceHref = `${explanationHref}view/facsimile/`;
  return (
    <section
      ref={host}
      hidden={!visible}
      data-inline-facsimile-panel
      className="inline-facsimile-panel"
    >
      {result?.kind === "available" ? (
        <Suspense
          fallback={
            <p role="status">
              Loading the original journal scan. Your reading position and laboratory are unchanged.
            </p>
          }
        >
          <FacsimilePanel
            document={result.document}
            title={`Original source for ${paperId.replaceAll("-", " ")}`}
            section={section}
            faceHref={faceHref}
            explanationHref={explanationHref}
            inline
          />
        </Suspense>
      ) : (
        <div>
          <h2>Original journal scan</h2>
          <p role="status">
            {result?.kind === "unavailable"
              ? result.message
              : failure
                ? "The source-page map could not be loaded. Your reading position and laboratory are unchanged."
                : "Loading the recorded source-page map. Your reading position and laboratory are unchanged."}
          </p>
          {(failure || result?.kind === "unavailable") && (
            <button
              type="button"
              onClick={() => {
                cached.current = null;
                setResult(null);
                setAttempt((value) => value + 1);
              }}
            >
              Retry source access
            </button>
          )}
          <p>
            <a href={faceHref}>Open the standalone facsimile reader</a>
            {" · "}
            <a href={explanationHref} data-view-link="reading">
              Return to the explanation
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
