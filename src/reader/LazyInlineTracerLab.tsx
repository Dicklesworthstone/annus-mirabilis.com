"use client";
/**
 * "Open the tracer ensemble in this reading", mounted on first opening.
 *
 * WHY. The Brownian reading server-rendered the whole bm-01 laboratory inside this closed
 * disclosure. Its prepared example, 144 KB of float64 tracer endpoints, went into the page's
 * flight data as the laboratory's props, and random floats barely compress: on BUILD 21 that one
 * row was 43,337 of the page's 246,825 gzipped bytes. The laboratory's markup and its client code
 * rode along, in the HTML and in the route's first JavaScript. A reader who never opens the
 * disclosure paid for all of it. AGENTS.md names the remedy for a page over budget: what sits
 * behind an expansion loads on first expansion, with a real link for readers without JavaScript.
 *
 * HOW. The disclosure and its summary are in the HTML. Opening it the first time loads the
 * laboratory and its example as one lazy chunk and mounts the same TracerLab that /lab/bm-01/
 * renders. Once mounted it stays mounted: closing the disclosure only hides it, so a trial
 * survives a face change or an opened lesson, as it did before. Until then, and for a reader
 * without JavaScript, the disclosure holds a link to /lab/bm-01/, where the laboratory and its
 * worked example are part of the served page. The static worked case stays in
 * StickyLabRegion either way.
 */
import { lazy, Suspense, type SyntheticEvent, useEffect, useRef, useState } from "react";

const InlineTracerLab = lazy(() => import("./InlineTracerLab.tsx"));

export function LazyInlineTracerLab({
  revealForAnchor,
}: {
  revealForAnchor?: string | undefined;
} = {}) {
  const [opened, setOpened] = useState(false);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!revealForAnchor) return;
    const target = `#${revealForAnchor}`;
    function reveal() {
      if (!disclosure.current) return;
      disclosure.current.open = true;
      setOpened(true);
    }
    function followHash() {
      if (window.location.hash === target) reveal();
    }
    function followLink(event: MouseEvent) {
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
      // A second click on the same hash does not emit hashchange. It should still reopen the lab.
      if (link?.getAttribute("href") === target) reveal();
    }
    followHash();
    window.addEventListener("hashchange", followHash);
    document.addEventListener("click", followLink);
    return () => {
      window.removeEventListener("hashchange", followHash);
      document.removeEventListener("click", followLink);
    };
  }, [revealForAnchor]);
  function mount(event: SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) setOpened(true);
  }
  return (
    <details
      ref={disclosure}
      data-inline-lab="bm-01"
      data-inline-lab-mounted={String(opened)}
      onToggle={mount}
    >
      <summary>Open the tracer ensemble in this reading</summary>
      {opened ? (
        <Suspense fallback={<p className="fine">Loading the tracer ensemble…</p>}>
          <InlineTracerLab />
        </Suspense>
      ) : (
        <p className="fine">
          <a href="/lab/bm-01/">Open the tracer ensemble on its own page</a>, where its worked
          example is part of the page.
        </p>
      )}
    </details>
  );
}
