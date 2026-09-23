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
