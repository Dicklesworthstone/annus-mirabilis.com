/**
 * A VARIABLE FONT AS ITS DEFAULT INSTANCE, for the share cards' renderer.
 *
 * The site sets its type in variable TrueType files (public/fonts), and next/og's font parser
 * fails on a variable font's fvar table ("undefined is not an object (evaluating 'names[...]')").
 * A variable TrueType font keeps its default instance's outlines in glyf and its default advances
 * in hmtx; the tables that vary them are separate. Without those tables the file is an ordinary
 * static font, the default instance, which is the same typeface the site shows. So the cards are
 * set in the site's own Newsreader and Plus Jakarta Sans, read from the files the site serves,
 * with no second copy of either font in the repository and no request to a font service.
 *
 * Checksums are left at zero: the renderer does not verify them, and this font never leaves the
 * build.
 */
const VARIATION_TABLES = new Set(["fvar", "gvar", "avar", "cvar", "HVAR", "MVAR", "VVAR", "STAT"]);

export function defaultInstance(font: Uint8Array): Uint8Array {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const numTables = view.getUint16(4);
  const kept: { tag: string; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const entry = 12 + i * 16;
    const tag = String.fromCharCode(...font.subarray(entry, entry + 4));
    const offset = view.getUint32(entry + 8);
    const length = view.getUint32(entry + 12);
    if (!VARIATION_TABLES.has(tag)) kept.push({ tag, data: font.subarray(offset, offset + length) });
  }
  const padded = (length: number) => (length + 3) & ~3;
  const directory = 12 + kept.length * 16;
  const out = new Uint8Array(kept.reduce((size, t) => size + padded(t.data.length), directory));
  const write = new DataView(out.buffer);
  write.setUint32(0, view.getUint32(0));
  write.setUint16(4, kept.length);
  // The table directory's binary-search fields, recomputed for the new table count.
  let entrySelector = 0;
  while (2 ** (entrySelector + 1) <= kept.length) entrySelector++;
  const searchRange = 2 ** entrySelector * 16;
  write.setUint16(6, searchRange);
  write.setUint16(8, entrySelector);
  write.setUint16(10, kept.length * 16 - searchRange);
  let offset = directory;
  kept.forEach((table, i) => {
    const entry = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[entry + c] = table.tag.charCodeAt(c);
    write.setUint32(entry + 8, offset);
    write.setUint32(entry + 12, table.data.length);
    out.set(table.data, offset);
    offset += padded(table.data.length);
  });
  return out;
}

/** The four-character tags of a TrueType font's tables, in directory order. */
export function tableTags(font: Uint8Array): readonly string[] {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  return Array.from({ length: view.getUint16(4) }, (_, i) =>
    String.fromCharCode(...font.subarray(12 + i * 16, 16 + i * 16)),
  );
}
