/**
 * Interface string management and catalog loaders.
 *
 * Rules:
 * - Message catalogs live under src/i18n/messages/<locale>.json, separate from content records.
 * - Each catalog carries its own reviewState ("draft" | "in-progress" | "corrected" | "reviewed").
 * - uiLocale and contentLanguage are independent values in reader state and never derived from each other.
 *
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

import deMessages from "./messages/de.json" with { type: "json" };
import enMessages from "./messages/en.json" with { type: "json" };

export type CatalogReviewState = "draft" | "in-progress" | "corrected" | "reviewed";

export interface MessageCatalog {
  locale: string;
  reviewState: CatalogReviewState;
  messages: Readonly<Record<string, string>>;
}

const CATALOGS: Readonly<Record<string, MessageCatalog>> = {
  en: enMessages as MessageCatalog,
  de: deMessages as MessageCatalog,
};

/**
 * Retrieves a message catalog for a given UI locale, falling back to English.
 */
export function getMessageCatalog(uiLocale: string): MessageCatalog {
  const norm = uiLocale.toLowerCase().split("-")[0];
  return CATALOGS[norm] ?? CATALOGS.en;
}

/**
 * Looks up a localized message by key for a given UI locale.
 */
export function getMessage(key: string, uiLocale: string, fallback?: string): string {
  const catalog = getMessageCatalog(uiLocale);
  const msg = catalog.messages[key];
  if (msg !== undefined) return msg;

  const enMsg = CATALOGS.en.messages[key];
  if (enMsg !== undefined) return enMsg;

  return fallback ?? key;
}
