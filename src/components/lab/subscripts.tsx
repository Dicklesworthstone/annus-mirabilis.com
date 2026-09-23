import type { ReactNode } from "react";

/**
 * A label or prompt that names a subscripted quantity, typeset in HTML: "3k_{B}T" reads as k with a
 * lowered B, then T. Only the braced form is taken. The bare form a programmer writes, k_BT, cannot
 * say where the subscript ends (k_{BT}, or k_{B} times T?), so strings that want a subscript spell
 * it with braces, and a string with no braces is returned unchanged.
 */
export function withSubscripts(text: string): ReactNode {
  const pattern = /_\{([^{}]+)\}/gu;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    parts.push(text.slice(last, at));
    parts.push(<sub key={at}>{match[1]}</sub>);
    last = at + match[0].length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/**
 * Like withSubscripts, and also raises a braced superscript: "V^{N_{p}}" reads as V with a raised N
 * carrying a lowered p. Braces nest, so a script may hold another; a brace that never closes leaves
 * the rest of the string as written rather than guessing where the script ends.
 */
export function withScripts(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let plain = "";
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const mark = text[i];
    if ((mark === "_" || mark === "^") && text[i + 1] === "{") {
      let depth = 0;
      let end = -1;
      for (let j = i + 1; j < text.length; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}" && --depth === 0) {
          end = j;
          break;
        }
      }
      if (end > 0) {
        if (plain) parts.push(plain);
        plain = "";
        const inner = withScripts(text.slice(i + 2, end));
        parts.push(mark === "_" ? <sub key={key++}>{inner}</sub> : <sup key={key++}>{inner}</sup>);
        i = end + 1;
        continue;
      }
    }
    plain += mark;
    i++;
  }
  if (parts.length === 0) return text;
  if (plain) parts.push(plain);
  return <>{parts}</>;
}
