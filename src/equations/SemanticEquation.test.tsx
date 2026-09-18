import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import brownianPayload from "../generated/brownian-equations.json";
import { EquationScope } from "./EquationScope.tsx";
import { SemanticEquation } from "./SemanticEquation.tsx";
import type { CompiledEquation } from "./viewTypes.ts";

describe("SemanticEquation (am-3sha)", () => {
  const equations = brownianPayload.equations as readonly CompiledEquation[];
  const eq1 = equations[0];
  const eq2 = equations[1];

  test("each equation chips nav landmark carries an accessible name identifying its equation", () => {
    assert.ok(eq1, "eq1 must exist");
    const markup = renderToStaticMarkup(<SemanticEquation equation={eq1} />);
    expect(markup).toContain(`aria-label="Terms and operations in ${eq1.title}"`);
    // Must NOT use generic unadorned label
    expect(markup).not.toContain('aria-label="Terms and operations"');
  });

  test("negative test (AC3): multiple equations on the same page do not share nav landmark names", () => {
    assert.ok(eq1, "eq1 must exist");
    assert.ok(eq2, "eq2 must exist");

    const markup = renderToStaticMarkup(
      <div>
        <SemanticEquation equation={eq1} />
        <SemanticEquation equation={eq2} />
      </div>,
    );

    const matches = Array.from(
      markup.matchAll(/<nav\b[^>]*\bclass="equation-chips"[^>]*\baria-label="([^"]+)"/g),
    ).map((m) => m[1]);

    expect(matches.length).toBe(2);
    expect(matches[0]).not.toBe(matches[1]);
    expect(matches[0]).toBe(`Terms and operations in ${eq1.title}`);
    expect(matches[1]).toBe(`Terms and operations in ${eq2.title}`);
  });

  test("falls back to equation.id when title is empty", () => {
    assert.ok(eq1, "eq1 must exist");
    const fallbackEq: CompiledEquation = { ...eq1, title: "" };
    const markup = renderToStaticMarkup(<SemanticEquation equation={fallbackEq} />);
    expect(markup).toContain(`aria-label="Terms and operations in ${fallbackEq.id}"`);
  });
});

describe("SemanticEquation disambiguation (am-txy3)", () => {
  const equations = brownianPayload.equations as readonly CompiledEquation[];
  const eq1 = equations[0];
  const eq2 = equations[1];

  test("renders same equation in different scopes with distinct data-equation-id and nav names (AC3)", () => {
    assert.ok(eq1, "eq1 must exist");
    const markup = renderToStaticMarkup(
      <div>
        <SemanticEquation equation={eq1} scopeLabel="reading argument" />
        <SemanticEquation equation={eq1} scope="lab" scopeLabel="laboratory model" />
      </div>,
    );

    const ids = Array.from(markup.matchAll(/data-equation-id="([^"]+)"/g)).map((m) => m[1]);
    expect(ids.length).toBe(2);
    expect(ids[0]).toBe(eq1.id);
    expect(ids[1]).toBe(`${eq1.id}-lab`);
    expect(ids[0]).not.toBe(ids[1]);

    const navs = Array.from(
      markup.matchAll(/<nav\b[^>]*\bclass="equation-chips"[^>]*\baria-label="([^"]+)"/g),
    ).map((m) => m[1]);
    expect(navs.length).toBe(2);
    expect(navs[0]).toBe(`Terms and operations in ${eq1.title} (reading argument)`);
    expect(navs[1]).toBe(`Terms and operations in ${eq1.title} (laboratory model)`);
    expect(navs[0]).not.toBe(navs[1]);
  });

  test("negative test (AC4): different equations in the same scope maintain distinct landmark names and do not collapse", () => {
    assert.ok(eq1, "eq1 must exist");
    assert.ok(eq2, "eq2 must exist");

    const markup = renderToStaticMarkup(
      <div>
        <SemanticEquation equation={eq1} scopeLabel="reading argument" />
        <SemanticEquation equation={eq2} scopeLabel="reading argument" />
      </div>,
    );

    const navs = Array.from(
      markup.matchAll(/<nav\b[^>]*\bclass="equation-chips"[^>]*\baria-label="([^"]+)"/g),
    ).map((m) => m[1]);
    expect(navs.length).toBe(2);
    expect(navs[0]).not.toBe(navs[1]);
    expect(navs[0]).toBe(`Terms and operations in ${eq1.title} (reading argument)`);
    expect(navs[1]).toBe(`Terms and operations in ${eq2.title} (reading argument)`);
  });

  test("propagates scope and scopeLabel from EquationScope context", () => {
    assert.ok(eq1, "eq1 must exist");
    const markup = renderToStaticMarkup(
      <EquationScope scope="lab" scopeLabel="laboratory model">
        <SemanticEquation equation={eq1} />
      </EquationScope>,
    );

    expect(markup).toContain(`data-equation-id="${eq1.id}-lab"`);
    expect(markup).toContain(
      `aria-label="Terms and operations in ${eq1.title} (laboratory model)"`,
    );
  });
});
