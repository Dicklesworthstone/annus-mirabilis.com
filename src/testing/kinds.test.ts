import { describe, expect, test } from "bun:test";
import {
  getClarificationKind,
  registerClarificationKind,
  registeredClarificationKinds,
} from "../reader/stack/kinds.ts";

describe("the closed clarification-kind registry", () => {
  test("registering the same kind twice throws", () => {
    registerClarificationKind("__test-dup-kind__", {
      parseId: (raw) => raw,
      staticHref: (id) => `#${id}`,
      title: (id) => String(id),
      descends: true,
    });
    expect(() =>
      registerClarificationKind("__test-dup-kind__", {
        parseId: (raw) => raw,
        staticHref: (id) => `#${id}`,
        title: (id) => String(id),
        descends: true,
      }),
    ).toThrow(/already registered/);
  });

  test("an unregistered kind is refused: getClarificationKind returns undefined", () => {
    expect(getClarificationKind("__no-such-kind__")).toBeUndefined();
  });

  test("a registered kind is retrievable and its definition round-trips", () => {
    registerClarificationKind("__test-roundtrip__", {
      parseId: (raw) => (raw === "ok" ? raw : null),
      staticHref: (id) => `/static/${id}`,
      title: (id) => `Title for ${id}`,
      descends: false,
    });
    const def = getClarificationKind("__test-roundtrip__");
    expect(def).toBeDefined();
    if (def) {
      expect(def.kind).toBe("__test-roundtrip__");
      expect(def.parseId("ok")).toBe("ok");
      expect(def.parseId("not-ok")).toBeNull();
      expect(def.staticHref("ok")).toBe("/static/ok");
      expect(def.title("ok")).toBe("Title for ok");
      expect(def.descends).toBe(false);
    }
  });

  test("registering with an empty kind name throws", () => {
    expect(() =>
      registerClarificationKind("", {
        parseId: (raw) => raw,
        staticHref: (id) => `#${id}`,
        title: (id) => String(id),
        descends: true,
      }),
    ).toThrow(/non-empty name/);
  });
});

describe("this bead's own registrations: instrument-view and term", () => {
  test("instrument-view and term are present after this module loads", () => {
    const kinds = registeredClarificationKinds();
    expect(kinds).toContain("instrument-view");
    expect(kinds).toContain("term");
  });

  test("instrument-view descends (a real frame is pushed); term does not", () => {
    expect(getClarificationKind("instrument-view")?.descends).toBe(true);
    expect(getClarificationKind("term")?.descends).toBe(false);
  });

  test("exactly this bead's two kinds are registered, given no other kind-registering module has loaded", () => {
    const launchKinds = registeredClarificationKinds().filter(
      (k) => k === "instrument-view" || k === "term",
    );
    expect(launchKinds).toEqual(["instrument-view", "term"]);
  });
});

describe("instrument-view's parseId: grammar only, never existence", () => {
  test("a well-formed but unknown catalogue id still parses (opens, and fails explicitly at render)", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("zz-99")).toEqual({ raw: "zz-99" });
    }
  });

  test("a known catalogue id parses", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("bm-01")).toEqual({ raw: "bm-01" });
    }
  });

  test("ill-formed address grammar (two colons) is refused by the parser and never opened", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("bm-01:a:b")).toBeNull();
    }
  });

  test("title falls back to the raw id for an unknown instrument, and resolves a real label for a known one", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    if (def) {
      expect(def.title({ raw: "zz-99" })).toBe("zz-99");
      expect(typeof def.title({ raw: "bm-01" })).toBe("string");
      expect(def.title({ raw: "bm-01" })).not.toBe("bm-01");
    }
  });

  test("staticHref is the laboratory route with the preset", () => {
    const def = getClarificationKind("instrument-view");
    expect(def).toBeDefined();
    if (def) {
      expect(def.staticHref({ raw: "bm-01" })).toBe("/lab/bm-01");
    }
  });
});

describe("term's parseId: bare and route-slug-qualified ids", () => {
  test("a bare lowercase-first term id parses with no route slug", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("meanSquareDisplacement")).toEqual({
        routeSlug: null,
        termId: "meanSquareDisplacement",
      });
    }
  });

  test("a route-slug-qualified id parses both halves", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("brownian-motion/meanSquareDisplacement")).toEqual({
        routeSlug: "brownian-motion",
        termId: "meanSquareDisplacement",
      });
    }
  });

  test("more than one slash is refused", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("a/b/c")).toBeNull();
    }
  });

  test("an empty id is refused", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    if (def) {
      expect(def.parseId("")).toBeNull();
    }
  });

  test("term has no render function: it opens inline against already-static content", () => {
    const def = getClarificationKind("term");
    expect(def).toBeDefined();
    if (def) {
      expect(def.render).toBeUndefined();
    }
  });
});
