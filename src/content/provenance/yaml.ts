/**
 * Zero-dependency, strict YAML parser for front matter, surveys, and provenance receipts.
 * Supports mappings, lists, nested objects, multiline strings, inline arrays, and type coercion.
 */

export class YamlParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column = 1) {
    super(`YAML Parse Error at line ${line}, col ${column}: ${message}`);
    this.name = "YamlParseError";
    this.line = line;
    this.column = column;
  }
}

type RawLine = {
  raw: string;
  trimmed: string;
  indent: number;
  lineNum: number;
};

export function parseYaml(text: string): unknown {
  const allLines = text.split(/\r?\n/);
  const lines: RawLine[] = [];

  for (let i = 0; i < allLines.length; i++) {
    const raw = allLines[i]!;
    const match = raw.match(/^(\s*)(.*)$/);
    const indent = match ? match[1]!.length : 0;
    const content = match ? match[2]! : "";

    lines.push({
      raw,
      trimmed: content,
      indent,
      lineNum: i + 1,
    });
  }

  let index = 0;

  function skipBlankAndComments(): void {
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.trimmed === "" || line.trimmed.startsWith("#")) {
        index++;
      } else {
        break;
      }
    }
  }

  function parseBlock(minIndent: number): unknown {
    skipBlankAndComments();
    if (index >= lines.length) return null;

    const currentLine = lines[index]!;
    if (currentLine.indent < minIndent) {
      return null;
    }

    if (currentLine.trimmed.startsWith("- ") || currentLine.trimmed === "-") {
      return parseSequence(currentLine.indent);
    } else {
      return parseMapping(currentLine.indent);
    }
  }

  function parseSequence(seqIndent: number): unknown[] {
    const result: unknown[] = [];

    while (index < lines.length) {
      skipBlankAndComments();
      if (index >= lines.length) break;

      const line = lines[index]!;
      if (line.indent < seqIndent) break;
      if (line.indent > seqIndent) {
        throw new YamlParseError(`Unexpected indentation in sequence`, line.lineNum, line.indent + 1);
      }

      if (!line.trimmed.startsWith("- ") && line.trimmed !== "-") {
        break;
      }

      const restOfLine = line.trimmed === "-" ? "" : line.trimmed.slice(2).trim();
      const contentIndent = line.indent + 2;
      index++;

      if (restOfLine === "") {
        skipBlankAndComments();
        if (index < lines.length && lines[index]!.indent >= contentIndent) {
          const itemVal = parseBlock(contentIndent);
          result.push(itemVal);
        } else {
          result.push(null);
        }
      } else if (isMappingStart(restOfLine)) {
        const firstEntry = parseMappingLine(restOfLine, line.lineNum);
        const mapObj: Record<string, unknown> = {};

        if (firstEntry.valStr === "" || firstEntry.valStr === "|" || firstEntry.valStr === ">") {
          if (firstEntry.valStr === "|" || firstEntry.valStr === ">") {
            mapObj[firstEntry.key] = parseMultilineScalar(contentIndent, firstEntry.valStr);
          } else {
            skipBlankAndComments();
            if (index < lines.length && lines[index]!.indent >= contentIndent) {
              mapObj[firstEntry.key] = parseBlock(contentIndent);
            } else {
              mapObj[firstEntry.key] = null;
            }
          }
        } else {
          mapObj[firstEntry.key] = parseScalar(firstEntry.valStr, line.lineNum);
        }

        while (index < lines.length) {
          skipBlankAndComments();
          if (index >= lines.length) break;
          const nextLine = lines[index]!;
          if (nextLine.indent < contentIndent) break;
          if (nextLine.trimmed.startsWith("- ") || nextLine.trimmed === "-") break;

          const entry = parseMappingLine(nextLine.trimmed, nextLine.lineNum);
          index++;

          if (entry.valStr === "" || entry.valStr === "|" || entry.valStr === ">") {
            if (entry.valStr === "|" || entry.valStr === ">") {
              mapObj[entry.key] = parseMultilineScalar(nextLine.indent + 2, entry.valStr);
            } else {
              skipBlankAndComments();
              if (index < lines.length && lines[index]!.indent > nextLine.indent) {
                mapObj[entry.key] = parseBlock(nextLine.indent + 1);
              } else {
                mapObj[entry.key] = null;
              }
            }
          } else {
            mapObj[entry.key] = parseScalar(entry.valStr, nextLine.lineNum);
          }
        }

        result.push(mapObj);
      } else if (restOfLine === "|" || restOfLine === ">") {
        result.push(parseMultilineScalar(contentIndent, restOfLine));
      } else {
        result.push(parseScalar(restOfLine, line.lineNum));
      }
    }

    return result;
  }

  function isMappingStart(str: string): boolean {
    const colonIdx = findUnquotedColon(str);
    return colonIdx !== -1;
  }

  function findUnquotedColon(str: string): number {
    let inSingle = false;
    let inDouble = false;
    let inBracket = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "[" && !inSingle && !inDouble) inBracket++;
      else if (ch === "]" && !inSingle && !inDouble) inBracket--;
      else if (ch === ":" && !inSingle && !inDouble && inBracket === 0) {
        if (i === str.length - 1 || str[i + 1] === " " || str[i + 1] === "\t") {
          return i;
        }
      }
    }
    return -1;
  }

  function parseMappingLine(str: string, lineNum: number): { key: string; valStr: string } {
    const colonIdx = findUnquotedColon(str);
    if (colonIdx === -1) {
      throw new YamlParseError(`Expected key: value mapping but got "${str}"`, lineNum);
    }
    const rawKey = str.slice(0, colonIdx).trim();
    const rawVal = str.slice(colonIdx + 1).trim();
    const key = unquoteKey(rawKey, lineNum);
    return { key, valStr: rawVal };
  }

  function unquoteKey(key: string, lineNum: number): string {
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      return key.slice(1, -1);
    }
    if (/[\s:]/.test(key)) {
      throw new YamlParseError(`Invalid unquoted key "${key}"`, lineNum);
    }
    return key;
  }

  function parseMapping(mapIndent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    while (index < lines.length) {
      skipBlankAndComments();
      if (index >= lines.length) break;

      const line = lines[index]!;
      if (line.indent < mapIndent) break;
      if (line.indent > mapIndent) {
        throw new YamlParseError(`Unexpected indentation in mapping`, line.lineNum, line.indent + 1);
      }

      if (line.trimmed.startsWith("- ") || line.trimmed === "-") break;

      const { key, valStr } = parseMappingLine(line.trimmed, line.lineNum);
      index++;

      if (valStr === "" || valStr === "|" || valStr === ">") {
        if (valStr === "|" || valStr === ">") {
          result[key] = parseMultilineScalar(line.indent + 2, valStr);
        } else {
          skipBlankAndComments();
          if (index < lines.length && lines[index]!.indent > mapIndent) {
            result[key] = parseBlock(mapIndent + 1);
          } else {
            result[key] = null;
          }
        }
      } else {
        result[key] = parseScalar(valStr, line.lineNum);
      }
    }

    return result;
  }

  function parseMultilineScalar(minIndent: number, mode: string): string {
    const chunkLines: string[] = [];
    let detectedIndent: number | null = null;

    while (index < lines.length) {
      const line = lines[index]!;
      if (line.trimmed === "") {
        chunkLines.push("");
        index++;
        continue;
      }

      if (detectedIndent === null) {
        if (line.indent < minIndent) break;
        detectedIndent = line.indent;
      } else {
        if (line.indent < detectedIndent) break;
      }

      chunkLines.push(line.raw.slice(detectedIndent));
      index++;
    }

    while (chunkLines.length > 0 && chunkLines[chunkLines.length - 1] === "") {
      chunkLines.pop();
    }

    if (mode === ">") {
      return chunkLines.join(" ").replace(/\s+/g, " ").trim();
    }
    return chunkLines.join("\n");
  }

  function parseScalar(valStr: string, lineNum: number): unknown {
    const clean = stripTrailingComment(valStr).trim();

    if (clean === "null" || clean === "~" || clean === "") return null;
    if (clean === "true" || clean === "True" || clean === "TRUE") return true;
    if (clean === "false" || clean === "False" || clean === "FALSE") return false;

    if (clean.startsWith("[") && clean.endsWith("]")) {
      return parseInlineArray(clean, lineNum);
    }

    if (clean.startsWith("{") && clean.endsWith("}")) {
      return parseInlineObject(clean, lineNum);
    }

    if (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2) {
      return clean.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    if (clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2) {
      return clean.slice(1, -1).replace(/''/g, "'");
    }

    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(clean)) {
      const num = Number(clean);
      if (!Number.isNaN(num)) return num;
    }

    return clean;
  }

  function stripTrailingComment(str: string): string {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(str[i - 1]!))) {
        return str.slice(0, i);
      }
    }
    return str;
  }

  function parseInlineArray(str: string, lineNum: number): unknown[] {
    const inside = str.slice(1, -1).trim();
    if (!inside) return [];

    const items: string[] = [];
    let cur = "";
    let inSingle = false;
    let inDouble = false;
    let inBracket = 0;

    for (let i = 0; i < inside.length; i++) {
      const ch = inside[i]!;
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "[" && !inSingle && !inDouble) inBracket++;
      else if (ch === "]" && !inSingle && !inDouble) inBracket--;
      else if (ch === "," && !inSingle && !inDouble && inBracket === 0) {
        items.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());

    return items.map((item) => parseScalar(item, lineNum));
  }

  function parseInlineObject(str: string, lineNum: number): Record<string, unknown> {
    const inside = str.slice(1, -1).trim();
    if (!inside) return {};

    const items: string[] = [];
    let cur = "";
    let inSingle = false;
    let inDouble = false;
    let inBrace = 0;

    for (let i = 0; i < inside.length; i++) {
      const ch = inside[i]!;
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "{" && !inSingle && !inDouble) inBrace++;
      else if (ch === "}" && !inSingle && !inDouble) inBrace--;
      else if (ch === "," && !inSingle && !inDouble && inBrace === 0) {
        items.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());

    const result: Record<string, unknown> = {};
    for (const item of items) {
      const { key, valStr } = parseMappingLine(item, lineNum);
      result[key] = parseScalar(valStr, lineNum);
    }
    return result;
  }

  skipBlankAndComments();
  if (index >= lines.length) return {};
  return parseBlock(0);
}
