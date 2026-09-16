/** A bounded JSON-only content loader. Duplicate keys are errors, never last-write-wins. */
export class ContentError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = "ContentError";
    this.code = code;
    this.path = path;
  }
}
export function parseContentJson(text: string, path = "content"): unknown {
  let i = 0;
  const fail = (message: string): never => {
    throw new ContentError(
      "invalid-json",
      `${path}:${text.slice(0, i).split("\n").length}`,
      message,
    );
  };
  if (new TextEncoder().encode(text).length > 512 * 1024)
    throw new ContentError("file-budget", path, "Content exceeds 512 KiB.");
  if (text !== text.normalize("NFC"))
    throw new ContentError(
      "non-nfc",
      path,
      "Content must already use Unicode NFC; no normalization was applied.",
    );
  const space = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? "!") && i < text.length) i++;
  };
  function string(): string {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === '"') {
        try {
          return JSON.parse(text.slice(start, i)) as string;
        } catch {
          fail("Invalid JSON string.");
        }
      }
      if (c === "\\") i++;
    }
    return fail("Unterminated string.");
  }
  function value(depth: number): unknown {
    if (depth > 40) fail("Content nesting exceeds 40 levels.");
    space();
    const c = text[i];
    if (c === '"') return string();
    if (c === "{") {
      i++;
      space();
      const o: Record<string, unknown> = Object.create(null);
      if (text[i] === "}") {
        i++;
        return o;
      }
      for (;;) {
        space();
        if (text[i] !== '"') fail("Expected an object key.");
        const key = string();
        if (Object.hasOwn(o, key)) fail(`Duplicate key: ${key}.`);
        if (["__proto__", "constructor", "prototype"].includes(key)) fail(`Reserved key: ${key}.`);
        space();
        if (text[i++] !== ":") fail("Expected a colon.");
        o[key] = value(depth + 1);
        space();
        if (text[i] === "}") {
          i++;
          return o;
        }
        if (text[i++] !== ",") fail("Expected a comma or closing brace.");
      }
    }
    if (c === "[") {
      i++;
      space();
      const items: unknown[] = [];
      if (text[i] === "]") {
        i++;
        return items;
      }
      for (;;) {
        items.push(value(depth + 1));
        space();
        if (text[i] === "]") {
          i++;
          return items;
        }
        if (text[i++] !== ",") fail("Expected a comma or closing bracket.");
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      text.slice(i),
    )?.[0];
    if (!token) return fail("Expected a JSON value.");
    i += token.length;
    const parsed: unknown = JSON.parse(token);
    if (typeof parsed === "number" && !Number.isFinite(parsed))
      fail("Nonfinite numbers are not content values.");
    return parsed;
  }
  const result = value(0);
  space();
  if (i !== text.length) fail("Unexpected trailing content.");
  return result;
}
