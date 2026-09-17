/**
 * The one namespace registry for browser storage (AGENTS.md privacy: no accounts, no cookies;
 * "local reading progress, tours, notes, and predictions stay in localStorage, exportable and
 * clearable"). Every key or key prefix this site writes has exactly one owner here, so a
 * pre-paint script can never spell a key differently from the module that reads it later, and
 * two features can never collide on one namespace.
 */

export type StorageKind = "setting" | "document";

interface BaseRegistration {
  readonly key: string;
  readonly ownerBeadId: string;
  readonly exportable: boolean;
  readonly clearable: boolean;
  readonly maxBytes: number;
  readonly schemaVersion: number;
  readonly label: string;
}

/** One short string under `am:settings:v1:`, read before first paint when `prePaint` is true. */
export interface SettingRegistration extends BaseRegistration {
  readonly kind: "setting";
  readonly prePaint: boolean;
  readonly allowedValues: readonly string[];
  readonly defaultValue: string;
}

/** One JSON document with its own `schemaVersion`, migrated forward on read. */
export interface DocumentRegistration extends BaseRegistration {
  readonly kind: "document";
}

export type KeyRegistration = SettingRegistration | DocumentRegistration;

export const SETTINGS_KEY_PREFIX = "am:settings:v1:";

export class DuplicateKeyRegistrationError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`Storage key "${key}" is registered more than once.`);
    this.name = "DuplicateKeyRegistrationError";
    this.key = key;
  }
}

export class InvalidKeyRegistrationError extends Error {
  readonly key: string;
  constructor(key: string, reason: string) {
    super(`Storage key "${key}" is invalid: ${reason}`);
    this.name = "InvalidKeyRegistrationError";
    this.key = key;
  }
}

function validateEntry(entry: KeyRegistration): void {
  if (!entry.key.trim())
    throw new InvalidKeyRegistrationError(entry.key, "the key must be non-empty.");
  if (entry.kind === "setting") {
    if (!entry.key.startsWith(SETTINGS_KEY_PREFIX)) {
      throw new InvalidKeyRegistrationError(
        entry.key,
        `every setting key must use the "${SETTINGS_KEY_PREFIX}" prefix.`,
      );
    }
    if (entry.allowedValues.length === 0)
      throw new InvalidKeyRegistrationError(
        entry.key,
        "a setting must declare at least one allowed value.",
      );
    if (!entry.allowedValues.includes(entry.defaultValue)) {
      throw new InvalidKeyRegistrationError(
        entry.key,
        `the default value "${entry.defaultValue}" is not among its allowed values.`,
      );
    }
  }
  if (entry.maxBytes <= 0 || !Number.isFinite(entry.maxBytes)) {
    throw new InvalidKeyRegistrationError(entry.key, "maxBytes must be a positive finite number.");
  }
  if (!Number.isInteger(entry.schemaVersion) || entry.schemaVersion < 1) {
    throw new InvalidKeyRegistrationError(entry.key, "schemaVersion must be a positive integer.");
  }
  if (!entry.ownerBeadId.trim())
    throw new InvalidKeyRegistrationError(entry.key, "ownerBeadId is required.");
  if (!entry.label.trim()) throw new InvalidKeyRegistrationError(entry.key, "label is required.");
}

export interface KeyRegistry {
  get(key: string): KeyRegistration | undefined;
  has(key: string): boolean;
  all(): readonly KeyRegistration[];
  settings(): readonly SettingRegistration[];
  documents(): readonly DocumentRegistration[];
  /** The exact set the build-time pre-paint injection emits: every setting with `prePaint: true`. */
  prePaintSettings(): readonly SettingRegistration[];
}

/**
 * Builds a registry from a flat entry list, validating every entry and rejecting a duplicate
 * key. Exposed as a factory (rather than only a singleton) so both the real seed list and a
 * fixture list with a planted duplicate can be constructed and tested the same way.
 */
export function createKeyRegistry(entries: readonly KeyRegistration[]): KeyRegistry {
  const byKey = new Map<string, KeyRegistration>();
  for (const entry of entries) {
    validateEntry(entry);
    if (byKey.has(entry.key)) throw new DuplicateKeyRegistrationError(entry.key);
    byKey.set(entry.key, entry);
  }
  const frozen = Object.freeze([...entries]);
  return Object.freeze({
    get: (key: string) => byKey.get(key),
    has: (key: string) => byKey.has(key),
    all: () => frozen,
    settings: () => frozen.filter((e): e is SettingRegistration => e.kind === "setting"),
    documents: () => frozen.filter((e): e is DocumentRegistration => e.kind === "document"),
    prePaintSettings: () =>
      frozen.filter((e): e is SettingRegistration => e.kind === "setting" && e.prePaint),
  });
}

function setting(
  suffix: string,
  ownerBeadId: string,
  prePaint: boolean,
  allowedValues: readonly string[],
  defaultValue: string,
  label: string,
  options: { exportable?: boolean; clearable?: boolean; maxBytes?: number } = {},
): SettingRegistration {
  return {
    key: `${SETTINGS_KEY_PREFIX}${suffix}`,
    kind: "setting",
    ownerBeadId,
    prePaint,
    allowedValues,
    defaultValue,
    label,
    exportable: options.exportable ?? true,
    clearable: options.clearable ?? true,
    maxBytes: options.maxBytes ?? 256,
    schemaVersion: 1,
  };
}

function document_(
  key: string,
  ownerBeadId: string,
  schemaVersion: number,
  label: string,
  options: { exportable?: boolean; clearable?: boolean; maxBytes?: number } = {},
): DocumentRegistration {
  return {
    key,
    kind: "document",
    ownerBeadId,
    schemaVersion,
    label,
    exportable: options.exportable ?? true,
    clearable: options.clearable ?? true,
    maxBytes: options.maxBytes ?? 64_000,
  };
}

/**
 * Seed registrations. `allowedValues`/`defaultValue` for the nine settings whose owning bead has
 * not landed yet (theme, perspective, notation, units, readingOnly, measure, typeScale, contrast,
 * paragraphSpacing) are provisional placeholders sourced from AGENTS.md's own text where it names
 * concrete values (the three themes), and a minimal honest two-value placeholder otherwise.
 * `prePaint` and `ownerBeadId` for every setting, and the full `predictEntry`/`glossReasoningWords`
 * value sets, are load-bearing and taken verbatim from this bead's own table — those are never
 * placeholders.
 *
 * `detail`'s three values (`am-read-detail-axis-sfc`, landed) are load-bearing too, not a
 * placeholder: AGENTS.md's Detail axis has four readings, R0–R3, but R3 ("Historian's margin")
 * annotates R1 rather than replacing it (`html[data-lens="modern"] [data-reading="3"]` in
 * `src/reader/reader.css`) and is gated by the separate `perspective`/lens setting, not by
 * `detail`. `data-detail` itself, set by `src/reader/detail/prepaint.ts`'s `READER_PREPAINT`,
 * only ever takes "0" | "1" | "2".
 */
export const DISCOVERY_NOTE_KEYS = Object.freeze({
  "light-quanta": "am:discovery-notes:v1:light-quanta",
  "brownian-motion": "am:discovery-notes:v1:brownian-motion",
  "special-relativity": "am:discovery-notes:v1:special-relativity",
  "mass-energy": "am:discovery-notes:v1:mass-energy",
});

export const SEED_ENTRIES: readonly KeyRegistration[] = [
  // Pre-paint settings (data attributes on <html> before first paint).
  setting(
    "theme",
    "am-design-themes-typography-288q",
    true,
    ["annalen", "kramgasse-night", "slate"],
    "annalen",
    "Reading theme",
  ),
  setting(
    "detail",
    "am-read-detail-axis-sfc",
    true,
    ["0", "1", "2"],
    "1",
    "Detail (reading depth)",
  ),
  setting(
    "perspective",
    "am-read-perspective-toggle-abd",
    true,
    ["paper", "modern"],
    "paper",
    "Perspective (paper or modern lens)",
  ),
  setting(
    "notation",
    "am-read-perspective-toggle-abd",
    true,
    ["printed", "modern"],
    "printed",
    "Notation (printed or modern symbols)",
  ),
  setting(
    "units",
    "am-read-perspective-toggle-abd",
    true,
    ["historical", "modern"],
    "historical",
    "Units (historical or modern constants)",
  ),
  setting(
    "readingOnly",
    "am-a11y-reading-only-6wwd",
    true,
    ["off", "on"],
    "off",
    "Reading-only mode",
  ),
  setting(
    "measure",
    "am-a11y-reading-only-6wwd",
    true,
    ["default", "narrow"],
    "default",
    "Line measure",
  ),
  setting(
    "typeScale",
    "am-a11y-reading-only-6wwd",
    true,
    ["default", "large"],
    "default",
    "Type scale",
  ),
  setting(
    "contrast",
    "am-a11y-reading-only-6wwd",
    true,
    ["default", "high"],
    "default",
    "Contrast",
  ),
  setting(
    "paragraphSpacing",
    "am-a11y-reading-only-6wwd",
    true,
    ["default", "roomy"],
    "default",
    "Paragraph spacing",
  ),
  // Settings that never join the pre-paint injection: neither changes the first painted frame.
  setting(
    "predictEntry",
    "am-inst-predict-mode-ti7m",
    false,
    ["predict-first", "worked-example-first", "explore-directly"],
    "predict-first",
    "Predict-mode entry preference",
  ),
  setting(
    "glossReasoningWords",
    "am-read-gloss-face-lp2",
    false,
    ["on", "off"],
    "off",
    "Gloss reasoning-words toggle",
  ),

  // Separate documents: discovery drafts never overwrite the general notebook or predictions.
  ...Object.entries(DISCOVERY_NOTE_KEYS).map(([paper, key]) =>
    document_(key, "am-read-notebook-tde", 1, `Discovery notes: ${paper}`, { maxBytes: 128_000 }),
  ),

  // Documents.
  document_("am:quarantine:v1", "am-plat-local-storage-km8f", 1, "Recovered (quarantined) data", {
    exportable: true,
    clearable: true,
    maxBytes: 128_000,
  }),
  document_("am:notebook:v1", "am-read-notebook-tde", 1, "Notebook"),
  document_("am:tours:v1", "am-tours-infra-g518", 1, "Tour progress"),
  document_("am:predictions:v1", "am-inst-predict-mode-ti7m", 1, "Saved predictions"),
  document_(
    "am:journeys:v1",
    "am-disc-journey-framework-umbg",
    1,
    "Discovery journey choices and local progress",
    {
      exportable: true,
      clearable: true,
      maxBytes: 64_000,
    },
  ),
  document_("am:clarity:v1", "am-plat-clarity-signal-nlwr", 1, "Clarity signal record"),
];

export const storageKeyRegistry: KeyRegistry = createKeyRegistry(SEED_ENTRIES);