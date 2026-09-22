/**
 * componentText.ts
 *
 * Extracts visitor-facing strings from React TSX components under src/
 * using the TypeScript Compiler API.
 *
 * Requirements:
 * - Scans .tsx files under src/ (excluding src/testing/, *.test.*, src/equations/legacy/).
 * - Extracts JSX prose as whole sentences: the text of a block element is reassembled from its
 *   own text nodes and the text of its inline children, so a rule sees what a reader reads
 *   rather than the fragments an author's markup happens to produce (am-dbpk).
 * - Extracts string literals from accessible-name and descriptive attributes:
 *   aria-label, aria-description, title, alt, placeholder, label.
 * - Extracts visitor-facing text from module-level route metadata: `export const metadata`
 *   and `export const alt`, which are declarations rather than JSX and so were invisible to
 *   everything above until 2026-09-22 (am-edit-voice-lint-trmf).
 * - Records file path, 1-based line, 1-based column, text, context, and optional attribute.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { MatchSource } from "./matchers.ts";
import type { VoiceContext } from "./rules.ts";

export interface ExtractedComponentString {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly text: string;
  readonly context: VoiceContext;
  readonly attributeName?: string | undefined;
  readonly source?: MatchSource | undefined;
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
 * Field paths inside an exported Next.js `metadata` object whose value a visitor reads.
 *
 * This is an ALLOWLIST OF WHOLE PATHS, not a set of field names matched at any depth. A
 * name-anywhere match would pick up `alternates.canonical` (a URL), `other.route-theme` (a
 * machine value) and anything a later Next.js version nests under a familiar word, and every
 * substring gate this repository has gotten wrong had its allowlist one lookup away.
 *
 * `title.template` is deliberately absent. It is "%s · Annus Mirabilis", a format string that no
 * reader ever sees whole, and scanning it would report findings against a placeholder.
 *
 * Measured against this tree on 2026-09-22: `title` 53 strings, `title.default` 1, `description`
 * 14, across the 55 files that declare an exported metadata object. The five openGraph and
 * twitter paths match NOTHING here today and are carried because they are the standard Next.js
 * fields for the same two sentences; they are exercised by fixtures in componentText.test.ts, so
 * they are not an untested branch, but nobody should read them as coverage of anything shipped.
 */
const METADATA_TEXT_PATHS = new Set([
  "title",
  "title.default",
  "title.absolute",
  "description",
  "openGraph.title",
  "openGraph.description",
  "openGraph.siteName",
  "twitter.title",
  "twitter.description",
]);

/**
 * Exported module constants that Next.js renders as reader-facing text. `alt` is the accessible
 * name of an opengraph-image or twitter-image route, which is read aloud rather than looked at.
 *
 * NOT reached, and named rather than left to be discovered: `generateMetadata`, an exported
 * async FUNCTION in 9 files of this tree. Its return value is assembled at request time from
 * route parameters, so a constant extractor cannot see it, and pretending otherwise by matching
 * string literals inside the function body would scan fragments that no reader meets as a
 * sentence.
 */
const MODULE_TEXT_CONSTANTS = new Set(["alt"]);

/**
 * HTML elements that do not interrupt a sentence. Text inside one of these belongs to the
 * surrounding sentence, so the extractor folds it into the parent's string instead of scanning
 * it alone (am-dbpk).
 *
 * `blockquote`, `q` and `cite` are deliberately absent even though two of them are inline:
 * they carry the quotation layer that exempts a rule, and folding one into its parent would
 * silently drop that exemption. Capitalised tags - other components - are absent too, because
 * this file cannot know whether a component renders inline, and guessing wrong would join two
 * sentences that a reader sees apart.
 */
const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

/**
 * What an interpolated expression contributes to the reassembled sentence.
 *
 * A string literal contributes itself, so the common `{" "}` line-break spacer becomes the space
 * it renders as. Anything else is a value this file cannot know, and it contributes a single
 * space. A space is the honest substitute for two reasons: a rule can still match across it, so
 * "Earn {n} points" is still caught, and it cannot fuse two words into a phrase the author never
 * wrote, which an empty substitution would do.
 */
function expressionText(node: ts.JsxExpression, sourceFile: ts.SourceFile): string {
  const inner = node.expression;
  if (inner && (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner))) {
    return inner.text;
  }
  void sourceFile;
  return " ";
}

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

  /** h1-h6 only. The heading rule needs to know a string IS a heading; nothing else does. */
  function isHeadingElement(node: ts.Node): boolean {
    if (!ts.isJsxElement(node)) return false;
    return /^h[1-6]$/.test(node.openingElement.tagName.getText(sourceFile));
  }

  function isQuotationElement(node: ts.Node): boolean {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sourceFile);
      if (tagName === "blockquote" || tagName === "q" || tagName === "cite") return true;
      for (const prop of node.openingElement.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === "data-voice-layer") {
          if (
            prop.initializer &&
            ts.isStringLiteral(prop.initializer) &&
            prop.initializer.text === "quotation"
          ) {
            return true;
          }
        }
      }
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName === "blockquote" || tagName === "q" || tagName === "cite") return true;
    }
    return false;
  }

  /** An inline element whose text belongs to the surrounding sentence, not to a sentence of its own. */
  function isInlineElement(node: ts.Node): boolean {
    if (isQuotationElement(node)) return false;
    let tagName: string | undefined;
    if (ts.isJsxElement(node)) tagName = node.openingElement.tagName.getText(sourceFile);
    else if (ts.isJsxSelfClosingElement(node)) tagName = node.tagName.getText(sourceFile);
    return tagName !== undefined && INLINE_TAGS.has(tagName);
  }

  /**
   * Text nodes already folded into an ancestor's reassembled sentence. Without this set the same
   * words would be scanned twice, once inside the sentence and once alone, and a single authoring
   * mistake would be reported two or three times depending on how much emphasis it carried.
   */
  const consumed = new Set<ts.Node>();

  /**
   * Concatenates one element's sentence: its own text nodes, the text of its inline children, and
   * a substitute for each interpolation, in source order. A block child is a boundary and is left
   * for its own visit. Returns the assembled text and the first text node it came from, which is
   * the position a finding reports so an author still gets a place to open.
   */
  function assembleSentence(children: readonly ts.JsxChild[]): {
    text: string;
    first: ts.Node | undefined;
  } {
    let text = "";
    let first: ts.Node | undefined;
    for (const child of children) {
      if (ts.isJsxText(child)) {
        const raw = child.getText(sourceFile);
        if (raw.trim() && first === undefined) first = child;
        if (raw.trim()) consumed.add(child);
        text += raw;
      } else if (ts.isJsxExpression(child)) {
        text += expressionText(child, sourceFile);
      } else if (isInlineElement(child)) {
        if (ts.isJsxElement(child)) {
          // Mark the element itself, not only its text: the walk reaches it again as a child and
          // must not emit the same words a second time as a sentence of their own.
          consumed.add(child);
          const inner = assembleSentence(child.children);
          if (inner.first !== undefined && first === undefined) first = inner.first;
          text += inner.text;
        }
        // A self-closing inline element (<br />, <wbr />) contributes no text.
      } else {
        // A block child ends this sentence and starts its own; leave it for its own visit.
        text += " ";
      }
    }
    // Collapse the newlines and indentation of source formatting the way a browser does, so the
    // scanned string is the sentence a reader sees on one line.
    return { text: text.replace(/\s+/gu, " ").trim(), first };
  }

  function isExported(node: ts.VariableStatement): boolean {
    return node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  /** The literal text of a node, or null when its value is computed and cannot be read here. */
  function literalText(node: ts.Expression): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
  }

  /**
   * Emits one metadata string. The context is `ui-label` for every one of them, on the rule that
   * a string must not change severity because it changed declaration form: `alt` and `title` as
   * JSX attributes are already ui-label in section 2, and the same words in `export const alt`
   * are the same words.
   *
   * No `source.element` is set, deliberately. A <title> in Title Case is ordinary typography for
   * a browser tab and a search result, and the title-case rule only fires on a heading element,
   * so leaving this undefined is what keeps 54 page titles out of that backlog.
   */
  function emitMetadataString(node: ts.Expression, fieldPath: string): void {
    const text = literalText(node);
    if (!text?.trim()) return;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    results.push({
      file: relativeFile,
      line: line + 1,
      column: character + 1,
      text: text.trim(),
      context: "ui-label",
      attributeName: fieldPath,
    });
  }

  function emitConstantText(initializer: ts.Expression, declaredName: string): void {
    emitMetadataString(initializer, declaredName);
  }

  /** Walks an exported metadata object, emitting only the whole paths on the allowlist. */
  function visitMetadataObject(object: ts.ObjectLiteralExpression, prefix: string): void {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteral(property.name)
          ? property.name.text
          : null;
      if (name === null) continue;
      const fieldPath = prefix ? `${prefix}.${name}` : name;
      if (ts.isObjectLiteralExpression(property.initializer)) {
        visitMetadataObject(property.initializer, fieldPath);
      } else if (METADATA_TEXT_PATHS.has(fieldPath)) {
        emitMetadataString(property.initializer, fieldPath);
      }
    }
  }

  function visit(node: ts.Node, currentLayer?: "quotation" | "translation"): void {
    let layer = currentLayer;
    if (isQuotationElement(node)) {
      layer = "quotation";
    }

    // 1. JSX prose, reassembled one sentence per element (am-dbpk).
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && !consumed.has(node)) {
      const { text, first } = assembleSentence(node.children);
      if (first && text && !/^[{};()]+$/.test(text)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          first.getStart(sourceFile),
        );
        results.push({
          file: relativeFile,
          line: line + 1,
          column: character + 1,
          text,
          context: "prose",
          source:
            layer || isHeadingElement(node)
              ? {
                  ...(layer ? { layer } : {}),
                  ...(isHeadingElement(node) ? { element: "heading" as const } : {}),
                }
              : undefined,
        });
      }
    }

    // A text node an ancestor already folded in is not scanned again. One that no element owns -
    // a stray child of a non-element node - is still scanned on its own.
    if (ts.isJsxText(node) && !consumed.has(node)) {
      const rawText = node.getText(sourceFile);
      const text = rawText.replace(/\s+/gu, " ").trim();
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
          source: layer ? { layer } : undefined,
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
            source: layer ? { layer } : undefined,
          });
        }
      }
    }

    // 3. Module-level route metadata (am-edit-voice-lint-trmf). `export const metadata` and
    // `export const alt` are declarations, not JSX, so sections 1 and 2 never saw them. The gap
    // was not theoretical: layout.tsx's default <title> carried an em dash on every route of the
    // deployed site until a person following a hunch found it by hand.
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const declaredName = declaration.name.text;

        if (MODULE_TEXT_CONSTANTS.has(declaredName)) {
          emitConstantText(declaration.initializer, declaredName);
        } else if (
          declaredName === "metadata" &&
          ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          visitMetadataObject(declaration.initializer, "");
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, layer));
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
