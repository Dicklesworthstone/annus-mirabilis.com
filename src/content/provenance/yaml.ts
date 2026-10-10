/**
 * Zero-dependency, strict YAML parser for front matter, surveys, and provenance receipts.
 * Supports mappings, lists, nested objects, multiline strings, inline arrays, and type coercion.
 */

export class YamlParseError extends Error {
  readonly line: number;
  readonly column: number;
  /**
   * A stable name for the refusal, so a test can assert WHICH rule fired rather than that something
   * did. Optional because the older throws predate it and their messages are what callers match on;
   * the refusals added for am-hcx5 all carry one.
   */
  readonly code: string | undefined;

  constructor(message: string, line: number, column = 1, code?: string) {
    super(`YAML Parse Error at line ${line}, col ${column}: ${message}`);
    this.name = "YamlParseError";
    this.line = line;
    this.column = column;
    this.code = code;
  }
}

/**
 * A YAML refusal that carries its code as the FIRST argument, which is this repository's
 * convention and the only shape its refusal scanner recognises.
 *
 * `YamlParseError` takes `(message, line, column, code)`, so a code passed to it is invisible to
 * `scanRefusalThrowSites` -- measured: it credits `throw new X("kebab-code", ...)` on one line or
 * several, and credits NOTHING when the code is last. `throwSiteCensus.ts`, in the same directory,
 * reads the whole thrown expression and does see it, so the two scanners disagreed about this file
 * (3 coded against 0) and the bare-throw ratchet uses the stricter one.
 *
 * Rather than reorder a constructor used by six other sites, or widen a gate's scanner to suit one
 * file, the three coded refusals throw this subclass. It changes nothing a caller sees:
 * `instanceof YamlParseError` still holds, and `strictParse` reads `.code`, `.line` and `.column`
 * exactly as before.
 */
export class YamlRefusalError extends YamlParseError {
  constructor(code: string, message: string, line: number, column = 1) {
    super(message, line, column, code);
    this.name = "YamlRefusalError";
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
    const raw = allLines[i];
    if (raw === undefined) continue;
    const match = raw.match(/^(\s*)(.*)$/);
    const indent = match?.[1]?.length ?? 0;
    const content = match?.[2] ?? "";

    // TABS ARE REFUSED, DELIBERATELY AND NOT BY ACCIDENT (am-hcx5). The YAML spec forbids a tab in
    // the indentation, and this reader counted one as a single column of indent, so a tab-indented
    // document parsed as though it were space-indented and nobody was told the file was outside the
    // format. Measured before choosing to refuse: of 2,539 committed YAML files, ZERO use a tab in
    // the indentation, so this rejects nothing that exists and the decision costs no content.
    if (match?.[1]?.includes("\t") && content !== "") {
      throw new YamlRefusalError(
        "yaml-tab-indentation",
        "A tab is used for indentation. YAML forbids this; use spaces.",
        i + 1,
        (match[1].indexOf("\t") ?? 0) + 1,
      );
    }

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
      const line = lines[index];
      if (!line) break;
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

    const currentLine = lines[index];
    if (!currentLine || currentLine.indent < minIndent) {
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

      const line = lines[index];
      if (!line || line.indent < seqIndent) break;
      if (line.indent > seqIndent) {
        throw new YamlParseError(
          `Unexpected indentation in sequence`,
          line.lineNum,
          line.indent + 1,
        );
      }

      if (!line.trimmed.startsWith("- ") && line.trimmed !== "-") {
        break;
      }

      const restOfLine = line.trimmed === "-" ? "" : line.trimmed.slice(2).trim();
      const contentIndent = line.indent + 2;
      index++;

      if (restOfLine === "") {
        skipBlankAndComments();
        const next = lines[index];
        if (next && next.indent >= contentIndent) {
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
            const next = lines[index];
            if (next && next.indent >= contentIndent) {
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
          const nextLine = lines[index];
          if (!nextLine || nextLine.indent < contentIndent) break;
          if (nextLine.trimmed.startsWith("- ") || nextLine.trimmed === "-") break;

          const entry = parseMappingLine(nextLine.trimmed, nextLine.lineNum);
          if (Object.hasOwn(mapObj, entry.key)) {
            throw new YamlParseError(
              `Duplicate key "${entry.key}" in mapping`,
              nextLine.lineNum,
              nextLine.indent + 1,
            );
          }
          index++;

          if (entry.valStr === "" || entry.valStr === "|" || entry.valStr === ">") {
            if (entry.valStr === "|" || entry.valStr === ">") {
              mapObj[entry.key] = parseMultilineScalar(nextLine.indent + 2, entry.valStr);
            } else {
              skipBlankAndComments();
              const next = lines[index];
              if (next && next.indent > nextLine.indent) {
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

      const line = lines[index];
      if (!line || line.indent < mapIndent) break;
      if (line.indent > mapIndent) {
        throw new YamlParseError(
          `Unexpected indentation in mapping`,
          line.lineNum,
          line.indent + 1,
        );
      }

      if (line.trimmed.startsWith("- ") || line.trimmed === "-") break;

      const { key, valStr } = parseMappingLine(line.trimmed, line.lineNum);
      if (Object.hasOwn(result, key)) {
        throw new YamlParseError(
          `Duplicate key "${key}" in mapping`,
          line.lineNum,
          line.indent + 1,
        );
      }
      index++;

      if (valStr === "" || valStr === "|" || valStr === ">") {
        if (valStr === "|" || valStr === ">") {
          result[key] = parseMultilineScalar(line.indent + 2, valStr);
        } else {
          skipBlankAndComments();
          const next = lines[index];
          if (next && next.indent > mapIndent) {
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
      const line = lines[index];
      if (!line) break;
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

    // AN UNTERMINATED QUOTE IS REFUSED RATHER THAN KEPT AS DATA (am-hcx5). `lab: "a` fell past both
    // quoted arms below and was returned as the plain scalar `"a`, so the opening quote became part
    // of the value and no error was raised -- a record's text silently gaining a character is worse
    // than a parse failure, because nothing downstream can tell it from authored content.
    for (const quote of ['"', "'"] as const) {
      if (clean.startsWith(quote) && !(clean.endsWith(quote) && clean.length >= 2)) {
        throw new YamlRefusalError(
          "yaml-unterminated-quote",
          `Unterminated ${quote === '"' ? "double" : "single"}-quoted scalar: ${clean.slice(0, 40)}`,
          lineNum,
          1,
        );
      }
    }

    if (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2) {
      // One pass, so an escaped backslash is never read as the start of another escape: "\\u00df"
      // is a backslash and "u00df", while "\u00df" is ß. A \u escape was left undecoded until
      // 2026-09-24, and ten readings in two receipts reached /sources/ as "da\u00df" and "\u03c6(x)".
      // Any other backslash sequence is kept as written, as it always was.
      return clean
        .slice(1, -1)
        .replace(
          /\\(?:(["\\])|u([0-9a-fA-F]{4}))/g,
          (_, char: string | undefined, hex: string | undefined) =>
            char ?? String.fromCharCode(Number.parseInt(hex ?? "", 16)),
        );
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
      const prev = i > 0 ? str[i - 1] : undefined;
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (
        ch === "#" &&
        !inSingle &&
        !inDouble &&
        (i === 0 || (prev !== undefined && /\s/.test(prev)))
      ) {
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

    for (const ch of inside) {
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

    for (const ch of inside) {
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
  const value = parseBlock(0);

  /*
    THE WHOLE DOCUMENT MUST BE CONSUMED (am-hcx5), and this one check is the whole repair for the
    shape that lost content.

    `parseMapping` BREAKS rather than throws when it meets a sequence entry at its own indent:

        if (line.trimmed.startsWith("- ") || line.trimmed === "-") break;

    which is right for a nested call, because the caller owns what follows. At the TOP level there
    is no caller, so the lines after the break were simply never read, and `parseBlock(0)` returned
    the mapping it had built as though the file were finished. A document that mixes a top-level
    mapping with a top-level sequence entry therefore parsed "successfully" with part of its content
    discarded and no error of any kind.

    How that looked end to end, which is how it was found: appending a top-level sequence item to
    `content/lab-explanations/bm-01.yaml` left `bun scripts/check-lab-explanations.ts` at exit 0 with
    a census identical to the baseline to the digit -- "47 of 89 displayed formulas explained ... 0
    with no entry" -- while python's yaml.safe_load rejected the same bytes. The planted entry
    appeared nowhere in the parsed value.

    Reporting the FIRST unconsumed line rather than counting them, because the line number is what
    sends someone to the place, and a count would be a number without a location.
  */
  skipBlankAndComments();
  if (index < lines.length) {
    const line = lines[index];
    if (line) {
      throw new YamlRefusalError(
        "yaml-unconsumed-content",
        `Unparsed content after the end of the document: "${line.trimmed.slice(0, 60)}". A top-level mapping cannot be followed by a sequence entry or another document body.`,
        line.lineNum,
        line.indent + 1,
      );
    }
  }
  return value;
}
