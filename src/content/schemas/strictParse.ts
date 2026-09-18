/**
 * Strict parser for content records (JSON/YAML) enforcing NFC normalization,
 * no duplicate keys, no custom tags, no anchors/aliases, and no forbidden merge keys.
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

function getLineCol(text: string, index: number): { line: number; column: number } {
  const lines = text.slice(0, index).split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  return { line, column };
}

function checkNfc(text: string, fileLabel?: string): void {
  if (text !== text.normalize("NFC")) {
    const prefix = fileLabel ? `${fileLabel}: ` : "";
    throw new StrictParseError(
      "non-nfc-text",
      `${prefix}Text is not in Unicode Normalization Form C (NFC).`,
    );
  }
}

function checkYamlRestrictedFeatures(text: string, fileLabel?: string): void {
  const prefix = fileLabel ? `${fileLabel}: ` : "";

  const mergeMatch = /(?:^|\s)(<<)\s*:/m.exec(text);
  if (mergeMatch && mergeMatch.index !== undefined) {
    const { line, column } = getLineCol(text, mergeMatch.index);
    throw new StrictParseError(
      "yaml-merge-key-forbidden",
      `${prefix}YAML merge keys (<<:) are prohibited.`,
      line,
      column,
    );
  }

  const customTagMatch = /(?:^|\s)(![!a-zA-Z0-9_/]+)/m.exec(text);
  if (customTagMatch && customTagMatch.index !== undefined) {
    const { line, column } = getLineCol(text, customTagMatch.index);
    throw new StrictParseError(
      "yaml-custom-tag-forbidden",
      `${prefix}Custom YAML tags are prohibited.`,
      line,
      column,
    );
  }

  const anchorMatch = /(?:^|\s)([&*][a-zA-Z0-9_-]+)/m.exec(text);
  if (anchorMatch && anchorMatch.index !== undefined) {
    const { line, column } = getLineCol(text, anchorMatch.index);
    throw new StrictParseError(
      "yaml-anchor-alias-forbidden",
      `${prefix}YAML anchors and aliases are prohibited.`,
      line,
      column,
    );
  }
}

function checkJsonDuplicateKeys(text: string, fileLabel?: string): void {
  let inString = false;
  let isEscaped = false;
  let stringStart = 0;
  const objectStack: (Set<string> | null)[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === "\\") {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
        const strContent = text.slice(stringStart + 1, i);
        // Look ahead for colon (ignoring whitespace)
        let j = i + 1;
        while (
          j < text.length &&
          (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")
        ) {
          j++;
        }
        if (j < text.length && text[j] === ":") {
          const currentScope = objectStack[objectStack.length - 1];
          if (currentScope instanceof Set) {
            let unescaped: string;
            try {
              unescaped = JSON.parse(`"${strContent}"`);
            } catch {
              unescaped = strContent;
            }
            if (currentScope.has(unescaped)) {
              const { line, column } = getLineCol(text, stringStart);
              const prefix = fileLabel ? `${fileLabel}: ` : "";
              throw new StrictParseError(
                "json-duplicate-key",
                `${prefix}Duplicate key "${unescaped}" in JSON object.`,
                line,
                column,
              );
            }
            currentScope.add(unescaped);
          }
        }
      }
    } else {
      if (ch === '"') {
        inString = true;
        isEscaped = false;
        stringStart = i;
      } else if (ch === "{") {
        objectStack.push(new Set<string>());
      } else if (ch === "}") {
        objectStack.pop();
      } else if (ch === "[") {
        objectStack.push(null);
      } else if (ch === "]") {
        objectStack.pop();
      }
    }
  }
}

export function parseStrictYaml(text: string, fileLabel?: string): unknown {
  if (typeof text !== "string") {
    throw new StrictParseError("invalid-input", "Input must be a string.");
  }
  checkNfc(text, fileLabel);
  checkYamlRestrictedFeatures(text, fileLabel);

  try {
    return parseYaml(text);
  } catch (e) {
    if (e instanceof YamlParseError) {
      const code = e.message.toLowerCase().includes("duplicate key")
        ? "yaml-duplicate-key"
        : "yaml-parse-error";
      const prefix = fileLabel ? `${fileLabel}: ` : "";
      throw new StrictParseError(code, `${prefix}${e.message}`, e.line, e.column);
    }
    const prefix = fileLabel ? `${fileLabel}: ` : "";
    throw new StrictParseError(
      "yaml-parse-error",
      `${prefix}${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function parseStrictJson(text: string, fileLabel?: string): unknown {
  if (typeof text !== "string") {
    throw new StrictParseError("invalid-input", "Input must be a string.");
  }
  checkNfc(text, fileLabel);
  checkJsonDuplicateKeys(text, fileLabel);

  try {
    return JSON.parse(text);
  } catch (e) {
    const prefix = fileLabel ? `${fileLabel}: ` : "";
    throw new StrictParseError(
      "json-parse-error",
      `${prefix}${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function strictParse(
  text: string,
  format: "json" | "yaml" | "auto" = "auto",
  fileLabel?: string,
): unknown {
  if (typeof text !== "string") {
    throw new StrictParseError("invalid-input", "Input must be a string.");
  }

  const trimmed = text.trim();
  const effectiveFormat =
    format === "auto"
      ? trimmed.startsWith("{") || trimmed.startsWith("[")
        ? "json"
        : "yaml"
      : format;

  if (effectiveFormat === "json") {
    return parseStrictJson(text, fileLabel);
  }
  return parseStrictYaml(text, fileLabel);
}
