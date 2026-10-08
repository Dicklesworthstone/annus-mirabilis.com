/**
 * THE CI'S CHECKS FOR THIS REPOSITORY, MIRRORED ONCE (am-7bkr).
 *
 * dsr is the CI. `docs/DECISIONS.md` D-2026-09-22-dsr-is-the-ci-never-github-actions records the
 * owner's standing rule verbatim: "we don't use gh actions for CI *EVER*, we ONLY use /dsr". Five
 * workflow files are tracked under `.github/workflows/` and none of them executes.
 *
 * dsr's checks come from `~/.config/dsr/repos.yaml`, `tools.annus-mirabilis.checks`:
 *
 *     bun run typecheck    bun run test    bun run test:node    bun run gates
 *
 * WHY THIS IS MIRRORED AT ALL. That file is outside the repository and is not on every machine, so
 * a test cannot read it. The mirror is therefore asserted against `package.json` by its consumers:
 * every entry must resolve to a script that exists, so a drifted mirror fails loudly instead of
 * quietly narrowing the population a check quantifies over.
 *
 * WHY IT IS MIRRORED ONCE. It was mirrored twice, identically and with the same reasoning written
 * out both times, at `src/testing/ciGateWiring.test.ts:48` and
 * `scripts/perf/gateRegistration.test.ts:132`. Repairing the third place that needed it
 * (`scripts/quality-gates/subprocessE2eSplit.test.ts`, which asserted the text of a workflow that
 * never runs) would have made three copies of one external fact. A hand-copied mirror of something
 * outside the repository is the most drift-prone thing there is, and three of them cannot be kept
 * in step by anything.
 *
 * `bun run gates` itself runs two families, `fast` and `browser`; the registry's `perf` family is
 * reached by no dsr check, which the registry header records and am-7bkr owns.
 */
export const DSR_CHECKS = ["typecheck", "test", "test:node", "gates"] as const;

export type DsrCheck = (typeof DSR_CHECKS)[number];

/** True when `name` is one of the scripts dsr actually runs. Takes a string, so a caller can ask. */
export function isDsrCheck(name: string): name is DsrCheck {
  return (DSR_CHECKS as readonly string[]).includes(name);
}
