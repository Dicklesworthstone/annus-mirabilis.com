"use client";

import { useEffect, useRef, useState } from "react";
import "./menuToggle.css";

/**
 * ON A PHONE THE SIX DESTINATIONS ARE ONE TAP AWAY (chrome, pane %48; TanElk dispatch 101).
 *
 * Below 580px the six links wrapped into two rows under the wordmark, and the header was 164px on
 * every page: 29% of a 320x568 first screen and 19% of 390x844, before a word of content. Every
 * target was already 44px and the rows 2px apart, so there was nothing left to tighten without
 * hiding something. This button hides the links until it is pressed, and the header is one row.
 *
 * It only acts once JavaScript has run. menuToggle.css collapses the nav only under
 * `:root[data-theme]`, which the pre-paint theme script sets, so a reader without JavaScript keeps
 * the six links in view exactly as before, and never sees a button that cannot work.
 *
 * It sits before the nav in the document, so the links it reveals follow it in reading and tab
 * order. Escape pressed on this button or one of the links closes it and returns focus here, so a
 * keyboard never loses its place in a list that has just disappeared. A link loads a new page,
 * where the menu starts closed.
 */
export function MenuToggle() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.menuOpen = "";
    else delete root.dataset.menuOpen;
    return () => {
      delete root.dataset.menuOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Only from inside the menu. The open menu stays in the page's flow, so Tab carries on past
      // it into the page; an Escape pressed there belongs to the page. Answering it from anywhere
      // pulled focus and the scroll back to the header: measured on live /about/ at 390px, a link
      // in the main text at scrollY 601, then Escape, and focus was on this button at scrollY 26.
      const target = event.target instanceof Node ? event.target : null;
      const nav = document.getElementById("site-nav");
      if (!target || !(button.current?.contains(target) || nav?.contains(target))) return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <button
      ref={button}
      type="button"
      className="menu-toggle"
      aria-expanded={open}
      aria-controls="site-nav"
      onClick={() => setOpen((was) => !was)}
    >
      <svg
        className="menu-toggle-icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <path className="menu-toggle-bars" d="M4 7h16M4 12h16M4 17h16" />
        <path className="menu-toggle-close" d="M6 6l12 12M18 6L6 18" />
      </svg>
      <span className="visually-hidden">Menu</span>
    </button>
  );
}
