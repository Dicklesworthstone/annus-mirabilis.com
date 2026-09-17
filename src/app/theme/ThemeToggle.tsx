"use client";

import { useEffect, useId, useState } from "react";
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys";
import { FOLLOW_SYSTEM_VALUE, THEME_IDS, type ThemeId } from "./tokens";

const THEME_LABELS: Readonly<Record<ThemeId, string>> = {
  annalen: "Annalen",
  "kramgasse-night": "Kramgasse Night",
  slate: "Slate",
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
    setSelected(readStored());
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
          {THEME_LABELS[themeId]}
        </label>
      ))}
      <label>
        <input
          type="radio"
          name={`${id}-theme`}
          checked={selected === FOLLOW_SYSTEM_VALUE}
          onChange={() => choose(FOLLOW_SYSTEM_VALUE)}
        />
        Follow system
      </label>
      <p className="fine" role="status" aria-live="polite">
        {announcement}
      </p>
    </fieldset>
  );
}
