"use client";

import { useEffect } from "react";
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys";
import { FOLLOW_SYSTEM_VALUE, THEME_IDS, type ThemeId } from "./tokens";

const registration = storageKeyRegistry.get(`${SETTINGS_KEY_PREFIX}theme`);
if (!registration) {
  throw new Error(`Storage registry has no entry for "${SETTINGS_KEY_PREFIX}theme".`);
}
const THEME_KEY = registration.key;

const DARK: ThemeId = "kramgasse-night";
const LIGHT: ThemeId = "annalen";

/** How long the page's colours cross-fade when the reader switches; themes.css matches it. */
export const THEME_FADE_MS = 220;

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** True until the reader has pressed the button once: the page follows the device. */
function followsDevice(): boolean {
  const stored = readStored();
  return (
    stored === null || stored === FOLLOW_SYSTEM_VALUE || !THEME_IDS.includes(stored as ThemeId)
  );
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

/** Sets the theme on <html>, fading the page's colours across unless the reader asked for less motion. */
function setTheme(theme: ThemeId, fade: boolean): void {
  const root = document.documentElement;
  if (fade && !prefersReducedMotion()) {
    root.classList.add("theme-fading");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => root.classList.remove("theme-fading"), THEME_FADE_MS + 80);
  }
  root.dataset.theme = theme;
}

/**
 * PAPER TAKES THE LIGHT THEME. The dark theme's ink is #e8e6e1, 1.25:1 on a white sheet. Chromium
 * darkens text that light when it prints without backgrounds, and even so /papers/brownian-motion/
 * s4/ printed from the dark theme put its body text down at grey 147 of 255, 3.07:1, measured from
 * the PDF at 200dpi; with this switch the same page printed at grey 63, 10.53:1. Every dark rule
 * keys on data-theme, so switching it for the print and back afterwards prints any page in the
 * light theme's colours, quantity colours included, without a second copy of a single value.
 * Returns what puts the page back.
 */
export function lightForPrint(root: HTMLElement): () => void {
  if (root.dataset.theme !== DARK) return () => {};
  root.dataset.theme = LIGHT;
  return () => {
    root.dataset.theme = DARK;
  };
}

/**
 * ONE ICON BUTTON: A MOON IN THE LIGHT THEME, A SUN IN THE DARK.
 *
 * The owner, 2026-09-22: "instead of "Light(Annalen) Dark(Kramgasse Night) System" we need to have
 * a single toggle that is either an icon of sun or a moon, don't make this harder than it needs to
 * be!!! make it super slick and nice!!!" The icon names where a press takes the reader, and so does
 * the accessible name: "Switch to dark theme" or "Switch to light theme".
 *
 * NOTHING ON THIS BUTTON WAITS FOR REACT. The icon and the name are both chosen by CSS from
 * `data-theme`, which the pre-paint script sets before the first frame (themeInit.inline.ts). The
 * SVG holds a moon and a sun, and the button holds both names, visually hidden; themes.css shows the
 * one that matches the theme and gives the other `display: none`, which also takes it out of the
 * accessible name. So the reader sees the right icon and a screen reader hears the right action from
 * first paint, before hydration, and after every press, with no state to fall out of step. Without
 * JavaScript the pre-paint script never runs, `data-theme` is absent, and themes.css hides the button
 * rather than show a control that cannot work; the page follows the device through its media query.
 *
 * Until the first press the page follows the device, including a change made while the page is open.
 * The press writes an explicit theme and the reader's choice wins from then on. There is no visible
 * third option: following the device is the default, not a thing to choose.
 */
export function ThemeToggle() {
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (followsDevice()) setTheme(query.matches ? DARK : LIGHT, true);
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  useEffect(() => {
    let restore = () => {};
    const beforePrint = () => {
      restore = lightForPrint(document.documentElement);
    };
    const afterPrint = () => {
      restore();
      restore = () => {};
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);

  function toggle() {
    const next: ThemeId = document.documentElement.dataset.theme === DARK ? LIGHT : DARK;
    setTheme(next, true);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* The choice still applies to this page; it just will not persist. */
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      <svg
        className="theme-toggle-icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <g className="theme-toggle-moon">
          {/* A disc of radius 8.5 about the centre with a disc of radius 7.2, offset up and to the
              right, taken out of it; the two arcs meet where the circles cross. */}
          <path d="M10.14 3.7A8.5 8.5 0 1 0 20.37 13.47A7.2 7.2 0 0 1 10.14 3.7Z" />
        </g>
        <g className="theme-toggle-sun">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
        </g>
      </svg>
      <span className="theme-toggle-name theme-toggle-to-dark">Switch to dark theme</span>
      <span className="theme-toggle-name theme-toggle-to-light">Switch to light theme</span>
    </button>
  );
}
