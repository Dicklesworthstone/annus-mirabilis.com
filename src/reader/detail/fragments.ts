/**
 * am-read-detail-axis-sfc. The fragment writer for readings a paper's budget pushes out of the
 * static reading face: when `scripts/measure-reading-face.ts` reports a paper over the 250 kB
 * gzip budget, that paper's largest sections keep R0 and R1 inline and move R2 and R3 to static
 * JSON fragments, content-addressed by hash and served by
 * `src/app/fragments/readings/[paper]/[section]/[hash]/route.ts`. Named as a separate,
 * not-yet-built piece in measure-reading-face.ts's own header comment; this module is that piece.
 *
 * Content-addressed and immutable: the hash is a pure function of the fragment's own identity
 * and bytes, so a rebuild never leaves a page pointing at a changed or missing fragment (this
 * bead's own requirement) -- two calls with the same inputs always produce the same hash, and
 * the manifest never lets one hash silently point at two different bodies.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type FragmentReading = 2 | 3;

export type ReadingFragment = Readonly<{
  paper: string;
  section: string;
  unitId: string;
  reading: FragmentReading;
  html: string;
}>;

export type StoredFragment = Readonly<{
  hash: string;
  unitId: string;
  reading: FragmentReading;
  html: string;
}>;

export type FragmentReference = Readonly<{ paper: string; section: string; hash: string }>;

/** paper -> section -> hash -> stored fragment. */
export type FragmentManifest = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, StoredFragment>>>>>
>;

/**
 * A short, content-addressed identifier: the first 16 hex characters of the SHA-256 of the
 * fragment's own identity and text. Paper, section, unit id, and reading level are all part of
 * the digest, so two units with identical R2 text but different ids never collide under the same
 * hash, and identical text at the same unit is always discovered under one hash rather than
 * written twice.
 */
export function fragmentHash(fragment: ReadingFragment): string {
  const hash = createHash("sha256");
  hash.update(fragment.paper).update("\0");
  hash.update(fragment.section).update("\0");
  hash.update(fragment.unitId).update("\0");
  hash.update(String(fragment.reading)).update("\0");
  hash.update(fragment.html);
  return hash.digest("hex").slice(0, 16);
}

/**
 * Builds an immutable manifest from a list of fragments, deduplicating identical fragments under
 * one hash. Throws on a hash collision between two DIFFERENT fragment bodies -- content
 * addressing guarantees equal content for equal hashes, so a collision here means a bug upstream
 * (or, vanishingly unlikely, a real SHA-256 collision), never a legitimate duplicate to accept
 * silently.
 */
export function buildFragmentManifest(fragments: readonly ReadingFragment[]): FragmentManifest {
  const manifest: Record<string, Record<string, Record<string, StoredFragment>>> = {};
  for (const fragment of fragments) {
    const hash = fragmentHash(fragment);
    let bySection = manifest[fragment.paper];
    if (!bySection) {
      bySection = {};
      manifest[fragment.paper] = bySection;
    }
    let byHash = bySection[fragment.section];
    if (!byHash) {
      byHash = {};
      bySection[fragment.section] = byHash;
    }
    const existing = byHash[hash];
    if (existing && existing.html !== fragment.html) {
      throw new Error(
        `Fragment hash collision at ${fragment.paper}/${fragment.section}/${hash}: two different fragment bodies hashed to the same value.`,
      );
    }
    byHash[hash] = Object.freeze({
      hash,
      unitId: fragment.unitId,
      reading: fragment.reading,
      html: fragment.html,
    });
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(manifest).map(([paper, sections]) => [
        paper,
        Object.freeze(
          Object.fromEntries(
            Object.entries(sections).map(([section, byHash]) => [
              section,
              Object.freeze({ ...byHash }),
            ]),
          ),
        ),
      ]),
    ),
  );
}

export function lookupFragment(
  manifest: FragmentManifest,
  paper: string,
  section: string,
  hash: string,
): StoredFragment | undefined {
  return manifest[paper]?.[section]?.[hash];
}

export function listFragmentReferences(manifest: FragmentManifest): readonly FragmentReference[] {
  const refs: FragmentReference[] = [];
  for (const [paper, sections] of Object.entries(manifest)) {
    for (const [section, byHash] of Object.entries(sections)) {
      for (const hash of Object.keys(byHash)) refs.push({ paper, section, hash });
    }
  }
  return refs;
}

/**
 * Every hash the compiled HTML actually references, checked against the manifest -- this bead's
 * "a build check verifies that every referenced fragment exists" requirement. Returns the
 * missing ones, if any, so the caller can fail the build with a specific, actionable list rather
 * than a generic "some fragment is missing" message.
 */
export function verifyFragmentReferences(
  manifest: FragmentManifest,
  referenced: readonly FragmentReference[],
): readonly FragmentReference[] {
  return referenced.filter(
    (ref) => lookupFragment(manifest, ref.paper, ref.section, ref.hash) === undefined,
  );
}

/** One file per (paper, section), holding that section's hash -> fragment map. Kept out of git
 * like every other build artifact under src/generated/ (see .gitignore); the manifest is
 * regenerated by the (not yet built) compiler's fragment-writing step, never hand-edited. */
export async function writeFragmentManifest(
  manifest: FragmentManifest,
  rootDir: string,
): Promise<void> {
  for (const [paper, sections] of Object.entries(manifest)) {
    const paperDir = path.join(rootDir, paper);
    await mkdir(paperDir, { recursive: true });
    for (const [section, byHash] of Object.entries(sections)) {
      await writeFile(
        path.join(paperDir, `${section}.json`),
        `${JSON.stringify(byHash, null, 2)}\n`,
        "utf8",
      );
    }
  }
}

export async function readFragmentManifest(rootDir: string): Promise<FragmentManifest> {
  const manifest: Record<string, Record<string, Record<string, StoredFragment>>> = {};
  let papers: string[];
  try {
    papers = await readdir(rootDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Object.freeze({});
    throw error;
  }
  for (const paper of papers) {
    const paperDir = path.join(rootDir, paper);
    const files = await readdir(paperDir);
    const sections: Record<string, Record<string, StoredFragment>> = {};
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const section = file.slice(0, -".json".length);
      const raw = await readFile(path.join(paperDir, file), "utf8");
      sections[section] = JSON.parse(raw) as Record<string, StoredFragment>;
    }
    manifest[paper] = sections;
  }
  return Object.freeze(manifest);
}
