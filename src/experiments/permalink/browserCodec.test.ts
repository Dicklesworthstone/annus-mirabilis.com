import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { decodeTapePermalinkInBrowser, encodeTapePermalinkInBrowser } from "./browserCodec.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { bytesToBase64Url, MAX_DECOMPRESSED_TAPE_BYTES } from "./codecCore.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import type { TapeDecodeResult, TapeV2 } from "./types.ts";

/**
 * The page codec and the server codec read and write the same links (am-inst-permalink-tape-s677).
 *
 * codec.ts compresses with node:zlib, which no browser has, so no page could read ?tape=.
 * browserCodec.ts uses CompressionStream and shares every other step through codecCore.ts. A link
 * either one writes, the other reads to the same tape, and every malformed link gets the same
 * verdict from both.
 */
const TAPES: readonly TapeV2[] = [
  FIXTURE_TEACHING_TAPE_EINSTEIN_08,
  // The u64 edges the permalink contract names: 0, 2^53, 2^53 + 1 and 2^64 - 1.
  ...["0", "9007199254740992", "9007199254740993", "18446744073709551615"].map(
    (seed) => ({ ...FIXTURE_TEACHING_TAPE_EINSTEIN_08, seed }) as TapeV2,
  ),
];

const verdict = (r: TapeDecodeResult) =>
  r.kind === "invalid" ? `invalid:${r.reason}` : r.kind === "success" ? "success" : r.kind;

describe("the page codec and the server codec agree", () => {
  test("a link written by either is read to the same tape by the other", async () => {
    for (const tape of TAPES) {
      const fromPage = await encodeTapePermalinkInBrowser(tape);
      const serverRead = decodeTapePermalink(fromPage);
      expect(serverRead.kind).toBe("success");
      if (serverRead.kind === "success") expect(serverRead.tape).toEqual(tape);

      const fromServer = encodeTapePermalink(tape);
      const pageRead = await decodeTapePermalinkInBrowser(
        `https://x.test/lab/lq-08/?tape=${fromServer}`,
      );
      expect(pageRead.kind).toBe("success");
      if (pageRead.kind === "success") expect(pageRead.tape).toEqual(tape);
    }
  });

  test("every malformed link gets the same verdict from both", async () => {
    const good = encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
    const json = new TextEncoder().encode(JSON.stringify(FIXTURE_TEACHING_TAPE_EINSTEIN_08));
    const corpus: string[] = [
      "",
      "?tape=",
      "not*base64",
      "a".repeat(2049),
      good.slice(0, 8),
      good.slice(0, Math.floor(good.length / 2)),
      good.slice(0, -3),
      bytesToBase64Url(new TextEncoder().encode("{not json")),
      bytesToBase64Url(json),
      bytesToBase64Url(deflateRawSync(new TextEncoder().encode('{"tapeVersion":3}'))),
      bytesToBase64Url(deflateRawSync(new TextEncoder().encode("[]"))),
      bytesToBase64Url(Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) % 256)),
    ];
    const verdicts: string[] = [];
    for (const input of corpus) {
      const server = verdict(decodeTapePermalink(input));
      const page = verdict(await decodeTapePermalinkInBrowser(input));
      expect({ input: input.slice(0, 24), page }).toEqual({
        input: input.slice(0, 24),
        page: server,
      });
      verdicts.push(server);
    }
    // Non-vacuity: the corpus reaches refusals of several kinds and the uncompressed-JSON success.
    expect(new Set(verdicts).size).toBeGreaterThan(3);
    expect(verdicts).toContain("success");
    expect(verdicts).toContain("invalid:tape-oversize");
  });

  test("a page's Buffer polyfill without base64url does not break a link", async () => {
    // Chromium and WebKit threw "Unknown encoding: base64url" on the first LQ-08 tape link: the
    // page bundle's Buffer polyfill is present but knows no base64url. Recreated here: a Buffer
    // that refuses the encoding, as the polyfill did.
    const expected = encodeTapePermalink(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
    const real = globalThis.Buffer;
    const polyfill = {
      isEncoding: (encoding: string) => encoding !== "base64url",
      from: () => {
        throw new TypeError("Unknown encoding: base64url");
      },
    };
    let written = "";
    let read: TapeDecodeResult | undefined;
    try {
      (globalThis as { Buffer: unknown }).Buffer = polyfill;
      written = await encodeTapePermalinkInBrowser(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
      read = await decodeTapePermalinkInBrowser(expected);
    } finally {
      (globalThis as { Buffer: unknown }).Buffer = real;
    }
    expect(written).toBe(expected);
    expect(read?.kind).toBe("success");
    if (read?.kind === "success") expect(read.tape).toEqual(FIXTURE_TEACHING_TAPE_EINSTEIN_08);
  });

  test("a decompression bomb is refused at the cap, not inflated", async () => {
    // 64 KiB of zeros deflates to a few hundred bytes and would inflate past the 32 KiB cap.
    const bomb = bytesToBase64Url(deflateRawSync(new Uint8Array(MAX_DECOMPRESSED_TAPE_BYTES * 2)));
    expect(bomb.length).toBeLessThan(2048);
    const page = await decodeTapePermalinkInBrowser(bomb);
    expect(verdict(page)).toBe("invalid:tape-oversize");
    expect(verdict(decodeTapePermalink(bomb))).toBe("invalid:tape-oversize");
  });
});
