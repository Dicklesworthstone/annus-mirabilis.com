/**
 * THE DEPLOYMENT-LAG GATE, BOTH DIRECTIONS (am-rc1020-lag-gate-ggcj, acceptance item 4).
 *
 * The gap this gate exists for went unnoticed for 21 days and 1,442 commits because no registered
 * step measured lag. A step that cannot go red would reproduce that exactly, so the cases below are
 * planted in both directions: a fixture identity naming an old commit must REFUSE, and one naming
 * the tip must PASS.
 *
 * NO NETWORK AND NO GIT HERE. `freshnessVerdict` is pure and the fetch and the `git rev-list` are
 * the CLI's, which is what lets this run in the bun unit lane -- the lane that is not the one the
 * gate controls -- and bun's runner cannot spawn git on this host in any case. What this file
 * therefore does NOT prove is that the CLI's fetch and git call pass the right values in; that is
 * one small seam, and `readLiveIdentity` is exercised against a stub fetch below so the seam is not
 * entirely unwatched.
 */

import { describe, expect, test } from "bun:test";
import {
  freshnessVerdict,
  LAG_THRESHOLD_COMMITS,
  readLiveIdentity,
  USER_AGENT,
} from "./release-freshness.ts";

const TIP = "ca32ae6ff7e083c78cc43b139f623602987a942e";
const OLD = "397757e09336de1340031210a30585e8de2ff690";
const NOW = new Date("2026-10-21T20:00:00Z");

describe("release freshness refuses when live falls behind", () => {
  test("the threshold is declared with a reason, not inferred here", () => {
    console.log(`[census] release-freshness: threshold ${LAG_THRESHOLD_COMMITS} commits`);
    // Pinned loosely on purpose: the test asserts the threshold EXISTS and is a usable number, not
    // its exact value, because the value is the step's declaration and may be lowered as deploys
    // become routine. A test that froze it would make lowering a debt into a red build.
    expect(Number.isInteger(LAG_THRESHOLD_COMMITS)).toBe(true);
    expect(LAG_THRESHOLD_COMMITS).toBeGreaterThan(0);
  });

  test("PLANTED: an old live commit refuses, and names what readers are missing", () => {
    const v = freshnessVerdict({
      liveCommit: OLD,
      commitsBehind: 1442,
      builtAt: "2026-09-30T00:00:00Z",
      writtenBy: "deploy",
      now: NOW,
    });
    expect(v.ok).toBe(false);
    expect(v.examined).toBe(1);
    expect(v.commitsBehind).toBe(1442);
    expect(v.message).toContain("1442 commits behind");
    // The figure that made this worth building: 21 days.
    expect(v.ageDays ?? 0).toBeGreaterThan(20);
  });

  test("CONTROL: the tip passes, so the red above is the lag and not the machinery", () => {
    const v = freshnessVerdict({ liveCommit: TIP, commitsBehind: 0, now: NOW });
    expect(v.ok).toBe(true);
    expect(v.examined).toBe(1);
    expect(v.message).toContain("0 commits behind");
  });

  test("the boundary is the threshold itself, and it is not off by one", () => {
    expect(freshnessVerdict({ liveCommit: TIP, commitsBehind: LAG_THRESHOLD_COMMITS }).ok).toBe(
      true,
    );
    expect(freshnessVerdict({ liveCommit: TIP, commitsBehind: LAG_THRESHOLD_COMMITS + 1 }).ok).toBe(
      false,
    );
  });

  test("PLANTED: unreachable is a REFUSAL with an examined population of 0, never a pass", () => {
    /*
     * The case that matters most, because it is the state the live site is in TODAY: the deployed
     * build predates /release.json, so the file 404s. Reading "cannot tell" as "not behind" would
     * make this gate green in exactly the situation it was built to catch.
     */
    const v = freshnessVerdict({ liveCommit: undefined, commitsBehind: undefined });
    expect(v.ok).toBe(false);
    expect(v.examined).toBe(0);
    expect(v.message).toContain("unknown");
  });

  test("a commit this repository does not have is a refusal, not a zero", () => {
    const v = freshnessVerdict({ liveCommit: OLD, commitsBehind: undefined });
    expect(v.ok).toBe(false);
    expect(v.examined).toBe(0);
    expect(v.commitsBehind).toBeUndefined();
    expect(v.message).toContain("on no branch");
  });

  test("a live identity whose commit is not a sha refuses rather than being counted", () => {
    const v = freshnessVerdict({ liveCommit: "unknown", commitsBehind: 0 });
    expect(v.ok).toBe(false);
    expect(v.examined).toBe(0);
    expect(v.message).toContain("not a commit sha");
  });

  test("readLiveIdentity names this project and reads the fields it needs", async () => {
    let seenUrl = "";
    let seenAgent: string | undefined;
    const stub = (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      seenAgent = (init?.headers as Record<string, string> | undefined)?.["User-Agent"];
      return new Response(
        JSON.stringify({
          schema: "x",
          commit: TIP,
          writtenBy: "deploy",
          builtAt: "2026-10-21T00:00:00Z",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const live = await readLiveIdentity("https://annus-mirabilis.com/", stub);
    expect(seenUrl).toBe("https://annus-mirabilis.com/release.json");
    // AGENTS.md "Web Requests": identify honestly, and never borrow another product's agent.
    expect(seenAgent).toBe(USER_AGENT);
    expect(seenAgent).toContain("annus-mirabilis.com-agent");
    expect(live.commit).toBe(TIP);
    expect(live.writtenBy).toBe("deploy");
  });

  test("a 404 yields no commit and a note, which the verdict turns into a refusal", async () => {
    const stub = (async () =>
      new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const live = await readLiveIdentity("https://annus-mirabilis.com", stub);
    expect(live.commit).toBeUndefined();
    expect(live.note).toContain("404");
    expect(freshnessVerdict({ liveCommit: live.commit, commitsBehind: undefined }).ok).toBe(false);
  });

  test("a 200 that is not JSON is a note, not a throw", async () => {
    const stub = (async () =>
      new Response("<html>nope</html>", { status: 200 })) as unknown as typeof fetch;
    const live = await readLiveIdentity("https://annus-mirabilis.com", stub);
    expect(live.commit).toBeUndefined();
    expect(live.note).toContain("could not be fetched");
  });
});
