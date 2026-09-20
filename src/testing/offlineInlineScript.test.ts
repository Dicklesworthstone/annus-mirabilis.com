import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { INLINE_SCRIPT_REGISTRY } from "../app/inline-scripts/registry.ts";
import { chapterFixture, fixtureMath } from "../platform/offline/chapter.test.mjs";
import { type OfflineChapterInput, packageOfflineChapter } from "../platform/offline/chapter.ts";
import { OFFLINE_DETAIL_SOURCE } from "../platform/offline/detail.inline.ts";

function fixtureInput(): OfflineChapterInput {
  return chapterFixture() as unknown as OfflineChapterInput;
}

describe("offlineInlineScript: script immutability, registry matching, and CSP enforcement", () => {
  const expectedHash = createHash("sha256").update(OFFLINE_DETAIL_SOURCE, "utf8").digest("base64");

  test("offline-detail is registered in the inline script registry with exact source", () => {
    const entry = INLINE_SCRIPT_REGISTRY.find((s) => s.id === "offline-detail");
    expect(entry).toBeDefined();
    expect(entry?.ownerBeadId).toBe("am-plat-offline-chapter-un8i");
    expect(entry?.source).toBe(OFFLINE_DETAIL_SOURCE);
    expect(entry?.module).toBe("src/platform/offline/detail.inline.ts");
  });

  test("packaged offline chapter includes the registered script and matching CSP hash", () => {
    const fixture = fixtureInput();
    const pkg = packageOfflineChapter(fixture, fixtureMath);

    // Only one script tag in the document
    const scriptMatches = pkg.html.match(/<script[\s>]/g) ?? [];
    expect(scriptMatches.length).toBe(1);

    // Exactly contains the registered script source
    expect(pkg.html).toContain(`<script>${OFFLINE_DETAIL_SOURCE}</script>`);

    // pkg.scriptHash must match the computed SHA-256 base64
    expect(pkg.scriptHash).toBe(expectedHash);

    // CSP meta tag specifies this exact sha256
    expect(pkg.html).toContain(`script-src &#39;sha256-${expectedHash}&#39;`);
  });

  test("every generated chapter shares the exact same inline script and hash", () => {
    const fixture1 = fixtureInput();
    const base2 = chapterFixture();
    const arg2 = { ...base2.arguments[0], section: "s5" };
    const fixture2: OfflineChapterInput = {
      ...(base2 as unknown as OfflineChapterInput),
      section: { id: "s5", title: "Second Section", arguments: ["arg-bm-observable"] },
      arguments: [arg2 as unknown as OfflineChapterInput["arguments"][number]],
    };

    const pkg1 = packageOfflineChapter(fixture1, fixtureMath);
    const pkg2 = packageOfflineChapter(fixture2, fixtureMath);

    expect(pkg1.scriptHash).toBe(pkg2.scriptHash);
    expect(pkg1.scriptHash).toBe(expectedHash);
  });

  test("a modified script source produces a hash mismatch that fails verification", () => {
    const tamperedScript = `${OFFLINE_DETAIL_SOURCE}\n/* unauthorized tampering */`;
    const tamperedHash = createHash("sha256").update(tamperedScript, "utf8").digest("base64");

    expect(tamperedHash).not.toBe(expectedHash);

    // Verification check simulated from buildOfflineChapters.ts:205-206
    const detailScript = INLINE_SCRIPT_REGISTRY.find((s) => s.id === "offline-detail");
    expect(detailScript).toBeDefined();

    const files = [{ scriptHash: tamperedHash }];
    const hasMismatch = files.some(
      (file) =>
        file.scriptHash !==
        createHash("sha256").update(detailScript!.source, "utf8").digest("base64"),
    );

    expect(hasMismatch).toBe(true);
  });

  test("offline detail script contains no network or storage calls", () => {
    expect(OFFLINE_DETAIL_SOURCE).not.toMatch(
      /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|Worker/,
    );
  });
});
