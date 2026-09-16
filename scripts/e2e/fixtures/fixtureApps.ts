/**
 * The one registry of interactive fixture applications (am-test-e2e-harness-bqmh
 * requirement 8). A bead that needs an interactive fixture instrument in a
 * real browser registers an entry here instead of adding a fixture build,
 * flag, route, or conditional import to the application. There is never a
 * second bundler or a second registry.
 *
 * The registry itself ships empty from this bead: `harness-selftest` (this
 * bead's own scripted self-test fixture, requirement 9) and the five
 * consumer registrations named in the bead text (`runtime`, `predict-mode`,
 * `interaction-primitives`, `2d-view-kit`, `controls-kit`) each land in the
 * same change as the fixture application they describe, from the bead that
 * owns it. Validating an empty list is correct, not a gap: this module's
 * job is the registry contract every one of those entries must satisfy.
 */

const ENTRY_ROOT = "src/testing/";
const OUT_DIR_ROOT = "artifacts/e2e-fixtures/";
const BEAD_ID_PATTERN = /^am-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The bundler's deterministic per-entry output file names (bundleFixtures.ts,
 * not yet built). Declared here so a `staticInputs.servedPath` can be
 * checked against them without importing the bundler, which would make this
 * pure registry module depend on a filesystem-writing one.
 */
export const FIXTURE_BUNDLE_OUTPUT_NAMES = ["bundle.js", "bundle.js.map"] as const;

export interface FixtureStaticInput {
  /** Repository-relative path to a committed or generated source file. */
  readonly from: string;
  /** Path relative to this application's `/apps/<id>/` root; may not escape it. */
  readonly servedPath: string;
}

export interface FixtureAppEntry {
  readonly id: string;
  /** A directory under `src/testing/` holding the fixture application's source. */
  readonly entry: string;
  /** `artifacts/e2e-fixtures/<id>/`, ignored by git. */
  readonly outDir: string;
  /** The registering bead id. */
  readonly owner: string;
  readonly staticInputs?: readonly FixtureStaticInput[];
}

export interface FixtureAppIssue {
  id: string | undefined;
  message: string;
}

function isRepositoryRelative(value: string): boolean {
  if (value.length === 0) return false;
  if (value.startsWith("/")) return false;
  if (value.startsWith("..")) return false;
  const segments = value.split("/");
  return !segments.includes("..");
}

function isEscapingRelativePath(value: string): boolean {
  if (value.length === 0) return true;
  if (value.startsWith("/")) return true;
  const segments = value.split("/");
  return segments.includes("..");
}

function validateStaticInputs(
  entryId: string,
  staticInputs: readonly FixtureStaticInput[] | undefined,
): FixtureAppIssue[] {
  if (!staticInputs || staticInputs.length === 0) return [];
  const issues: FixtureAppIssue[] = [];
  const servedPaths = new Set<string>();
  for (const input of staticInputs) {
    if (!isRepositoryRelative(input.from)) {
      issues.push({
        id: entryId,
        message: `entry "${entryId}" declares a staticInputs.from outside the repository: "${input.from}"`,
      });
    }
    if (isEscapingRelativePath(input.servedPath)) {
      issues.push({
        id: entryId,
        message: `entry "${entryId}" declares a staticInputs.servedPath that is absolute or escapes its application root: "${input.servedPath}"`,
      });
    }
    if ((FIXTURE_BUNDLE_OUTPUT_NAMES as readonly string[]).includes(input.servedPath)) {
      issues.push({
        id: entryId,
        message: `entry "${entryId}" declares a staticInputs.servedPath that collides with a bundle output name: "${input.servedPath}"`,
      });
    }
    if (servedPaths.has(input.servedPath)) {
      issues.push({
        id: entryId,
        message: `entry "${entryId}" declares staticInputs.servedPath "${input.servedPath}" more than once`,
      });
    }
    servedPaths.add(input.servedPath);
  }
  return issues;
}

/**
 * Validates the full registry: structural rules (requirement 8) plus, for
 * each entry, its `staticInputs`. `isKnownBeadId` lets a caller check
 * membership against real bead ids (via `br show`, in the CLI) without this
 * pure module depending on the tracker; with none supplied, only the id's
 * grammar is checked.
 */
export function validateFixtureAppRegistry(
  entries: readonly FixtureAppEntry[],
  isKnownBeadId?: (beadId: string) => boolean,
): FixtureAppIssue[] {
  const issues: FixtureAppIssue[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      issues.push({ id: entry.id, message: `duplicate fixture application id "${entry.id}"` });
    }
    seenIds.add(entry.id);

    if (!entry.entry.startsWith(ENTRY_ROOT)) {
      issues.push({
        id: entry.id,
        message: `entry "${entry.id}" has an entry directory outside ${ENTRY_ROOT}: "${entry.entry}"`,
      });
    }
    if (!entry.outDir.startsWith(OUT_DIR_ROOT)) {
      issues.push({
        id: entry.id,
        message: `entry "${entry.id}" has an outDir outside ${OUT_DIR_ROOT}: "${entry.outDir}"`,
      });
    }
    if (!entry.owner || entry.owner.trim().length === 0) {
      issues.push({ id: entry.id, message: `entry "${entry.id}" has no owner` });
    } else if (!BEAD_ID_PATTERN.test(entry.owner)) {
      issues.push({
        id: entry.id,
        message: `entry "${entry.id}" has an owner that is not a well-formed bead id: "${entry.owner}"`,
      });
    } else if (isKnownBeadId && !isKnownBeadId(entry.owner)) {
      issues.push({
        id: entry.id,
        message: `entry "${entry.id}" has an owner that is not a known bead id: "${entry.owner}"`,
      });
    }

    issues.push(...validateStaticInputs(entry.id, entry.staticInputs));
  }

  return issues;
}

export const VIEW_KIT_FIXTURE_ENTRY: FixtureAppEntry = Object.freeze({
  id: "view-kit",
  entry: "src/testing/e2e/fixture-apps/view-kit/",
  outDir: "artifacts/e2e-fixtures/view-kit/",
  owner: "am-inst-2d-view-kit-u75r",
});

/**
 * The registry of interactive fixture applications.
 */
export const FIXTURE_APP_REGISTRY: readonly FixtureAppEntry[] = Object.freeze([
  VIEW_KIT_FIXTURE_ENTRY,
]);
