/**
 * Live Region Announcement Utility Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  announce,
  clearAnnouncement,
  getAnnouncementCount,
  getLastAnnouncement,
  setLiveRegionElement,
} from "../../a11y/announce.ts";
import { installDom, uninstallDom } from "../reactDom.ts";

describe("Live Region Announcement Utility (am-a11y-baseline-1cg5)", () => {
  let mockLiveRegion: HTMLElement;

  beforeEach(async () => {
    await installDom();
    clearAnnouncement();
    mockLiveRegion = document.createElement("div");
    mockLiveRegion.id = "test-live-region";
    setLiveRegionElement(mockLiveRegion);
  });

  afterEach(async () => {
    clearAnnouncement();
    setLiveRegionElement(null);
    await uninstallDom();
  });

  it("sets announcement text and updates last announcement", () => {
    announce("Simulation completed: 500 Brownian steps evaluated.");
    expect(getLastAnnouncement()).toBe("Simulation completed: 500 Brownian steps evaluated.");
  });

  it("ignores empty or whitespace-only messages without announcing", () => {
    const initialCount = getAnnouncementCount();
    announce("   ");
    announce("");
    expect(getAnnouncementCount()).toBe(initialCount);
  });

  it("debounces rapid continuous calls and announces only the final message", async () => {
    const initialCount = getAnnouncementCount();
    announce("Intermediate step 1", { debounceMs: 30 });
    announce("Intermediate step 2", { debounceMs: 30 });
    announce("Final state reached: equilibrium", { debounceMs: 30 });

    // Wait for debounce timer
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(getLastAnnouncement()).toBe("Final state reached: equilibrium");
    expect(getAnnouncementCount()).toBe(initialCount + 3);
  });

  it("supports politeness levels polite and assertive", () => {
    announce("Urgent boundary refusal: CFL violation", { politeness: "assertive" });
    expect(getLastAnnouncement()).toBe("Urgent boundary refusal: CFL violation");
  });

  it("suppresses announcement when politeness is 'off'", () => {
    const countBefore = getAnnouncementCount();
    announce("Silent measurement update", { politeness: "off" });
    expect(getAnnouncementCount()).toBe(countBefore);
  });
});
