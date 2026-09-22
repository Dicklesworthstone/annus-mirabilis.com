"use client";

import { useEffect, useState } from "react";
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys";
import { FOLLOW_SYSTEM_VALUE, THEME_IDS, type ThemeId } from "./tokens";

const THEME_LABELS: Readonly<Record<ThemeId, string>> = {
  annalen: "Annalen",
  "kramgasse-night": "Kramgasse Night",
};

const registration = storageKeyRegistry.get(`${SETTINGS_KEY_PREFIX}theme`);
if (!registration) {
  throw new Error(`Storage registry has no entry for "${SETTINGS_KEY_PREFIX}theme".`);
}
const THEME_KEY = registration.key;

type StoredValue = ThemeId | typeof FOLLOW_SYSTEM_VALUE;

const DARK: ThemeId = "kramgasse-night";
const LIGHT: ThemeId = "annalen";

function readStored(): StoredValue | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === FOLLOW_SYSTEM_VALUE) return value;
    return (THEME_IDS as readonly string[]).includes(value ?? "") ? (value as ThemeId) : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolves a stored value, or the absence of one, to the theme actually on the page. */
function resolve(value: StoredValue | null): ThemeId {
  if (value === LIGHT || value === DARK) return value;
  return systemPrefersDark() ? DARK : LIGHT;
}

function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* The choice still applies to this page; it just will not persist. */
  }
}

/**
 * ONE CONTROL, NOT THREE.
 *
 * The owner's ruling, 2026-09-22, verbatim: "We don't need 4 themes, we need a single dark/light
 * toggle and for the UI/UX to not be HORRIBLE." What stood here was a three-radio fieldset
 * (Light / Dark / System) that read as a form in the middle of the site chrome and was, measured
 * at 390x844, the largest single block in a header the reader meets before any content.
 *
 * SYSTEM PREFERENCE IS THE DEFAULT, NOT A THIRD CHOICE. With nothing stored the switch reflects
 * `prefers-color-scheme`, and the pre-paint script has already applied it, so what the control
 * shows is what the page is. The first press writes an explicit theme id and the reader's choice
 * wins from then on. A reader who stored "follow-system" under the old control still has it
 * honoured on read; nothing writes that value any more.
 *
 * WHY A SWITCH AND NOT A BUTTON THAT RENAMES ITSELF. A control labelled "Switch to dark" changes
 * its own label when pressed, so a screen-reader user who re-reads it hears the opposite of what
 * they just chose and cannot tell the current state from the name. `role="switch"` keeps the name
 * fixed and puts the state in `aria-checked`, where assistive technology already knows to look.
 *
 * THE STATE IS NOT CARRIED BY HUE. The knob moves across the track, which is a position cue that
 * survives a monochrome display, forced colours, and a reader who cannot distinguish the accent
 * from the rule. AGENTS.md requires that colour never carries meaning alone; contrast.test.ts
 * asserts the structural cue is present in the stylesheet.
 */
export function ThemeToggle() {
  // `null` until the effect runs: the server and the first client paint agree on the same markup,
  // and the pre-paint script owns what the page actually looks like before this mounts.
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === LIGHT || current === DARK) {
      setTheme(current);
      return;
    }
    setTheme(resolve(readStored()));
  }, []);

  const isDark = theme === DARK;

  function toggle() {
    const next: ThemeId = isDark ? LIGHT : DARK;
    applyTheme(next);
    setTheme(next);
    setAnnouncement(`Theme changed to ${THEME_LABELS[next]}.`);
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        className="theme-switch"
        onClick={toggle}
      >
        <span className="theme-switch-track" aria-hidden="true">
          <span className="theme-switch-knob" />
        </span>
        <span className="theme-switch-label">
          Dark
          {/* Keeps the edition's own name for the theme in the accessible name. WCAG 2.5.3 wants
              the accessible name to CONTAIN the visible label, so the visible word comes first. */}
          <span className="theme-switch-full-name"> theme ({THEME_LABELS[DARK]})</span>
        </span>
      </button>
      {/* Visually hidden: left visible it added a row to the header after the first press, so the
          page moved under the reader in response to their own action. */}
      <p className="theme-switch-announcement" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
