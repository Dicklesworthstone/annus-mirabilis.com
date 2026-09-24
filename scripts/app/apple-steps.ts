/**
 * The Apple gate's steps, in order. Kept apart from scripts/app/apple-quality.ts
 * so the quality-gate registry can list them without importing the gate itself,
 * which reaches the site's theme tokens and must not load in the node test lane.
 */
export const APPLE_STEPS = [
  { id: "apple-disk", title: "Apple: free disk at or above the toolchain decision's floor" },
  { id: "apple-toolchain", title: "Apple: installed tools match the apple-toolchain decision" },
  {
    id: "apple-project-fresh",
    title: "Apple: the committed Xcode project is what XcodeGen generates",
  },
  { id: "apple-plist-lint", title: "Apple: Info.plist, privacy manifest and entitlements lint" },
  { id: "apple-swiftlint", title: "Apple: SwiftLint, strict" },
  { id: "apple-swift-format", title: "Apple: swift-format lint, strict" },
  { id: "apple-generated-fresh", title: "Apple: icon and page mark match their generator" },
  { id: "apple-edition-fresh", title: "Apple: the exported edition still matches the build it came from" },
  { id: "apple-simulators", title: "Apple: the named simulators exist (created, never deleted)" },
  { id: "apple-build", title: "Apple: simulator build for testing" },
  { id: "apple-unit-tests", title: "Apple: unit tests (Swift Testing)" },
  { id: "apple-ui-tests", title: "Apple: UI tests (XCUITest)" },
] as const;

export type AppleStepId = (typeof APPLE_STEPS)[number]["id"];
