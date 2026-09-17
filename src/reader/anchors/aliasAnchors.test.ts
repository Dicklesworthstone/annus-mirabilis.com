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

describe("static alias anchors land a retired id without JavaScript", () => {
  test("the successor location emits a hidden element whose id is the retired spelling", () => {
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
    expect(html).toContain("hidden");
    expect(html).toContain('id="s4-p2-s1"');
  });
});
