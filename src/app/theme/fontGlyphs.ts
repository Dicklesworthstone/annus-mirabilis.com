/**
 * A minimal, from-scratch TrueType `cmap` reader (am-design-themes-typography-288q).
 * "GLYPH AVAILABILITY IS THE BEAD" -- a self-hosted face that silently falls
 * back for a diacritic or a math glyph is wrong. This module reads the real
 * shipped font binary and answers, per Unicode code point, whether that font
 * actually maps a glyph to it -- no dependency added, no glyph list guessed
 * from documentation. It supports cmap subtable formats 4 (BMP segment
 * mapping) and 12 (segmented coverage, full Unicode), the two formats every
 * modern variable TrueType font ships.
 */

export class MalformedFontError extends Error {}

interface CmapSubtable {
  readonly format: number;
  readonly has: (codePoint: number) => boolean;
}

function readTableDirectory(view: DataView): Map<string, { offset: number; length: number }> {
  if (view.byteLength < 12) throw new MalformedFontError("File is too short to be a font.");
  const numTables = view.getUint16(4);
  const directory = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const recordOffset = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(recordOffset),
      view.getUint8(recordOffset + 1),
      view.getUint8(recordOffset + 2),
      view.getUint8(recordOffset + 3),
    );
    directory.set(tag, {
      offset: view.getUint32(recordOffset + 8),
      length: view.getUint32(recordOffset + 12),
    });
  }
  return directory;
}

function parseFormat4(view: DataView, subtableOffset: number): CmapSubtable {
  const segCountX2 = view.getUint16(subtableOffset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOffset = subtableOffset + 14;
  const startCodeOffset = endCodeOffset + segCountX2 + 2; // + reservedPad
  const idDeltaOffset = startCodeOffset + segCountX2;
  const idRangeOffsetOffset = idDeltaOffset + segCountX2;
  return {
    format: 4,
    has(codePoint: number): boolean {
      if (codePoint > 0xffff) return false;
      for (let i = 0; i < segCount; i++) {
        const endCode = view.getUint16(endCodeOffset + i * 2);
        if (codePoint > endCode) continue;
        const startCode = view.getUint16(startCodeOffset + i * 2);
        if (codePoint < startCode) return false;
        const idDelta = view.getInt16(idDeltaOffset + i * 2);
        const idRangeOffset = view.getUint16(idRangeOffsetOffset + i * 2);
        if (idRangeOffset === 0) {
          const glyphId = (codePoint + idDelta) & 0xffff;
          return glyphId !== 0;
        }
        const glyphIndexAddress =
          idRangeOffsetOffset + i * 2 + idRangeOffset + (codePoint - startCode) * 2;
        if (glyphIndexAddress + 2 > view.byteLength) return false;
        const rawGlyphId = view.getUint16(glyphIndexAddress);
        if (rawGlyphId === 0) return false;
        return ((rawGlyphId + idDelta) & 0xffff) !== 0;
      }
      return false;
    },
  };
}

function parseFormat12(view: DataView, subtableOffset: number): CmapSubtable {
  const nGroups = view.getUint32(subtableOffset + 12);
  const groupsOffset = subtableOffset + 16;
  return {
    format: 12,
    has(codePoint: number): boolean {
      // Groups are sorted by startCharCode; a binary search would be faster,
      // but nGroups is small (tens to low hundreds) for every font this site ships.
      for (let i = 0; i < nGroups; i++) {
        const groupOffset = groupsOffset + i * 12;
        const startCharCode = view.getUint32(groupOffset);
        const endCharCode = view.getUint32(groupOffset + 4);
        if (codePoint >= startCharCode && codePoint <= endCharCode) return true;
      }
      return false;
    },
  };
}

/**
 * Selects the best Unicode cmap subtable: prefer Windows full-Unicode
 * (platform 3, encoding 10, format 12), then Windows BMP (platform 3,
 * encoding 1, format 4), then the Unicode platform (platform 0), in that
 * order, matching how real text-shaping engines pick a cmap subtable.
 */
function selectBestSubtable(view: DataView, cmapOffset: number): CmapSubtable {
  const numSubtables = view.getUint16(cmapOffset + 2);
  const candidates: Array<{ platformID: number; encodingID: number; offset: number }> = [];
  for (let i = 0; i < numSubtables; i++) {
    const recordOffset = cmapOffset + 4 + i * 8;
    candidates.push({
      platformID: view.getUint16(recordOffset),
      encodingID: view.getUint16(recordOffset + 2),
      offset: cmapOffset + view.getUint32(recordOffset + 4),
    });
  }
  const rank = (c: { platformID: number; encodingID: number }): number => {
    if (c.platformID === 3 && c.encodingID === 10) return 0;
    if (c.platformID === 3 && c.encodingID === 1) return 1;
    if (c.platformID === 0) return 2;
    return 3;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  for (const candidate of candidates) {
    const format = view.getUint16(candidate.offset);
    if (format === 12) return parseFormat12(view, candidate.offset);
    if (format === 4) return parseFormat4(view, candidate.offset);
  }
  throw new MalformedFontError("No supported cmap subtable (format 4 or 12) found.");
}

/** Parses a TrueType/OpenType font's `cmap` table into a `hasGlyph` predicate. */
export function loadCmap(fontBytes: ArrayBuffer): { hasGlyph: (codePoint: number) => boolean } {
  const view = new DataView(fontBytes);
  const directory = readTableDirectory(view);
  const cmap = directory.get("cmap");
  if (!cmap) throw new MalformedFontError("Font has no 'cmap' table.");
  const subtable = selectBestSubtable(view, cmap.offset);
  return { hasGlyph: (codePoint: number) => subtable.has(codePoint) };
}

/** The missing code points, as `{codePoint, char}`, for every entry in `codePoints` this font's cmap does not map. */
export function missingGlyphs(
  fontBytes: ArrayBuffer,
  codePoints: readonly number[],
): ReadonlyArray<{ codePoint: number; char: string }> {
  const { hasGlyph } = loadCmap(fontBytes);
  const missing: Array<{ codePoint: number; char: string }> = [];
  for (const codePoint of codePoints) {
    if (!hasGlyph(codePoint)) missing.push({ codePoint, char: String.fromCodePoint(codePoint) });
  }
  return missing;
}
