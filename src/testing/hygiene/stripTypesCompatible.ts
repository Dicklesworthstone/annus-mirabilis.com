/**
 * TypeScript the node lane cannot load (am-rc1001-bridge-plan-pcjk.4).
 *
 * `bun run test:node` runs `node --experimental-strip-types`, which deletes type annotations and
 * refuses every construct that needs code generated for it: constructor parameter properties,
 * runtime enums and runtime namespaces. One parameter property at src/content/schemas/inlines.ts:330
 * (288332c9, 2026-09-26) made three node-lane e2e files fail to LOAD for five days, which reads as
 * three failures in a lane already carrying 40 build-dependent ones, so nobody saw it.
 *
 * The check lives in the bun lane on purpose: a guard whose only proof ran in the lane it protects
 * would disappear with the lane (AGENTS.md "A Gate's Own Test Must Not Live Only In The Lane That
 * Gate Controls").
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

export type StripTypesViolation = Readonly<{
  file: string;
  line: number;
  construct: "parameter-property" | "enum" | "namespace";
}>;

const PROPERTY_MODIFIERS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
  ts.SyntaxKind.ReadonlyKeyword,
]);

function isAmbient(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false;
}

/** Every construct in one source text that strip-types refuses. */
export function stripTypesViolations(file: string, text: string): StripTypesViolation[] {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found: StripTypesViolation[] = [];
  const line = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node: ts.Node): void => {
    if (
      ts.isParameter(node) &&
      ts.isConstructorDeclaration(node.parent) &&
      (ts.getModifiers(node) ?? []).some((m) => PROPERTY_MODIFIERS.has(m.kind))
    ) {
      found.push({ file, line: line(node), construct: "parameter-property" });
    } else if (ts.isEnumDeclaration(node) && !isAmbient(node)) {
      found.push({ file, line: line(node), construct: "enum" });
    } else if (
      ts.isModuleDeclaration(node) &&
      !isAmbient(node) &&
      !(node.flags & ts.NodeFlags.GlobalAugmentation) &&
      ts.isIdentifier(node.name)
    ) {
      found.push({ file, line: line(node), construct: "namespace" });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The TypeScript files under the given roots, skipping dependencies and build output. */
export function typeScriptFilesUnder(root: string, dirs: readonly string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "out") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) files.push(relative(root, full));
    }
  };
  for (const dir of dirs) walk(join(root, dir));
  return files.sort();
}
