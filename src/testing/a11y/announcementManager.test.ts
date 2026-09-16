import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getLastAnnouncement } from "../../a11y/announce.ts";
import { AnnouncementManager } from "../../a11y/descriptions/announcementManager.ts";

describe("announcementManager: Accessible Graph Announcement Manager (am-a11y-graph-descriptions-vxe1)", () => {
  it("emits commit announcements with 1-second spacing and replaces queued summaries", async () => {
    let simulatedTime = 1000;
    const announcements: string[] = [];

    const manager = new AnnouncementManager({
      clock: () => simulatedTime,
      onAnnounce: (msg) => announcements.push(msg),
      throttleIntervalMs: 1000,
    });

    // Action 1: First commit announcement at t = 1000
    manager.emitCommitAnnouncement("Action 1: Boost set to 0.6c");
    assert.deepEqual(announcements, ["Action 1: Boost set to 0.6c"]);

    // Action 2: Rapid commit at t = 1200 (< 1000ms elapsed) -> queued
    simulatedTime = 1200;
    manager.emitCommitAnnouncement("Action 2: Boost set to 0.7c");
    assert.deepEqual(announcements, ["Action 1: Boost set to 0.6c"]);

    // Action 3: Another rapid commit at t = 1500 -> replaces Action 2 in the queue
    simulatedTime = 1500;
    manager.emitCommitAnnouncement("Action 3: Boost set to 0.8c");
    assert.deepEqual(announcements, ["Action 1: Boost set to 0.6c"]);

    // Advance clock past the 1-second threshold and fire timers
    simulatedTime = 2100;
    // Let setTimeout callback process
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        // The queued action emitted must be the newest (Action 3), not Action 2
        assert.deepEqual(announcements, [
          "Action 1: Boost set to 0.6c",
          "Action 3: Boost set to 0.8c",
        ]);
        manager.dispose();
        resolve();
      }, 1100);
    });
  });

  it("suppresses automatic announcements during running animation", () => {
    let simulatedTime = 1000;
    const announcements: string[] = [];

    const manager = new AnnouncementManager({
      clock: () => simulatedTime,
      onAnnounce: (msg) => announcements.push(msg),
    });

    // Start running continuous simulation
    manager.setAnimating(true);
    assert.equal(manager.getAnimating(), true);

    // Continuous 60 Hz frame ticks occur
    for (let tick = 0; tick < 60; tick++) {
      simulatedTime += 16;
      manager.emitCommitAnnouncement(`Frame update at t=${simulatedTime}`);
    }

    // Must be ZERO automatic announcements
    assert.deepEqual(announcements, []);

    manager.dispose();
  });

  it("Describe now bypasses animation suppression and rate limits immediately", () => {
    let simulatedTime = 1000;
    const announcements: string[] = [];

    const manager = new AnnouncementManager({
      clock: () => simulatedTime,
      onAnnounce: (msg) => announcements.push(msg),
    });

    // Animation is running
    manager.setAnimating(true);

    // Explicit user readout request
    manager.describeNow("On-demand summary: Mean squared displacement is 0.79 μm².");
    assert.deepEqual(announcements, ["On-demand summary: Mean squared displacement is 0.79 μm²."]);

    // Another immediate request
    simulatedTime = 1050; // Only 50ms later
    manager.describeNow("Second on-demand request.");
    assert.deepEqual(announcements, [
      "On-demand summary: Mean squared displacement is 0.79 μm².",
      "Second on-demand request.",
    ]);

    manager.dispose();
  });

  it("presentation changes produce zero automatic announcements", () => {
    const announcements: string[] = [];

    const manager = new AnnouncementManager({
      onAnnounce: (msg) => announcements.push(msg),
    });

    manager.handlePresentationChange();
    assert.deepEqual(announcements, []);

    manager.dispose();
  });

  it("default dispatch uses the shared announce module, not a private live-region copy", () => {
    const manager = new AnnouncementManager({ clock: () => 1000 });
    manager.describeNow("shared live region");
    assert.equal(getLastAnnouncement(), "shared live region");
    manager.dispose();
  });

  it("announcementManager.ts does not contain a private defaultAnnounce copy", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../a11y/descriptions/announcementManager.ts",
      ),
      "utf8",
    );
    assert.equal(source.includes('from "../announce.ts"'), true);
    assert.equal(source.includes("function defaultAnnounce"), false);
  });
});
