"use client";

import { useRef, useState } from "react";
import "./search.css";

/**
 * THE SEARCH PAGE'S OWN FIELD. /search/ was a page titled "Search" with no search box on it: its
 * first sentence told the reader to press Ctrl K, which a phone does not have. This opens the same
 * palette the header link and Ctrl K open, over the same index, from a control shaped like the
 * thing it is.
 *
 * It is in the server HTML and hidden by CSS only when JavaScript is off (search.css keys on the
 * data-theme the pre-paint script sets, as the theme toggle does). It used to render `hidden` and
 * appear on hydration, which pushed the whole index 78px down after the first paint. Without
 * JavaScript there is nothing it could do, and the index listed below it is that reader's search.
 */
export function SearchPageField() {
  const [failed, setFailed] = useState(false);
  const opening = useRef(false);

  async function open() {
    if (opening.current || document.querySelector("dialog[open]")) return;
    opening.current = true;
    try {
      const { openCommandPalette } = await import("./CommandPalette.ts");
      openCommandPalette({
        onClose: () => {
          opening.current = false;
        },
      });
      setFailed(false);
    } catch {
      opening.current = false;
      setFailed(true);
    }
  }

  return (
    <div className="search-page-field-wrap">
      <button
        type="button"
        className="search-page-field"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => void open()}
      >
        <svg
          className="search-page-field-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M15.4 15.4L20.5 20.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {/* The palette's own title, so the control and the dialog it opens say the same thing. */}
        <span className="search-page-field-text">Search the edition</span>
        <span className="search-page-field-keys" aria-hidden="true">
          ⌘ / Ctrl K
        </span>
      </button>
      <p className="search-launch-status fine" role="status">
        {failed ? "Search could not open. Every entry is listed below." : ""}
      </p>
    </div>
  );
}
