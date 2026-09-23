# The Annus Mirabilis iPhone and iPad app

A native SwiftUI shell around the website's own static edition, bundled in the
app and served to a `WKWebView` from the local origin `am-edition://edition/`.
Every page, reading, equation and instrument is the website's code. Swift serves
files and handles links, and never computes or writes what a reader reads. The
plan is `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md`; the decisions it
left open are in `docs/DECISIONS.md` (`D-2026-09-23-app-identity`,
`-apple-toolchain`, `-app-edition-hosting`).

## Commands

Run from the repository root. Each was run on 2026-09-23 with Xcode 26.1.1 and
the iOS 26.1 simulator.

```bash
# 1. Export the edition from the last web build in out/ (never builds it).
bun scripts/app/export-edition.ts

# 2. After editing ios/project.yml, regenerate the Xcode project and commit both.
(cd ios && xcodegen generate)

# 3. Build, or build and run the unit and UI tests, on a named simulator.
#    Xcode's output goes to ~/Library/Developer/Xcode/DerivedData/AnnusMirabilis-am,
#    never into this repository.
bun scripts/app/xcode.ts build
bun scripts/app/xcode.ts test
bun scripts/app/xcode.ts test --device "AM iPad"

# 4. Redraw the app icon and launch colour from the web theme after a token change.
bun scripts/app/generate-app-icon.ts

# 5. The TypeScript side: the export, the Xcode runner, the icon, and the identity check.
bun test scripts/app/
```

The build refuses without an exported edition, and refuses when `out/` has
changed since the export. It prints the command that fixes either.

To see the app, install the built product on a booted simulator:

```bash
APP=~/Library/Developer/Xcode/DerivedData/AnnusMirabilis-am/Build/Products/Debug-iphonesimulator/AnnusMirabilis.app
xcrun simctl install "AM iPhone 17" "$APP"
xcrun simctl launch "AM iPhone 17" com.annus-mirabilis.AnnusMirabilis
# DEBUG builds open any route: add  -AMOpenRoute /papers/brownian-motion/ -AMOpenAnchor s4
```

## Layout

| Path | Holds |
|---|---|
| `project.yml` | The XcodeGen spec, the only file to edit for project settings |
| `AnnusMirabilis/App/` | Entry point and the DEBUG-only launch arguments |
| `AnnusMirabilis/Edition/` | The manifest-backed catalog, the scheme handler, the link policy, the web view host |
| `AnnusMirabilis/Resources/` | `Info.plist`, entitlements, privacy manifest, asset catalog |
| `AnnusMirabilis/Models/Generated/`, `Design/Generated/` | Not yet present. Their generators (beads `am-app-native-payloads-bued`, `am-app-design-tokens-3iup`) write build products there, never edited by hand and never committed. The root `generated/` ignore rule only covers `Generated/` on a case-insensitive filesystem, so those beads add an explicit ignore entry |
| `AnnusMirabilisTests/` | Swift Testing: paths, links, launch arguments, and the bundled edition byte for byte |
| `AnnusMirabilisUITests/` | Launch journeys that also produce screenshots |

## Rules

- Never put Xcode's output under `ios/`. The bundled edition carries the web
  export's `figures/plates/pages/`, and the architecture gate reads any `pages`
  directory under `ios/` as a Pages Router root.
- Swift never computes, caches or formats a displayed physical quantity, and
  never authors reader-facing scientific text.
- No third-party Swift packages without a recorded reason.
- Signing with a real team, TestFlight, uploads and App Store submission are
  the owner's. The team id in the identity decision is a placeholder, and the
  project sets no team while it is.
