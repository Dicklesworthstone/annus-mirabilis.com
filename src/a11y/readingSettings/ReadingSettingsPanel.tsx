"use client";

/**
 * Reading preferences panel (am-a11y-reading-only-6wwd). Stores the settings
 * the reader chose, never a conclusion about them. Persistence goes through
 * the settings namespace; blocked storage falls back to the session map.
 */

import { useEffect, useState } from "react";
import {
  createStorageContext,
  type StorageContext,
  writeSetting,
} from "../../platform/storage/store.ts";
import {
  CONTRAST_VALUES,
  type ContrastValue,
  MEASURE_VALUES,
  type MeasureValue,
  PARAGRAPH_SPACING_VALUES,
  type ParagraphSpacingValue,
  parseContrast,
  parseMeasure,
  parseParagraphSpacing,
  parseReadingOnly,
  parseTypeScale,
  READING_SETTING_LABELS,
  READING_SETTINGS_DEFAULTS,
  READING_SETTINGS_STORAGE_KEYS,
  readingOnlyStorageValue,
  TYPE_SCALE_VALUES,
  type TypeScaleValue,
} from "./schema.ts";
import "./readingSettings.css";

const KEY = READING_SETTINGS_STORAGE_KEYS;

let panelStorage: StorageContext | undefined;
function storage(): StorageContext {
  panelStorage ??= createStorageContext();
  return panelStorage;
}

function applyToDocument(partial: {
  readingOnly?: boolean;
  measure?: MeasureValue;
  typeScale?: TypeScaleValue;
  contrast?: ContrastValue;
  paragraphSpacing?: ParagraphSpacingValue;
}): void {
  const root = document.documentElement;
  if (partial.readingOnly !== undefined) {
    root.dataset.readingOnly = readingOnlyStorageValue(partial.readingOnly);
  }
  if (partial.measure !== undefined) root.dataset.measure = partial.measure;
  if (partial.typeScale !== undefined) root.dataset.typeScale = partial.typeScale;
  if (partial.contrast !== undefined) root.dataset.contrast = partial.contrast;
  if (partial.paragraphSpacing !== undefined) {
    root.dataset.paragraphSpacing = partial.paragraphSpacing;
  }
}

export function ReadingSettingsPanel() {
  const [readingOnly, setReadingOnly] = useState(READING_SETTINGS_DEFAULTS.readingOnly);
  const [measure, setMeasure] = useState<MeasureValue>(READING_SETTINGS_DEFAULTS.measure);
  const [typeScale, setTypeScale] = useState<TypeScaleValue>(READING_SETTINGS_DEFAULTS.typeScale);
  const [contrast, setContrast] = useState<ContrastValue>(READING_SETTINGS_DEFAULTS.contrast);
  const [spacing, setSpacing] = useState<ParagraphSpacingValue>(
    READING_SETTINGS_DEFAULTS.paragraphSpacing,
  );

  useEffect(() => {
    const root = document.documentElement.dataset;
    try {
      setReadingOnly(parseReadingOnly(root.readingOnly));
    } catch {
      setReadingOnly(false);
    }
    try {
      setMeasure(parseMeasure(root.measure));
    } catch {
      /* keep default */
    }
    try {
      setTypeScale(parseTypeScale(root.typeScale));
    } catch {
      /* keep default */
    }
    try {
      setContrast(parseContrast(root.contrast));
    } catch {
      /* keep default */
    }
    try {
      setSpacing(parseParagraphSpacing(root.paragraphSpacing));
    } catch {
      /* keep default */
    }
  }, []);

  function persist(key: string, value: string): void {
    try {
      writeSetting(storage(), key, value);
    } catch {
      /* Session fallback lives inside writeSetting; a throw is a programming error. */
    }
  }

  return (
    <details className="reading-settings" data-reading-settings>
      <summary>Reading preferences</summary>
      <fieldset>
        <legend>{READING_SETTING_LABELS.readingOnly}</legend>
        <label>
          <input
            type="checkbox"
            checked={readingOnly}
            data-setting="readingOnly"
            onChange={(event) => {
              const next = event.target.checked;
              setReadingOnly(next);
              applyToDocument({ readingOnly: next });
              persist(KEY.readingOnly, readingOnlyStorageValue(next));
            }}
          />{" "}
          {READING_SETTING_LABELS.readingOnly}
        </label>
        <p className="hint">{READING_SETTING_LABELS.readingOnlyHelp}</p>
      </fieldset>
      <fieldset>
        <legend>{READING_SETTING_LABELS.measure}</legend>
        {MEASURE_VALUES.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="measure"
              value={value}
              checked={measure === value}
              data-setting="measure"
              onChange={() => {
                setMeasure(value);
                applyToDocument({ measure: value });
                persist(KEY.measure, value);
              }}
            />{" "}
            {value === "narrow"
              ? READING_SETTING_LABELS.measureNarrow
              : value === "wide"
                ? READING_SETTING_LABELS.measureWide
                : READING_SETTING_LABELS.measureDefault}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{READING_SETTING_LABELS.typeScale}</legend>
        {TYPE_SCALE_VALUES.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="typeScale"
              value={value}
              checked={typeScale === value}
              data-setting="typeScale"
              onChange={() => {
                setTypeScale(value);
                applyToDocument({ typeScale: value });
                persist(KEY.typeScale, value);
              }}
            />{" "}
            {value} percent
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{READING_SETTING_LABELS.contrast}</legend>
        {CONTRAST_VALUES.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="contrast"
              value={value}
              checked={contrast === value}
              data-setting="contrast"
              onChange={() => {
                setContrast(value);
                applyToDocument({ contrast: value });
                persist(KEY.contrast, value);
              }}
            />{" "}
            {value === "high"
              ? READING_SETTING_LABELS.contrastHigh
              : READING_SETTING_LABELS.contrastDefault}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{READING_SETTING_LABELS.paragraphSpacing}</legend>
        {PARAGRAPH_SPACING_VALUES.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="paragraphSpacing"
              value={value}
              checked={spacing === value}
              data-setting="paragraphSpacing"
              onChange={() => {
                setSpacing(value);
                applyToDocument({ paragraphSpacing: value });
                persist(KEY.paragraphSpacing, value);
              }}
            />{" "}
            {value === "relaxed"
              ? READING_SETTING_LABELS.spacingRelaxed
              : READING_SETTING_LABELS.spacingDefault}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
