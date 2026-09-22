"use client";

import { useEffect, useRef } from "react";
import { mountSearchLauncher } from "./launcher.ts";
import "./search.css";

/**
 * Progressive enhancement: the unhydrated link reaches the full index at /search/.
 *
 * It pointed at /papers/ until 2026-09-22. A reader without JavaScript who activated a control
 * labelled "Search" arrived at a catalogue of five papers with nothing to search, so the word on
 * the control was a promise the fallback did not keep. /search/ lists every indexed entry on one
 * page, which is what a static site can honestly offer: the browser's own find works on it.
 */
export function SearchLauncher() {
  const link = useRef<HTMLAnchorElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (link.current && status.current) return mountSearchLauncher(link.current, status.current);
  }, []);
  return (
    <>
      <a ref={link} href="/search/" className="search-launcher" aria-haspopup="dialog">
        Search <span aria-hidden="true">(⌘ / Ctrl K)</span>
      </a>
      <span ref={status} className="search-launch-status fine" role="status" />
    </>
  );
}
