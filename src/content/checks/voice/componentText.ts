/**
 * componentText.ts
 *
 * Extracts visitor-facing strings from React TSX components under src/
 * using the TypeScript Compiler API.
 *
 * Requirements:
 * - Scans .tsx files under src/ (excluding src/testing/, *.test.*, src/equations/legacy/).
 * - Extracts JSX text nodes.
 * - Extracts string literals from accessible-name and descriptive attributes:
 *   aria-label, aria-description, title, alt, placeholder, label.
 * - Records file path, 1-based line, 1-based column, text, context, and optional attribute.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { VoiceContext } from "./rules.ts";

export interface ExtractedComponentString {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly text: string;
  readonly context: VoiceContext;
  readonly attributeName?: string | undefined;
}

export const ACCESSIBLE_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "title",
  "alt",
  "placeholder",
  "label",
]);

/**
 * Parses a TSX source file and extracts all visitor-facing text and attribute literals.
 */
export function extractStringsFromTsx(
  filePath: string,
  sourceCode: string,
  rootPath?: string,
): ExtractedComponentString[] {
  const relativeFile = rootPath ? path.relative(rootPath, filePath) : filePath;
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const results: ExtractedComponentString[] = [];

  function visit(node: ts.Node): void {
    // 1. JSX Text Nodes
    if (ts.isJsxText(node)) {
      const rawText = node.getText(sourceFile);
      const text = rawText.trim();
      if (text && !/^[{};()]+$/.test(text)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        results.push({
          file: relativeFile,
          line: line + 1,
          column: character + 1,
          text,
          context: "prose",
        });
      }
    }

    // 2. JSX Attributes (e.g. aria-label="...", title="...", alt="...")
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (ACCESSIBLE_ATTRIBUTES.has(attrName) && node.initializer) {
        let textValue: string | null = null;
        let pos = node.initializer.getStart(sourceFile);

        if (ts.isStringLiteral(node.initializer)) {
          textValue = node.initializer.text;
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          if (ts.isStringLiteral(node.initializer.expression)) {
            textValue = node.initializer.expression.text;
            pos = node.initializer.expression.getStart(sourceFile);
          } else if (ts.isNoSubstitutionTemplateLiteral(node.initializer.expression)) {
            textValue = node.initializer.expression.text;
            pos = node.initializer.expression.getStart(sourceFile);
          }
        }

        if (textValue?.trim()) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          results.push({
            file: relativeFile,
            line: line + 1,
            column: character + 1,
            text: textValue.trim(),
            context: "ui-label",
            attributeName: attrName,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

/**
 * Recursively discovers all .tsx files under a directory, ignoring exclusions.
 */
export function findTsxFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Exclude testing directories and legacy directories
        if (
          entry === "testing" ||
          entry === "node_modules" ||
          entry === ".git" ||
          entry === ".next" ||
          entry === "legacy" ||
          entry === "__fixtures__"
        ) {
          continue;
        }
        walk(fullPath);
      } else if (stat.isFile()) {
        if (entry.endsWith(".tsx") && !entry.includes(".test.") && !entry.includes(".spec.")) {
          files.push(fullPath);
        }
      }
    }
  }

  if (statSync(dir).isDirectory()) {
    walk(dir);
  }
  return files;
}

/**
 * Extracts all component strings across the repository's src/ directory.
 */
export function extractAllComponentStrings(
  srcDir: string,
  rootDir: string,
): ExtractedComponentString[] {
  const files = findTsxFiles(srcDir);
  const allStrings: ExtractedComponentString[] = [];

  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const extracted = extractStringsFromTsx(file, code, rootDir);
    allStrings.push(...extracted);
  }

  return allStrings;
}
