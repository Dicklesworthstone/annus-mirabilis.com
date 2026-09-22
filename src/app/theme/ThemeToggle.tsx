"use client";

import { useEffect, useId, useState } from "react";
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys";
import { FOLLOW_SYSTEM_VALUE, THEME_IDS, type ThemeId } from "./tokens";

const THEME_LABELS: Readonly<Record<ThemeId, string>> = {
  annalen: "Annalen",
  "kramgasse-night": "Kramgasse Night",
};

/**
 * What a sighted reader sees on the chip. The edition's names for its two
 * themes are longer than the control needs to be: at 390x844 the four-word
 * pair wrapped to two rows and the group cost 105px of a 400px header, which
 * is the owner's complaint stated as a quantity.
 *
 * The full name is not dropped, it moves into the accessible name as a
 * parenthetical, so the chip reads "Light (Annalen)" to a screen reader. WCAG
 * 2.5.3 wants the accessible name to CONTAIN the visible label, which is why
 * the short word comes first and the name is appended rather than substituted.
 */
const THEME_SHORT_LABELS: Readonly<Record<ThemeId, string>> = {
  annalen: "Light",
  "kramgasse-night": "Dark",
};

const registration = storageKeyRegistry.get(`${SETTINGS_KEY_PREFIX}theme`);
if (!registration) {
  throw new Error(`Storage registry has no entry for "${SETTINGS_KEY_PREFIX}theme".`);
}
const THEME_KEY = registration.key;

type StoredValue = ThemeId | typeof FOLLOW_SYSTEM_VALUE;

function readStored(): StoredValue | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === FOLLOW_SYSTEM_VALUE) return value;
    return (THEME_IDS as readonly string[]).includes(value ?? "") ? (value as ThemeId) : null;
  } catch {
    return null;
  }
}

function applyTheme(value: StoredValue): void {
  const resolved =
    value === FOLLOW_SYSTEM_VALUE
      ? typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
        ? "kramgasse-night"
        : "annalen"
      : value;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    /* The choice still applies to this page; it just will not persist. */
  }
}

/**
 * An accessible radio group (am-design-themes-typography-288q): keyboard
 * operable, announced once on change. Renders after the pre-paint script
 * has already set `data-theme`; this component reflects and updates that
 * choice, it never decides the choice on first paint.
 */
export function ThemeToggle() {
  const id = useId();
  const [selected, setSelected] = useState<StoredValue | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const stored = readStored();
    if (stored !== null) {
      setSelected(stored);
    } else {
      const current = document.documentElement.dataset.theme as ThemeId | undefined;
      if (current && (THEME_IDS as readonly string[]).includes(current)) {
        setSelected(current);
      }
    }
  }, []);

  function choose(value: StoredValue) {
    applyTheme(value);
    setSelected(value);
    setAnnouncement(
      value === FOLLOW_SYSTEM_VALUE
        ? "Theme set to follow your system appearance."
        : `Theme changed to ${THEME_LABELS[value]}.`,
    );
  }

  return (
    <fieldset className="theme-toggle">
      <legend>Theme</legend>
      {THEME_IDS.map((themeId) => (
        <label key={themeId}>
          <input
            type="radio"
            name={`${id}-theme`}
            checked={selected === themeId}
            onChange={() => choose(themeId)}
          />
          {THEME_SHORT_LABELS[themeId]}
          <span className="theme-toggle-full-name"> ({THEME_LABELS[themeId]})</span>
        </label>
      ))}
      <label>
        <input
          type="radio"
          name={`${id}-theme`}
          checked={selected === FOLLOW_SYSTEM_VALUE}
          onChange={() => choose(FOLLOW_SYSTEM_VALUE)}
        />
        System
        <span className="theme-toggle-full-name"> (follow your device appearance)</span>
      </label>
      {/* The announcement is for a screen reader, and it is the only child whose
          height depends on a reader having touched the control. Left visible it
          added a row to the header AFTER the first click, so the page moved
          under the reader in response to their own action. */}
      <p className="theme-toggle-announcement" role="status" aria-live="polite">
        {announcement}
      </p>
    </fieldset>
  );
}
