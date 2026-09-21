/**
 * A minimal PNG decoder, for tests that must look at what an image actually contains.
 *
 * Hand-rolled on purpose. The repository declares no PNG decoding dependency; `sharp`
 * exists in node_modules only as a transitive dependency of Next.js, and a test reaching
 * for an undeclared transitive package is a dependency nobody reviewed. This handles the
 * one case the generated cards use - 8 bits per channel, colour type 2 or 6, no
 * interlacing - and refuses anything else loudly rather than returning plausible pixels.
 *
 * Written for am-ecuf, where the defect was invisible to every existing check because
 * every existing check read the markup. The markup said `<br />`; the image said
 * otherwise.
 */

import { inflateSync } from "node:zlib";

/**
 * A coded refusal from the decoder, in the form the refusal scanner reads by
 * construction: `throw new <X>Error("kebab-code", …)` (am-p465, am-muyh).
 *
 * These five throws were bare when this file landed, and the bare-throw ratchet
 * reported the whole file as undeclared debt. A test utility's refusals are still
 * refusals: every one of them is a real input this decoder will not accept, and
 * "it is only a test helper" is how a denominator starts drifting.
 */
export class PngDecodeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${message} (${code})`);
    this.name = "PngDecodeError";
    this.code = code;
  }
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly data: Buffer;
}

export function decodePng(buffer: Buffer): DecodedPng {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new PngDecodeError("png-signature-invalid", "not a PNG: the signature does not match");
  }

  let position = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (position + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(position);
    const type = buffer.toString("ascii", position + 4, position + 8);
    const data = buffer.subarray(position + 8, position + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] as number;
      colourType = data[9] as number;
      interlace = data[12] as number;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    position += 12 + length;
  }

  if (bitDepth !== 8)
    throw new PngDecodeError("png-bit-depth-unsupported", `unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0)
    throw new PngDecodeError("png-interlace-unsupported", "unsupported interlaced PNG");
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
  if (channels === 0)
    throw new PngDecodeError(
      "png-colour-type-unsupported",
      `unsupported PNG colour type ${colourType}`,
    );

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  // Per-scanline filters, PNG specification 9.2. Each line may reference the one above
  // it, so this cannot decode a region without decoding everything before it.
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++] as number;
    const line = raw.subarray(read, read + stride);
    read += stride;
    const current = out.subarray(y * stride, (y + 1) * stride);
    const previous = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (current[x - channels] as number) : 0;
      const up = previous ? (previous[x] as number) : 0;
      const upLeft = previous && x >= channels ? (previous[x - channels] as number) : 0;
      let value = line[x] as number;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dLeft = Math.abs(p - left);
        const dUp = Math.abs(p - up);
        const dUpLeft = Math.abs(p - upLeft);
        value += dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
      } else if (filter !== 0) {
        throw new PngDecodeError(
          "png-filter-unsupported",
          `unsupported PNG filter type ${filter} on row ${y}`,
        );
      }
      current[x] = value & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

export function pixelAt(image: DecodedPng, x: number, y: number): [number, number, number] {
  const index = (y * image.width + x) * image.channels;
  return [
    image.data[index] as number,
    image.data[index + 1] as number,
    image.data[index + 2] as number,
  ];
}

/** Counts pixels in a rectangle that differ from `reference` by more than `tolerance`. */
export function countPixelsUnlike(
  image: DecodedPng,
  reference: readonly [number, number, number],
  rect: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number },
  tolerance = 8,
): { readonly count: number; readonly firstRow: number } {
  let count = 0;
  let firstRow = -1;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const [r, g, b] = pixelAt(image, x, y);
      if (
        Math.abs(r - reference[0]) > tolerance ||
        Math.abs(g - reference[1]) > tolerance ||
        Math.abs(b - reference[2]) > tolerance
      ) {
        count += 1;
        if (firstRow < 0) firstRow = y;
      }
    }
  }
  return { count, firstRow };
}
