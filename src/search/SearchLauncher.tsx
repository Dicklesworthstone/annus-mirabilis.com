"use client";

import { useEffect, useRef } from "react";
import { mountSearchLauncher } from "./launcher.ts";
import "./search.css";

/** Progressive enhancement: the unhydrated link always reaches the papers and outlines. */
export function SearchLauncher() {
  const link = useRef<HTMLAnchorElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (link.current && status.current) return mountSearchLauncher(link.current, status.current);
  }, []);
  return (
    <>
      <a ref={link} href="/papers/" className="search-launcher" aria-haspopup="dialog">
        Search <span aria-hidden="true">(⌘ / Ctrl K)</span>
      </a>
      <span ref={status} className="search-launch-status fine" role="status" />
    </>
  );
}
