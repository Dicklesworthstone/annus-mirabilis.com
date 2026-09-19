import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = name => readFile(new URL(`../reader/faces/${name}`, import.meta.url), "utf8");
test("the source-rendering gloss face remains a server module without React state hooks", async () => {
  const source = await read("GlossFace.tsx");
  const ast = ts.createSourceFile("GlossFace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.ok(!/^['"]use client['"]/m.test(source));
  assert.ok(!/\buse(?:State|Effect|SyncExternalStore)\b/.test(source));
  assert.match(source, /import \{ GlossReasoningToggle \}/);
  assert.match(source, /showReasoningWords\s*\n/);
  assert.match(source, /getModalityClasses\(\)/);
});

test("the hydrated leaf cannot pull server validation or KaTeX into the browser", async () => {
  const source = await read("GlossReasoningToggle.tsx");
  const ast = ts.createSourceFile("GlossReasoningToggle.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.match(source, /^"use client";/);
  assert.ok(!ast.statements.some(statement => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)));
  assert.match(source, /defaultChecked=\{initiallyChecked\}/);
  assert.ok(!/\bdisabled\b/.test(source));
});

test("native checked state controls reasoning visibility, not a hydration-only attribute", async () => {
  const css = await read("glossReasoning.css");
  assert.match(css, /:has\(\[data-toggle-reasoning\]:checked\)/);
  assert.match(css, /@media screen/);
  assert.ok(!css.includes('[data-reasoning-words="off"]'));
  for (const selector of [".reasoning-words-details", ".cue-reasoning-marked", "[data-reasoning-action]", ".cue-reasoning-fallback"])
    assert.ok(css.includes(selector));
});
