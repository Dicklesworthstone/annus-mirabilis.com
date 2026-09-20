import { createHash } from "node:crypto";
import { renderToString } from "katex";
import { canonical, quantityBindings } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { navigationTree } from "./navigation.ts";
import { type EquationRecord, parseEquationRecord } from "./record.ts";
import { teachingProfile } from "./teachingProfiles.ts";
import type { CompiledEquation } from "./viewTypes.ts";
export function compileEquation(input: EquationRecord): CompiledEquation {
  const eq = parseEquationRecord(input, input.id),
    nav = navigationTree(eq.tree),
    allowed = new Set(nav.map((n) => n.id));
  const quantities = teachingProfile(eq.paper)!.quantities;
  const plain = expressionLatex(eq.tree, quantities),
    marked = expressionLatex(eq.tree, quantities, true);
  const html = renderToString(marked, {
    displayMode: true,
    output: "html",
    throwOnError: true,
    maxExpand: 1000,
    maxSize: 20,
    strict: (code: string) => (code === "htmlExtension" ? "ignore" : "error"),
    trust: (context) => {
      if (context.command === "\\htmlClass")
        return ["am-role-input", "am-role-result", "am-role-constant"].includes(
          String(context.class),
        );
      if (context.command !== "\\htmlData") return false;
      const attributes = context.attributes as Record<string, string>;
      return (
        Object.keys(attributes).length === 1 &&
        Object.entries(attributes).every(
          ([key, value]) =>
            ["data-term", "data-op"].includes(key) &&
            allowed.has(value) &&
            nav.some(
              (n) => n.id === value && (n.kind === "term" ? "data-term" : "data-op") === key,
            ),
        )
      );
    },
  });
  // KaTeX formats an untrusted HTML command as unsupported text instead of throwing.
  // Do not let a trust-policy mismatch silently publish a non-interactive formula.
  for (const n of nav) {
    const marker = `data-${n.kind === "term" ? "term" : "op"}="${n.id}"`;
    if (!html.includes(marker)) throw new Error(`Equation rendering omitted ${n.id}.`);
  }
  const mathml = renderToString(plain, {
    displayMode: true,
    output: "mathml",
    throwOnError: true,
    strict: "error",
    trust: false,
    maxExpand: 1000,
    maxSize: 20,
  });
  const bindings = quantityBindings(eq.tree);
  return {
    ...eq,
    html,
    mathml,
    plainLatex: plain,
    treeDigest: createHash("sha256").update(canonical(eq)).digest("hex"),
    navigation: nav,
    terms: bindings.map((t) => ({ ...t, quantity: quantities[t.quantityId]! })),
  };
}
