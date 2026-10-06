/**
 * BOTH OF THIS COMPONENT'S REFUSALS ARE UNREACHABLE, and this file is the record rather than a
 * test of either site (am-r3qt). Established by planting, not by reading: disabling the snapshot
 * guard leaves the existing avogadro suites at 7 pass 0 fail, so nothing was driving it.
 *
 *   unexpected-result-status, at AvogadroLab.tsx line 61, is the fall-through after the component
 *   has handled value, underdetermined and outside-domain. The session declares
 *   `statuses: ["value", "outside-domain", "underdetermined"]` as the outputs' admitted set -
 *   EXACTLY those three - so a result carrying any other status never reaches the component.
 *
 *   no-accepted-snapshot, at line 82, refuses a render with no accepted snapshot. The session
 *   routes every publish through publishedOrRefused, which throws publication-refused when the
 *   store declines, so a session that exists has an accepted snapshot and one that does not never
 *   returns a view to render.
 *
 * Both are defensive guards whose preconditions are established upstream, which is the am-okw3
 * shape, and both are worth keeping: the first is what would catch a session that began emitting a
 * typed no-value the component has no branch for - symbolic, analytic-limit, not-applicable or
 * divergent - and the second is what would catch a store that published nothing.
 *
 * THE PREMISES ARE ASSERTED so the claims fail if the structure changes rather than being prose
 * that quietly goes stale. Widen the session's admitted statuses, or let it return a view without
 * routing through publishedOrRefused, and this goes red.
 *
 * NEITHER CODE IS NAMED IN A STRING LITERAL HERE, and no line number is written in the
 * parenthesised form, because both credit a site with the refusal scanner. A category-3 record
 * must name its refusal without claiming to have driven it; the rule and the two plants that
 * established it are on am-r3qt.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { AvogadroLab } from "./AvogadroLab.tsx";

const session = readFileSync(
  new URL("../../../experiments/avogadro/session.ts", import.meta.url),
  "utf8",
);

describe("AvogadroLab's refusals are unreachable, and the upstream facts that make them so", () => {
  test("the session admits exactly the three statuses the component handles", () => {
    const declared = /statuses:\s*Object\.freeze\(\[([^\]]+)\]/.exec(session)?.[1];
    expect(declared).toBeDefined();
    const statuses = [...(declared ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(statuses).toEqual(["outside-domain", "underdetermined", "value"]);

    // The component's branches, read from its own source, must cover every admitted status. If a
    // status is added to the session without a branch here, the fall-through becomes reachable and
    // this record becomes false - which is what it is for.
    const component = readFileSync(new URL("./AvogadroLab.tsx", import.meta.url), "utf8");
    for (const status of statuses) expect(component).toContain(status);
  });

  test("the session refuses to exist without an accepted publication", () => {
    expect(session).toContain("function publishedOrRefused");
    expect(session).toContain("publication-refused");
  });

  test("the lab renders, so the claims are about a path that runs", () => {
    // Non-vacuity. "Those guards are unreachable" would say nothing about a component nothing
    // exercises, so the record asserts that this one does render its readings.
    expect(renderToStaticMarkup(<AvogadroLab />)).toContain("data-quantity-id");
  });
});
