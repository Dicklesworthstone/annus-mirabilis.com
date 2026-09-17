import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import {
  applyPermalinkRobots,
  PERMALINK_ROBOTS_DATA_ATTR,
  PermalinkRobotsManager,
} from "./PermalinkRobotsManager.ts";

describe("PermalinkRobots: document head directives (am-6t51 / am-inst-permalink-tape-s677)", () => {
  beforeEach(async () => {
    await installDom();
  });

  afterEach(async () => {
    await uninstallDom();
  });

  test("AC1: injects noindex,follow and canonical link when ?tape= is present", () => {
    const tapeUrl = "https://annus-mirabilis.com/lab/bm-01/?tape=eyJsYWIiOiJibTAxIn0";
    const policy = applyPermalinkRobots(tapeUrl);

    assert.equal(policy.isNoindex, true);
    assert.equal(policy.robots, "noindex,follow");
    assert.equal(policy.canonicalUrl, "https://annus-mirabilis.com/lab/bm-01/");

    const metaRobots = document.head.querySelector<HTMLMetaElement>(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.ok(metaRobots, "Expected data-permalink-robots meta tag to be present in head");
    assert.equal(metaRobots.getAttribute("content"), "noindex,follow");

    const canonicalLink = document.head.querySelector<HTMLLinkElement>(
      `link[rel="canonical"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.ok(canonicalLink, "Expected data-permalink-robots canonical link to be present in head");
    assert.equal(canonicalLink.getAttribute("href"), "https://annus-mirabilis.com/lab/bm-01/");
  });

  test("AC1: strips presentation parameters alongside tape in canonical link", () => {
    const tapeUrlWithParams =
      "https://annus-mirabilis.com/papers/brownian-motion/s4/?tape=tok123&view=reading&detail=2#eqn-1";
    const policy = applyPermalinkRobots(tapeUrlWithParams);

    assert.equal(policy.isNoindex, true);
    assert.equal(
      policy.canonicalUrl,
      "https://annus-mirabilis.com/papers/brownian-motion/s4/#eqn-1",
    );

    const canonicalLink = document.head.querySelector<HTMLLinkElement>(
      `link[rel="canonical"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.ok(canonicalLink);
    assert.equal(
      canonicalLink.getAttribute("href"),
      "https://annus-mirabilis.com/papers/brownian-motion/s4/#eqn-1",
    );
  });

  test("AC2 (negative): clean routes without tape remain indexable with no permalink robots tag", () => {
    const cleanUrl = "https://annus-mirabilis.com/lab/bm-01/";
    const policy = applyPermalinkRobots(cleanUrl);

    assert.equal(policy.isNoindex, false);
    assert.equal(policy.robots, "index,follow");

    const metaRobots = document.head.querySelector<HTMLMetaElement>(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(
      metaRobots,
      null,
      "Clean route must NOT carry permalink noindex meta tag (negative case)",
    );

    const canonicalLink = document.head.querySelector<HTMLLinkElement>(
      `link[rel="canonical"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(canonicalLink, null);
  });

  test("transition: navigating from tape URL to clean route removes injected noindex directive", () => {
    // 1. Visit tape URL
    applyPermalinkRobots("https://annus-mirabilis.com/lab/bm-01/?tape=session_abc");
    assert.ok(
      document.head.querySelector(`meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`),
    );

    // 2. Navigate to clean document route
    const cleanPolicy = applyPermalinkRobots("https://annus-mirabilis.com/lab/bm-01/");
    assert.equal(cleanPolicy.isNoindex, false);

    // 3. Tag must be removed
    const metaRobotsAfter = document.head.querySelector(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(
      metaRobotsAfter,
      null,
      "Dynamically injected noindex tag must be removed on transition to clean route",
    );
    const canonicalLinkAfter = document.head.querySelector(
      `link[rel="canonical"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(canonicalLinkAfter, null);
  });

  test("idempotence: multiple evaluations on tape URL do not create duplicate tags", () => {
    const tapeUrl = "https://annus-mirabilis.com/lab/bm-06/?tape=dup_test";
    applyPermalinkRobots(tapeUrl);
    applyPermalinkRobots(tapeUrl);
    applyPermalinkRobots(tapeUrl);

    const metaTags = document.head.querySelectorAll(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(metaTags.length, 1, "Must not inject duplicate meta tags");

    const linkTags = document.head.querySelectorAll(
      `link[rel="canonical"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(linkTags.length, 1, "Must not inject duplicate canonical links");
  });

  test("PermalinkRobotsManager component applies policy on mount and on history changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // Set location to tape URL
    window.history.replaceState(null, "", "/lab/bm-01/?tape=preset_test");

    await act(async () => {
      root.render(createElement(PermalinkRobotsManager));
    });

    const metaOnTape = document.head.querySelector<HTMLMetaElement>(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.ok(metaOnTape, "PermalinkRobotsManager must inject noindex tag on mount for tape URL");
    assert.equal(metaOnTape.getAttribute("content"), "noindex,follow");

    // Push state to clean URL
    await act(async () => {
      window.history.pushState(null, "", "/lab/bm-01/");
    });

    const metaAfterPush = document.head.querySelector(
      `meta[name="robots"][${PERMALINK_ROBOTS_DATA_ATTR}="true"]`,
    );
    assert.equal(
      metaAfterPush,
      null,
      "PermalinkRobotsManager must remove noindex tag on pushState to clean URL",
    );

    // Unmount
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  test("negative: a second canonical is never appended when the page already has one", () => {
    // Next metadata (alternates.canonical) renders a canonical into the static
    // HTML whose href is already the document URL. Injecting another produced two
    // rel=canonical elements on a tape route, which is what this guards.
    document.head.innerHTML =
      '<link rel="canonical" href="https://annus-mirabilis.com/papers/brownian-motion/">';
    applyPermalinkRobots(
      "https://annus-mirabilis.com/papers/brownian-motion/?tape=tok123&note=private",
    );
    const links = document.head.querySelectorAll('link[rel="canonical"]');
    assert.equal(links.length, 1, "a page owning a canonical must still have exactly one");
    assert.equal(
      links[0]?.getAttribute("href"),
      "https://annus-mirabilis.com/papers/brownian-motion/",
      "the page's own canonical must be left untouched",
    );
    assert.ok(
      !(links[0]?.getAttribute("href") ?? "").includes("note"),
      "no private parameter may reach the canonical",
    );
  });
});
