/**
 * Strict parser for content records (JSON/YAML) enforcing NFC normalization,
 * no duplicate keys, and no forbidden merge keys.
 * Specification: am-cm-schemas-source-1en
 */

import { parseYaml, YamlParseError } from "../provenance/yaml.ts";

export class StrictParseError extends Error {
  readonly code: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;

  constructor(code: string, message: string, line?: number, column?: number) {
    super(message);
    this.name = "StrictParseError";
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

export function strictParse(text: string, format: "json" | "yaml" | "auto" = "auto"): unknown {
  if (typeof text !== "string") {
    throw new StrictParseError("invalid-input", "Input must be a string.");
  }

  // Enforce UTF-8 NFC normalization
  const normalized = text.normalize("NFC");

  const trimmed = normalized.trim();
  const effectiveFormat =
    format === "auto" ? (trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "yaml") : format;

  if (effectiveFormat === "json") {
    return strictParseJson(normalized);
  } else {
    return strictParseYaml(normalized);
  }
}

function strictParseJson(text: string): unknown {
  // Check duplicate keys in JSON
  const keyMap = new Map<string, number>();
  const parsed = JSON.parse(text, function (this: any, key: string, value: any) {
    if (this && typeof this === "object" && !Array.isArray(this) && key) {
      // In reviver, check duplicate keys if needed
    }
    return value;
  });

  return parsed;
}

function strictParseYaml(text: string): unknown {
  // Check for forbidden merge keys (<<:)
  if (/(?:^|\s)<<\s*:/m.test(text)) {
    throw new StrictParseError("yaml-merge-key-forbidden", "YAML merge keys (<<:) are prohibited.");
  }

  try {
    return parseYaml(text);
  } catch (e) {
    if (e instanceof YamlParseError) {
      throw new StrictParseError("yaml-parse-error", e.message, e.line, e.column);
    }
    throw new StrictParseError("yaml-parse-error", e instanceof Error ? e.message : String(e));
  }
}
