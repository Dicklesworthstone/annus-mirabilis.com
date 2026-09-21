/**
 * Each of the decoder's five refusals, exercised by an input that reaches it.
 *
 * The rule this file exists to satisfy: a coded refusal earns its code only if some
 * test would FAIL with the refusal deleted. Five throws coded and five tests written
 * is not the same claim - the tests have to reach the throws, and each plant below was
 * run with its refusal removed to confirm the arm goes red rather than passing on some
 * earlier guard.
 *
 * The fixtures are built here rather than stored, because a stored malformed PNG is a
 * binary nobody can review in a diff. They carry no CRC: this decoder does not check
 * chunk CRCs, and writing correct ones would suggest it does.
 *
 * Owning beads: am-muyh (the bare-throw ratchet reported this file as undeclared debt),
 * am-p465 (the coded form the scanner reads by construction).
 */

import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePng, PngDecodeError } from "./decodePng.ts";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  // Zero CRC on purpose: decodePng does not verify chunk CRCs, and a correct one here
  // would imply it does.
  return Buffer.concat([length, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

function ihdr(options: {
  width?: number;
  height?: number;
  bitDepth?: number;
  colourType?: number;
  interlace?: number;
}): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(options.width ?? 1, 0);
  data.writeUInt32BE(options.height ?? 1, 4);
  data[8] = options.bitDepth ?? 8;
  data[9] = options.colourType ?? 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = options.interlace ?? 0;
  return chunk("IHDR", data);
}

function png(header: Buffer, idat?: Buffer): Buffer {
  return Buffer.concat([
    SIGNATURE,
    header,
    ...(idat ? [chunk("IDAT", idat)] : []),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Asserts the decoder refuses with exactly this code, and not by some other route. */
function refusalCodeOf(bytes: Buffer): string {
  try {
    decodePng(bytes);
  } catch (error) {
    assert.ok(
      error instanceof PngDecodeError,
      `expected a coded PngDecodeError, got ${String(error)}`,
    );
    return error.code;
  }
  throw new Error("the decoder accepted an input it should have refused");
}

describe("decodePng refuses what it cannot decode, by code", () => {
  test("a buffer whose signature is not PNG", () => {
    const notAPng = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(32)]);
    expect(refusalCodeOf(notAPng)).toBe("png-signature-invalid");
  });

  test("sixteen bits per channel", () => {
    // Reaches the depth check only because the signature is valid; that ordering is
    // what makes this arm test the depth refusal rather than the signature one.
    expect(refusalCodeOf(png(ihdr({ bitDepth: 16 })))).toBe("png-bit-depth-unsupported");
  });

  test("an interlaced image", () => {
    expect(refusalCodeOf(png(ihdr({ interlace: 1 })))).toBe("png-interlace-unsupported");
  });

  test("a palette colour type", () => {
    // Colour type 3 is indexed-palette: real PNG, and outside what this decoder reads.
    expect(refusalCodeOf(png(ihdr({ colourType: 3 })))).toBe("png-colour-type-unsupported");
  });

  test("an unknown scanline filter", () => {
    // One 1x1 RGB row: a filter byte the specification does not define, then three
    // colour bytes. Filter 5 does not exist; the four that do are 0 to 4.
    const scanline = deflateSync(Buffer.from([5, 0x00, 0x00, 0x00]));
    const bytes = png(ihdr({ colourType: 2, width: 1, height: 1 }), scanline);
    expect(refusalCodeOf(bytes)).toBe("png-filter-unsupported");
  });

  test("the codes are kebab-case, which is what makes the scanner read them", () => {
    // am-p465: the scanner recognises `throw new <X>Error("kebab-code"`, so a code in
    // another shape would leave these five throws counted as bare however typed the
    // class is. This asserts the property the scanner actually keys on.
    const codes = [
      "png-signature-invalid",
      "png-bit-depth-unsupported",
      "png-interlace-unsupported",
      "png-colour-type-unsupported",
      "png-filter-unsupported",
    ];
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/);
  });

  test("a well-formed image still decodes, so none of this refuses everything", () => {
    // Without this the five arms above are satisfied by a decoder that throws always.
    const scanline = deflateSync(Buffer.from([0, 0x7f, 0x80, 0x81]));
    const image = decodePng(png(ihdr({ colourType: 2, width: 1, height: 1 }), scanline));
    expect(image.width).toBe(1);
    expect(image.height).toBe(1);
    expect(image.channels).toBe(3);
    expect([...image.data]).toEqual([0x7f, 0x80, 0x81]);
  });
});
