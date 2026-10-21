#!/usr/bin/env bun
/**
 * HOW FAR BEHIND origin/main THE LIVE SITE IS (am-rc1020-lag-gate-ggcj).
 *
 *   bun scripts/release-freshness.ts                 # read the live site and judge
 *   bun scripts/release-freshness.ts --json          # the same, as data
 *   bun scripts/release-freshness.ts --base-url <u>  # judge another deployment
 *
 * WHY IT EXISTS. The deployment gap found by the reality check of 2026-10-20 went unnoticed for 21
 * days and 1,442 commits, and the reason was structural rather than anyone's inattention: of the
 * registry's steps, NOT ONE measured deployment lag. Every gate asked whether the code was good.
 * None asked whether a reader could see it. A green chain over an undeployed repository is exactly
 * the shape AGENTS.md warns about in "A Tool's Exit Code Is Not Evidence Until You Know What It
 * Examined" -- the checks were honest and they were all about something else.
 *
 * WHAT IT READS. `/release.json`, written into the build by scripts/build/releaseIdentityForBuild.ts
 * and therefore served by whatever deployment an alias points at. Its `commit` is the only honest
 * answer to "what is live": the reality check had to bisect by route because the live build predates
 * that file, which is itself the finding. A gate does not bisect.
 *
 * UNREACHABLE IS A REFUSAL, NOT A ZERO. If `/release.json` 404s, or is not JSON, or names no commit,
 * this examined NOTHING and says so through the census line, exiting non-zero. Reading "cannot tell"
 * as "not behind" would make the gate green in precisely the state it was built to catch, since the
 * live build today is old enough to predate the file it would be judged by.
 *
 * THE PURE HALF IS SEPARATE AND EXPORTED. `freshnessVerdict` takes the numbers and returns the
 * verdict; the CLI does the fetching and the `git rev-list`. That is what lets the planted negatives
 * run in the bun unit lane with no network and no subprocess -- AGENTS.md, "A Gate's Own Test Must
 * Not Live Only In The Lane That Gate Controls" -- and bun's runner cannot spawn git here anyway.
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { reportPopulation } from "./gate-census/population.ts";

/** The project's honest identifier for any request it makes (AGENTS.md, "Web Requests"). */
export const USER_AGENT =
  "annus-mirabilis.com-agent (+https://github.com/Dicklesworthstone/annus-mirabilis.com)";

export const DEFAULT_BASE_URL = "https://annus-mirabilis.com";

/**
 * How many commits live may trail origin/main before this step is red.
 *
 * 200, and the number is chosen from the failure rather than from taste. The gap this gate exists
 * for reached 1,442 commits over 21 days, about 69 commits a day, so 200 fires on the third day and
 * would have raised this one eighteen days before anybody noticed. It is deliberately not tight:
 * a threshold that reddens on an ordinary afternoon's work trains people to ignore it, and the
 * defect being prevented is measured in weeks.
 *
 * Lower it when deploys are routine. Never raise it to make a red run pass -- AGENTS.md, "a
 * baseline that only ever rises is a budget".
 */
export const LAG_THRESHOLD_COMMITS = 200;

export type FreshnessInput = Readonly<{
  /** The commit live reports, or undefined when `/release.json` could not be read. */
  liveCommit: string | undefined;
  /** `git rev-list --count <live>..origin/main`, or undefined when it could not be computed. */
  commitsBehind: number | undefined;
  /** Who wrote the live identity: a promotion, or a bare build that was deployed some other way. */
  writtenBy?: string | undefined;
  /** The live build's timestamp, for the human half of the report. */
  builtAt?: string | undefined;
  threshold?: number;
  /** For the age line; injected so the verdict is a pure function of its input. */
  now?: Date;
}>;

export type FreshnessVerdict = Readonly<{
  /** How many live identities this run managed to read: 1 or 0. The census population. */
  examined: number;
  ok: boolean;
  /** Why it refused, or why it passed, in one line a reader can act on. */
  message: string;
  commitsBehind: number | undefined;
  ageDays: number | undefined;
}>;

const SHA = /^[0-9a-f]{7,40}$/i;

/**
 * Judge a live identity. Pure: no network, no git, no clock unless one is handed in.
 *
 * The three refusals are separate on purpose. "Could not read it" and "read it and we are behind"
 * are different facts with different repairs, and collapsing them into one boolean is how a gate
 * comes to report a network failure as a healthy deployment.
 */
export function freshnessVerdict(input: FreshnessInput): FreshnessVerdict {
  const threshold = input.threshold ?? LAG_THRESHOLD_COMMITS;

  if (input.liveCommit === undefined || !SHA.test(input.liveCommit)) {
    return {
      examined: 0,
      ok: false,
      message:
        input.liveCommit === undefined
          ? "could not read a commit from the live /release.json, so what is deployed is unknown. That is a refusal and not a clean run: the gap this step exists for is exactly the state in which the live build predates the file naming its own commit."
          : `the live /release.json names ${JSON.stringify(input.liveCommit)}, which is not a commit sha.`,
      commitsBehind: undefined,
      ageDays: undefined,
    };
  }

  if (input.commitsBehind === undefined || !Number.isInteger(input.commitsBehind)) {
    return {
      examined: 0,
      ok: false,
      message: `the live commit ${input.liveCommit} could not be counted against origin/main. A commit this repository does not have is itself a finding: fetch origin, and if it is still unknown the deployment was built from something that is on no branch.`,
      commitsBehind: undefined,
      ageDays: undefined,
    };
  }

  const ageDays =
    input.builtAt === undefined || Number.isNaN(Date.parse(input.builtAt))
      ? undefined
      : ((input.now ?? new Date()).getTime() - Date.parse(input.builtAt)) / 86_400_000;
  const age = ageDays === undefined ? "" : `, built ${ageDays.toFixed(1)} day(s) ago`;
  const writer = input.writtenBy === undefined ? "" : `, written by ${input.writtenBy}`;
  const behind = input.commitsBehind;

  if (behind > threshold) {
    return {
      examined: 1,
      ok: false,
      message: `live is ${behind} commits behind origin/main (threshold ${threshold})${age}${writer}. Readers are not seeing ${behind} commits of finished work.`,
      commitsBehind: behind,
      ageDays,
    };
  }
  return {
    examined: 1,
    ok: true,
    message: `live is ${behind} commits behind origin/main, within the threshold of ${threshold}${age}${writer}.`,
    commitsBehind: behind,
    ageDays,
  };
}

/** What a live `/release.json` yielded. Every field optional: unreadable is a state, not a throw. */
export type LiveIdentity = Readonly<{
  commit?: string | undefined;
  writtenBy?: string | undefined;
  builtAt?: string | undefined;
  /** Why it could not be read, when it could not. */
  note?: string | undefined;
}>;

/** Read the live identity. Returns undefined fields rather than throwing, so the verdict judges. */
export async function readLiveIdentity(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<LiveIdentity> {
  const url = `${baseUrl.replace(/\/$/, "")}/release.json`;
  try {
    const res = await fetchFn(url, {
      method: "GET",
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status !== 200) return { note: `${url} returned HTTP ${res.status}` };
    const body = (await res.json()) as Record<string, unknown>;
    return {
      commit: typeof body.commit === "string" ? body.commit : undefined,
      writtenBy: typeof body.writtenBy === "string" ? body.writtenBy : undefined,
      builtAt: typeof body.builtAt === "string" ? body.builtAt : undefined,
      note: typeof body.commit === "string" ? undefined : `${url} names no commit`,
    };
  } catch (error) {
    return { note: `${url} could not be fetched: ${(error as Error).message}` };
  }
}

/** `git rev-list --count <live>..origin/main`, or undefined when the commit is unknown here. */
export function commitsBehindOriginMain(liveCommit: string): number | undefined {
  try {
    const out = execFileSync("git", ["rev-list", "--count", `${liveCommit}..origin/main`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const n = Number(out);
    return Number.isInteger(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const at = argv.indexOf("--base-url");
  const baseUrl = at === -1 ? DEFAULT_BASE_URL : (argv[at + 1] ?? DEFAULT_BASE_URL);
  const live = await readLiveIdentity(baseUrl);
  const verdict = freshnessVerdict({
    liveCommit: live.commit,
    commitsBehind: live.commit === undefined ? undefined : commitsBehindOriginMain(live.commit),
    writtenBy: live.writtenBy,
    builtAt: live.builtAt,
  });

  const asJson = argv.includes("--json");
  if (asJson) {
    console.log(JSON.stringify({ baseUrl, ...live, ...verdict }, null, 2));
  } else {
    if (live.note !== undefined) console.error(`[release-freshness] ${live.note}`);
    console.log(`[release-freshness] ${baseUrl}: ${verdict.message}`);
  }
  // ONE census call, and the stream is the only thing that varies: under --json stdout is DATA, so
  // the line goes to stderr, which `parsePopulationLines` reads because it reads combined output.
  // Two calls would also give the plant two anchors, and a plant needs exactly one -- which is how
  // plantAnchors.test.ts caught the first draft of this file.
  reportPopulation(
    {
      gate: "release-freshness",
      examined: verdict.examined,
      noun: "live release identities",
      minimum: 1,
    },
    asJson ? "stderr" : "stdout",
  );
  if (!verdict.ok) console.error("[release-freshness] REFUSED");
  return verdict.ok ? 0 : 1;
}

// Only when run directly, so the pure half can be imported by a test without the CLI firing.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
