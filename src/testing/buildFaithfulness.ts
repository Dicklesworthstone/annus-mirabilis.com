/**
 * Whether a run's numbers may be CITED, which is a different question from whether the run was
 * worth doing.
 *
 * `checkOutFreshness` answers "has anything been COMMITTED since out/ was built". That is the
 * right question for staleness and it is blind to the case below, by construction, because the
 * thing that corrupts a build is a SAVE and a save is not a commit.
 *
 * MEASURED, 2026-09-22, and this module exists because of it. A build ran 06:52:12-06:54:34.
 * A peer saved two static sources at 06:53:33, 81 seconds in, and committed neither. Zero commits
 * landed in the window, so `checkOutFreshness` returned `fresh: true` - correctly. But out/'s
 * compiled CSS lacked `:has(>table.data-table)`, a rule that was still in HEAD and was being
 * deleted in the peer's uncommitted diff, so the build had read the post-save file. out/ therefore
 * matched no commit at all: part HEAD, part someone's work in progress. A gate measured it and
 * produced numbers that looked exactly like a measurement of HEAD.
 *
 * The consuming gate already reported `dirtyStaticSources`, and it said:
 *
 *     out/ predates N uncommitted static source(s); this measures the BUILT artefact,
 *     not the working tree
 *
 * That sentence asserts a temporal ordering nobody checked, and it is the REASSURING reading of
 * the evidence. On the run above it was false. This module checks the claim instead of making it.
 *
 * THE TEST, which needs no build duration and no trace parsing. Compare each dirty source's mtime
 * against out/'s own mtime:
 *
 *   mtime AFTER out/   the save landed once the build was over. out/ genuinely predates it, the
 *                      original sentence is true, and the artefact is faithful to its commit.
 *   mtime AT OR BEFORE the build was still running, or had not started, when the file was saved.
 *                      Either way the build may have read uncommitted bytes and out/ is not
 *                      faithful to any commit.
 *
 * The second bucket deliberately includes a file saved BEFORE the build started. That build read
 * the working tree, so out/ reflects uncommitted work in full rather than in part. It is a cleaner
 * artefact than a torn one and it is just as uncitable, because the baseline it would feed is keyed
 * to a build id that no commit reproduces.
 *
 * WHAT THIS DOES NOT DO. It does not stop anyone measuring a dirty tree, which is often exactly
 * what you want - the run that produced the measurement above was a deliberate preview of a peer's
 * uncommitted revert, and it answered the question it was asked. It marks the result uncitable.
 * Measure freely; never cite a number whose build matches no commit.
 *
 * It also cannot see a save that was COMMITTED between the build and the gate run: that file is no
 * longer dirty, so it is not in the input at all, and `checkOutFreshness`'s commit range is what
 * catches it. The two checks cover different halves and neither subsumes the other.
 */

export interface DirtyClassification {
  /** False when any dirty source may have been read by the build. */
  readonly citable: boolean;
  /**
   * Dirty sources whose mtime is at or before out/'s, so the build may have read uncommitted
   * bytes. out/ is not faithful to any commit and its numbers must not feed a baseline.
   */
  readonly buildMayHaveRead: readonly string[];
  /**
   * Dirty sources saved after the build finished. out/ predates them, so the artefact is faithful
   * to its commit and the dirtiness is a fact about someone's in-flight work, not about out/.
   */
  readonly writtenAfterBuild: readonly string[];
}

/**
 * Splits the dirty set by whether the build could have read each file.
 *
 * `mtimeOf` is injected rather than calling `statSync` directly so the proof of this function can
 * run in the bun lane while its only consumer runs in the node lane. A gate whose test lives only
 * in the lane the gate controls disappears at the moment the gate fails open.
 *
 * A file whose mtime cannot be read is placed in `buildMayHaveRead`. That is the conservative
 * direction on purpose: the failure mode being guarded against is a number that is cited when it
 * should not be, so an unknown resolves against citing.
 */
export function classifyDirtySources(
  dirtyStaticSources: readonly string[],
  outMtimeMs: number,
  mtimeOf: (path: string) => number | undefined,
): DirtyClassification {
  const buildMayHaveRead: string[] = [];
  const writtenAfterBuild: string[] = [];
  for (const path of dirtyStaticSources) {
    const mtime = mtimeOf(path);
    if (mtime === undefined || mtime <= outMtimeMs) buildMayHaveRead.push(path);
    else writtenAfterBuild.push(path);
  }
  return {
    citable: buildMayHaveRead.length === 0,
    buildMayHaveRead: buildMayHaveRead.sort(),
    writtenAfterBuild: writtenAfterBuild.sort(),
  };
}

/**
 * The refusal text for an uncitable build. Names every file rather than counting them, because the
 * run that motivated this module printed a count and the author had to go and run `git status`
 * separately to learn that one of the two was globals.css, which every route loads.
 */
export function uncitableReason(c: DirtyClassification, buildId: string): string {
  const after =
    c.writtenAfterBuild.length > 0
      ? `\n\nSaved AFTER the build, so out/ does predate these and they are not the problem:\n  ${c.writtenAfterBuild.join("\n  ")}`
      : "";
  return (
    `THIS RUN IS NOT CITABLE. Build ${buildId} may have read uncommitted bytes, so out/ matches ` +
    `no commit and its numbers must not be written into a baseline or a measuredOn field.\n\n` +
    `Saved at or before out/'s own mtime, so the build may have read them:\n  ${c.buildMayHaveRead.join("\n  ")}` +
    after +
    `\n\nThe measurement below is still real and still worth reading - it describes the tree that ` +
    `was built, which may be exactly what you wanted. It just is not a measurement of any commit. ` +
    `To get a citable number, commit or wait for the files above to settle, rebuild, and re-run.`
  );
}
