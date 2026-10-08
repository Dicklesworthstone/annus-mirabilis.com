/**
 * THIS FILE USED TO ASSERT THE DEFECT. Its one test was titled "static alias anchors land a retired
 * id without JavaScript" and asserted `expect(html).toContain("hidden")` on static markup. It never
 * navigated, so it could not see that `hidden` is exactly what stops the landing, and it recorded
 * the breaking attribute as though it were the feature.
 *
 * The browser fact that decides it is measured in scripts/e2e/aliasAnchorLands.e2e.test.ts, in
 * chromium AND webkit, because a claim about fragment navigation cannot be checked by a renderer.
 * What is left here is the half a unit test can honestly hold: the shape of the props, and the
 * invariant that the shape must never acquire `hidden` again.
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AliasRecord } from "../../content/aliases.ts";
import { aliasAnchorProps } from "./aliasAnchors.ts";
import { aliasIdsForLocation } from "./aliases.ts";

function record(retiredId: string, replacementIds: readonly string[]): AliasRecord {
  return {
    retiredId,
    kind: "retired",
    replacementIds,
    reason: "fixture",
    date: "2026-01-01",
    editor: "test",
  };
}

describe("static alias anchors put the retired spelling at the successor's location", () => {
  test("the successor location emits an element whose id is the retired spelling", () => {
    const aliases = [record("s4-p2-s1-old", ["s4-p2-s1"])];
    const retired = aliasIdsForLocation("s4-p2-s1", aliases);
    expect(retired).toEqual(["s4-p2-s1-old"]);
    const html = renderToStaticMarkup(
      createElement(
        "p",
        { id: "s4-p2-s1" },
        ...retired.map((id) => createElement("span", { key: id, ...aliasAnchorProps(id) })),
        "That electrodynamics of moving bodies",
      ),
    );
    expect(html).toContain('id="s4-p2-s1-old"');
    expect(html).toContain("data-alias");
    expect(html).toContain('id="s4-p2-s1"');
  });

  test("IT IS NEVER HIDDEN, because a hidden target has no box to scroll to", () => {
    // The regression this file exists to stop. Measured in chromium and webkit: a `hidden` span as
    // a fragment target leaves scrollY at 0 while the same span without it lands at 4066 on a
    // 6,000px page. Asserted on the props object AND on the rendered markup, because `hidden` can
    // arrive either as a prop here or as an attribute written by hand at a call site.
    const props = aliasAnchorProps("s4-p2-s1-old") as Record<string, unknown>;
    expect("hidden" in props).toBe(false);
    expect(Object.keys(props).sort()).toEqual(["data-alias", "id"]);
    const html = renderToStaticMarkup(
      createElement("span", { ...aliasAnchorProps("s4-p2-s1-old") }),
    );
    expect(html).not.toContain("hidden");
    // And the positive control for that negative: the renderer DOES emit the word when asked, so
    // `not.toContain` above is a fact about these props rather than about renderToStaticMarkup.
    const withHidden = renderToStaticMarkup(createElement("span", { id: "x", hidden: true }));
    expect(withHidden).toContain("hidden");
  });

  test("it refuses an empty retired id rather than emitting an unaddressable anchor", () => {
    expect(() => aliasAnchorProps("")).toThrow(TypeError);
  });
});
