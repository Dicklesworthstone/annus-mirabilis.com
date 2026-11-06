"use client";

import { useEffect, useState } from "react";
import { SEARCH_NAVIGATION_EVENT } from "../../search/searchNavigation.ts";
import {
  applyTimelineVisibility,
  revealTimelineTarget,
  type TimelineVisibility,
} from "./filters.ts";

/** A small enhancement: every entry is already in the HTML, with no persistence or data fetch. */
export function TimelineFilters() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState<TimelineVisibility>({
    post1904: true,
    laterEvidence: true,
  });

  useEffect(() => {
    setReady(true);
    const root = document.getElementById("timeline-content");
    if (!root) return;
    const reveal = (hash: string) => {
      const key = revealTimelineTarget(root, hash);
      if (key) setVisible((current) => ({ ...current, [key]: true }));
    };
    const onHashChange = () => reveal(window.location.hash);
    const revealDestination = (href: string) => {
      let destination: URL;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }
      const current = window.location;
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        reveal(destination.hash);
      }
    };
    const onSearchNavigation = (event: Event) => {
      const href = (event as CustomEvent<{ href?: unknown }>).detail?.href;
      if (typeof href === "string") revealDestination(href);
    };
    const onLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor?.hasAttribute("download") || (anchor?.target && anchor.target !== "_self")) return;
      const href = anchor?.getAttribute("href");
      // Clicking a link to the current fragment emits no hashchange. Reveal before the browser
      // follows it, including full-route links outside the timeline's own subtree.
      if (href) revealDestination(href);
    };
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, onSearchNavigation);
    document.addEventListener("click", onLink);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener(SEARCH_NAVIGATION_EVENT, onSearchNavigation);
      document.removeEventListener("click", onLink);
      applyTimelineVisibility(root, { post1904: true, laterEvidence: true });
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById("timeline-content");
    if (root) applyTimelineVisibility(root, visible);
  }, [visible]);

  return (
    <fieldset className="timeline-filters" hidden={!ready}>
      <legend>Show alongside the papers</legend>
      <label>
        <input
          type="checkbox"
          checked={visible.post1904}
          aria-controls="timeline-post-1904"
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setVisible((current) => ({ ...current, post1904: checked }));
          }}
        />
        Work after 1904 in the long arc
      </label>
      <label>
        <input
          type="checkbox"
          checked={visible.laterEvidence}
          aria-controls="timeline-later-confirmations"
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            setVisible((current) => ({ ...current, laterEvidence: checked }));
          }}
        />
        Later evidence
      </label>
      <p>The paper dates stay visible. Printing includes all three tracks.</p>
    </fieldset>
  );
}
