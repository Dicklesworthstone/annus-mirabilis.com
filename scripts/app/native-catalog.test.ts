/**
 * The app's native screens show what the site's records say, in the site's order, with nothing
 * the app wrote itself. Built here from this repository's real records and registries.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ROUTE_INDEX } from "../../src/discovery/routeIndex.ts";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../../src/experiments/catalogue.ts";
import { labName } from "../../src/reader/actions/labNames.ts";
import {
  buildNativeCatalog,
  nativeCatalogRoutes,
  unaffiliatedInstruments,
} from "./native-catalog.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalog = buildNativeCatalog(join(REPO, "content"));

describe("the native catalogue", () => {
  it("lists the papers in the order Annalen received them, with their records' own words", () => {
    assert.deepEqual(
      catalog.papers.map((paper) => paper.slug),
      ROUTE_INDEX.map((entry) => entry.slug),
    );
    for (const paper of catalog.papers) {
      const record = JSON.parse(
        readFileSync(join(REPO, "content", "papers", `${paper.slug}.json`), "utf8"),
      ) as { title: string; germanTitle: string; sections: { id: string; title: string }[] };
      assert.equal(paper.title, record.title);
      assert.equal(paper.germanTitle, record.germanTitle);
      assert.ok(record.sections.length > 0, `${paper.slug} has no sections to outline`);
      assert.deepEqual(
        paper.sections.map((section) => [section.id, section.title, section.anchor]),
        record.sections.map((section) => [section.id, section.title, section.id]),
      );
    }
  });

  it("carries each Discover route's steps exactly as the route index prints them", () => {
    assert.deepEqual(
      catalog.discover.map((route) => [route.slug, route.name, route.blurb, route.steps]),
      ROUTE_INDEX.map((entry) => [entry.slug, entry.name, entry.blurb, [...entry.steps]]),
    );
  });

  it("puts every registered instrument in exactly one paper's group, or names it as left out", () => {
    const listed = catalog.labs.flatMap((group) => group.instruments.map((lab) => lab.id));
    const registered = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered");
    assert.ok(listed.length > 0);
    assert.equal(new Set(listed).size, listed.length, "an instrument is listed twice");
    assert.deepEqual(
      [...listed, ...unaffiliatedInstruments()].sort(),
      [...registered].sort(),
      "registered instruments and the catalogue disagree",
    );
    for (const group of catalog.labs) {
      for (const lab of group.instruments) {
        assert.equal(lab.name, labName(lab.id));
        assert.equal(lab.route, `/lab/${lab.id}/`);
      }
    }
    // Nothing in preparation is offered: its page may not exist.
    assert.ok(
      !listed.some((id) => CATALOGUE_STATUS[id as keyof typeof CATALOGUE_STATUS] !== "registered"),
    );
  });

  it("opens only site paths, each once", () => {
    const routes = nativeCatalogRoutes(catalog);
    assert.ok(routes.length > 0);
    assert.equal(new Set(routes).size, routes.length);
    for (const route of routes) assert.match(route, /^\/[a-z0-9/-]*\/$/, route);
  });
});
