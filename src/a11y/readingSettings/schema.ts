/**
 * Reading-only and layout preferences (am-a11y-reading-only-6wwd).
 * Names and copy are about the page, never about the reader. Untested
 * combinations are refused rather than offered.
 */

import { SETTINGS_KEY_PREFIX } from "../../platform/storage/keys.ts";

export const READING_SETTINGS_OWNER = "am-a11y-reading-only-6wwd";

export const READING_SETTINGS_STORAGE_KEYS = Object.freeze({
  readingOnly: `${SETTINGS_KEY_PREFIX}readingOnly`,
  measure: `${SETTINGS_KEY_PREFIX}measure`,
  typeScale: `${SETTINGS_KEY_PREFIX}typeScale`,
  contrast: `${SETTINGS_KEY_PREFIX}contrast`,
  paragraphSpacing: `${SETTINGS_KEY_PREFIX}paragraphSpacing`,
});

export const READING_ONLY_VALUES = ["off", "on"] as const;
export const MEASURE_VALUES = ["narrow", "default", "wide"] as const;
export const TYPE_SCALE_VALUES = ["100", "112", "125", "150"] as const;
export const CONTRAST_VALUES = ["default", "high"] as const;
export const PARAGRAPH_SPACING_VALUES = ["default", "relaxed"] as const;

export type ReadingOnlyValue = (typeof READING_ONLY_VALUES)[number];
export type MeasureValue = (typeof MEASURE_VALUES)[number];
export type TypeScaleValue = (typeof TYPE_SCALE_VALUES)[number];
export type ContrastValue = (typeof CONTRAST_VALUES)[number];
export type ParagraphSpacingValue = (typeof PARAGRAPH_SPACING_VALUES)[number];

export type ReadingSettings = Readonly<{
  readingOnly: boolean;
  measure: MeasureValue;
  typeScale: TypeScaleValue;
  contrast: ContrastValue;
  paragraphSpacing: ParagraphSpacingValue;
}>;

export const READING_SETTINGS_DEFAULTS: ReadingSettings = Object.freeze({
  readingOnly: false,
  measure: "default",
  typeScale: "100",
  contrast: "default",
  paragraphSpacing: "default",
});

/** Neutral labels. No questions about the reader, no learning-style language. */
export const READING_SETTING_LABELS = Object.freeze({
  readingOnly: "Reading-only",
  readingOnlyHelp:
    "Keep every explanation and static worked case. Do not autoplay or load heavy scenes until you ask.",
  measure: "Line length",
  typeScale: "Type size",
  contrast: "Contrast",
  paragraphSpacing: "Paragraph spacing",
  measureNarrow: "Narrow",
  measureDefault: "Default",
  measureWide: "Wide",
  typeScale100: "100 percent",
  typeScale112: "112 percent",
  typeScale125: "125 percent",
  typeScale150: "150 percent",
  contrastDefault: "Default",
  contrastHigh: "High",
  spacingDefault: "Default",
  spacingRelaxed: "Relaxed",
});

export class ReadingSettingsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReadingSettingsError";
    this.code = code;
  }
}

function includes<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function parseReadingOnly(raw: string | boolean | null | undefined): boolean {
  if (raw === true || raw === "on") return true;
  if (raw === false || raw === "off" || raw === null || raw === undefined) return false;
  throw new ReadingSettingsError(
    "invalid-reading-only",
    `readingOnly must be on or off, not "${String(raw)}".`,
  );
}

export function parseMeasure(raw: string | null | undefined): MeasureValue {
  const value = raw ?? READING_SETTINGS_DEFAULTS.measure;
  if (!includes(MEASURE_VALUES, value)) {
    throw new ReadingSettingsError(
      "untested-measure",
      `measure "${value}" is not in the tested set (${MEASURE_VALUES.join(", ")}).`,
    );
  }
  return value;
}

export function parseTypeScale(raw: string | number | null | undefined): TypeScaleValue {
  const value =
    raw === null || raw === undefined ? READING_SETTINGS_DEFAULTS.typeScale : String(raw);
  if (!includes(TYPE_SCALE_VALUES, value)) {
    throw new ReadingSettingsError(
      "untested-type-scale",
      `typeScale "${value}" is not in the tested set (${TYPE_SCALE_VALUES.join(", ")}).`,
    );
  }
  return value;
}

export function parseContrast(raw: string | null | undefined): ContrastValue {
  const value = raw ?? READING_SETTINGS_DEFAULTS.contrast;
  if (!includes(CONTRAST_VALUES, value)) {
    throw new ReadingSettingsError(
      "untested-contrast",
      `contrast "${value}" is not in the tested set (${CONTRAST_VALUES.join(", ")}).`,
    );
  }
  return value;
}

export function parseParagraphSpacing(raw: string | null | undefined): ParagraphSpacingValue {
  const value = raw ?? READING_SETTINGS_DEFAULTS.paragraphSpacing;
  if (!includes(PARAGRAPH_SPACING_VALUES, value)) {
    throw new ReadingSettingsError(
      "untested-paragraph-spacing",
      `paragraphSpacing "${value}" is not in the tested set (${PARAGRAPH_SPACING_VALUES.join(", ")}).`,
    );
  }
  return value;
}

export function parseReadingSettings(
  raw: Partial<{
    readingOnly: string | boolean;
    measure: string;
    typeScale: string | number;
    contrast: string;
    paragraphSpacing: string;
  }>,
): ReadingSettings {
  return Object.freeze({
    readingOnly: parseReadingOnly(raw.readingOnly),
    measure: parseMeasure(raw.measure),
    typeScale: parseTypeScale(raw.typeScale),
    contrast: parseContrast(raw.contrast),
    paragraphSpacing: parseParagraphSpacing(raw.paragraphSpacing),
  });
}

export function readingOnlyStorageValue(on: boolean): ReadingOnlyValue {
  return on ? "on" : "off";
}

export const FORBIDDEN_COPY = Object.freeze([
  "dyslexia",
  "dyslexic",
  "learning style",
  "visual learner",
  "auditory learner",
  "kinesthetic",
  "special reading font",
]);
