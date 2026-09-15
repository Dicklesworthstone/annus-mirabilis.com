# COMPREHENSIVE PLAN FOR THE ANNUS MIRABILIS IPHONE APP

## The same edition, in a pocket, offline, with native affordances.

**Working name:** Annus Mirabilis for iPhone and iPad (the App Store name is decided in the identity decision, §18)
**Location:** `ios/` in the `annus-mirabilis.com` monorepo, beside the web application
**Governing plan:** [`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md`](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md). It owns the product doctrine, the epistemic rules, the content model, the experiment runtime, accessibility, privacy, and the editorial voice. This document specifies how the app delivers that product and never relaxes any of those rules.
**Model:** the FrankenPatents app in `~/projects/classic-patents.com/ios/`, inspected on 2026-09-14 (last app commit `fe3cf78b`, 2026-09-05). `docs/DONOR_AUDIT.md` pins the revision actually used.
**Task graph:** the `am-ep-app-m247` epic and its children in `.beads/`, labeled `app-ios`
**Document status:** Version 1.0, planning. Nothing under `ios/` exists yet.
**Prepared:** 2026-09-14

---

## 0. How to read this document

Sections 1 to 3 state the mission, what the donor app teaches, and the central architectural decision. Sections 4 to 9 are the architecture: layout, the app edition, hosting it in WebKit, the bridge, native surfaces, and design. Sections 10 to 12 cover accessibility, privacy, and security. Sections 13 and 14 cover testing, build, and release. Sections 15 to 18 are the delivery plan, risks, the definition of done, and decisions.

"Must" means a build gate or an acceptance criterion. "Should" means a default that a named owner may override with a recorded reason. Every numbered claim about the donor is a claim about the inspected revision.

---

## 1. Mission

### 1.1 What the app is

The Annus Mirabilis edition, installed. The same German source faces, the same new English translation, the same four readings of every paragraph, the same semantic equations and derivation chains, the same instruments with the same numerical owners, and the same discovery journeys, readable with no network on an iPhone or iPad. Around that edition sits a native shell that does what a phone does well: a library within reach of one thumb, native search, Spotlight, Handoff to and from Safari, universal links, the share sheet, find in page, printing a chapter, Dynamic Type, and VoiceOver across the whole experience.

### 1.2 The thesis: one edition, two delivery surfaces

The app is not a second product and not a port. Every sentence, equation, reading, and instrument value a reader sees in the app comes from the same compiled content and the same numerical owners as the website, at a named release. When the site corrects a translation, the correction reaches the app as a new build of the same edition, never as a hand-maintained native copy.

### 1.3 Reader obstacles the app addresses

The governing design test of the master plan applies: name a reader obstacle, show the simplest working interaction, and specify an observable sign of improvement.

| Obstacle | Interaction | Observable sign |
|---|---|---|
| No network (commute, flight, classroom without Wi-Fi) | The complete edition is in the app bundle | The Brownian reference slice, including its instruments, works in airplane mode |
| Losing one's place between short sessions | "Continue reading" restores the exact route and anchor | Relaunch returns to the same sentence, face, and Detail |
| Finding a passage from outside the app | Spotlight and universal links open the passage directly | A shared `annus-mirabilis.com` anchor link opens the same anchor in the app |
| Moving between phone and computer | Handoff carries the current anchor to Safari and back | The Mac opens the same anchor the phone was reading |
| Reading at a comfortable size with one's own assistive setup | Dynamic Type, VoiceOver, Voice Control, and Switch Control work across native and edition surfaces | The same reasoning actions the web supports are completed with system assistive technology |
| Studying a chapter on paper | Print or save a chapter as PDF from the edition's print styles | A printed chapter has complete prose, uncut equations, and expanded essential explanations |

### 1.4 Non-goals for version 1

- No account, sign-in, sync service, in-app purchase, subscription, advertising, analytics, or push notification.
- No remote web content in the reading path. The app never loads `annus-mirabilis.com` pages into its reader.
- No native reimplementation of the reader faces, readings, equations, instruments, runtime, or physics. Swift never computes a displayed physical quantity.
- No over-the-air content or code updates. A corrected edition ships as a new app build (a later bead studies verified edition updates).
- No Mac Catalyst target and no Android app. The website already serves both.
- No Live Activities, augmented reality, gamification, streaks, or badges.

---

## 2. What FrankenPatents Establishes

### 2.1 Audit identity and limits

Source and history inspection of `~/projects/classic-patents.com`: `ios/` (XcodeGen spec, 16 Swift files of about 6,600 lines, 3 unit-test files and 2 UI-test files, the export scripts), `scripts/dsr-apple-quality.sh`, the donor's beads for native work, and the 45 commits touching `ios/` between 2026-08-29 and 2026-09-05. No build, test run, or device session was executed for this plan.

### 2.2 Findings

- **Fully native.** FrankenPatents is SwiftUI with UIKit wrappers (SceneKit, PDFKit, CryptoKit). It has no WKWebView and no JavaScript at runtime.
- **Content reuse by export.** `ios/export-patents.ts` imports the web's canonical TypeScript modules and writes a committed `ios/Resources/patents.json` (9.8 MB). Swift mirrors the schema as `Codable` types, and `PatentCatalogValidator` validates the whole catalogue at launch.
- **Geometry reuse by export.** `ios/export-native-models.ts` runs the web's Three.js model builders in Bun and exports byte-stable USDZ (102 files, 65 MB). A `--manifest-only` mode proves preserved models are untouched.
- **Raw assets by `rsync`.** A post-build script copies all non-PDF `public/patents` into the bundle (about 306 MB) with no size budget.
- **Not shared.** KaTeX is replaced by a hand-written TeX parser with a command whitelist; Three.js by SceneKit; FrankenSim WASM is absent. The "Simulation" tab averages control values into one animation speed. Design tokens are hand-typed in `Theme.swift`.
- **A strong network boundary.** `PatentPDFReader.swift` downloads original PDFs only on request: host allowlist, ephemeral session, 500 MB cap, `%PDF` header check, SHA-256 pin, staged copy and atomic publish, stored in Caches and excluded from backup.
- **Privacy.** `PrivacyInfo.xcprivacy` declares no tracking and no collected data. Local state is versioned `UserDefaults` keys normalized against valid ids.
- **Testing.** Four unit tests (including a shipping-catalogue test and a concurrent PDF-publish race) and ten UI tests. DEBUG launch arguments deep-enter any record or section, and UI tests double as App Store screenshot producers.
- **Build and release.** A local DSR gate (`scripts/dsr-apple-quality.sh`): disk check, XcodeGen regenerate-and-diff, parity check, plist lint, simulator build, Catalyst unit tests, iPhone UI tests into `.xcresult`, with isolated DerivedData. A GitHub Actions Apple workflow was added and removed the same day; Apple validation stays local by policy. No fastlane or upload scripts are in the repository.

### 2.3 Lessons from its history

1. **Content drift is the recurring failure.** Two parity-restore bugs, a regression to 136 native differences, and an open bead to gate releases on matching browser and native artifacts. The app content version was never bound to a web release.
2. **All-or-nothing validation bricked a store build.** App Store Build 2 rejected a legitimate PDF-only record and failed the whole catalogue; Builds 3 and 4 were emergency replacements. The shipping-catalogue test was added only afterward.
3. **A second renderer is a second product.** The native TeX engine needs its own command whitelist, and a string-level check asserts Swift source substrings instead of behavior.
4. **Concurrency in rendering.** A second SceneKit renderer on another queue raced the view's render; preparation was serialized.
5. **Byte stability matters for generated assets.** ZIP timestamps churned every exported model until normalized.
6. **Simulator testing has sharp edges.** Screenshots mis-rotated on the iOS 26.1 simulator; `XCUIScreen.main` resolved to a different booted simulator; launch animations needed a settle; DerivedData filled the boot disk until isolated.
7. **Adaptive navigation needs regression tests.** iPad users were trapped without a back button until a fix and a test.

### 2.4 Reuse table

| FrankenPatents seam | Decision | Annus Mirabilis adaptation |
|---|---|---|
| `ios/` beside `src/`; XcodeGen `project.yml` as the source of truth; regenerate-and-diff check | Copy the pattern | `ios/project.yml`; the Apple gate fails when the committed project is stale |
| `export-patents.ts` importing canonical TypeScript modules into committed JSON | Adapt | Read the content compiler's route-local payloads, never source modules or regexes over React; generate Swift models from the compiler schemas; generated outputs are build products, not committed files |
| `PatentCatalogValidator` (all or nothing) | Change | Per-record validation; a bad record makes one entry honestly unavailable; the shipping-payload test runs before every upload |
| Typed honesty kinds carried into native records | Copy the idea | Execution labels, typed results, and publication states come unchanged from the web runtime that renders them |
| `PatentPDFReader.swift` network boundary | Adapt | Facsimile downloads pinned to release-manifest digests (§8.8) |
| `PrivacyInfo.xcprivacy` with zero collection; versioned local keys | Copy | Same stance; key constants shared with the web storage layer |
| `scripts/dsr-apple-quality.sh` | Adapt | `scripts/app/apple-quality.ts`, registered as the `apple` gate family, writing the shared JSONL logs |
| DEBUG launch arguments; UI tests producing App Store screenshots | Copy | Launch arguments open any route and anchor; screenshots come from real edition content |
| Accessibility defaults: spoken math labels, reduced motion, `UIFontMetrics` with a user scale, 44 pt targets | Adapt | Spoken forms come from the edition's `Equation` records; Dynamic Type maps to the edition's type-size setting |
| `TabView` on compact widths, `NavigationSplitView` on regular widths, back-navigation regression tests | Copy | Same, with an iPad back-navigation test from the first shell change |
| Native TeX parser and its command whitelist | Do not port | KaTeX HTML plus MathML, rendered at build time, inside the bundled edition |
| SceneKit "Simulation" driven by averaged controls | Do not port | Instruments run the web runtime with FrankenSim WASM or the audited TypeScript evaluator and earn labels per accepted snapshot |
| Hand-typed `Theme.swift` colors | Do not port | Native tokens generated from the web theme |
| `rsync` of all non-PDF public assets with no budget | Do not port | The edition manifest lists exactly what ships; the size budget is enforced |
| Source-substring parity assertions | Do not port | Behavior tests only |
| Release coupling left open | Replace | The app release record binds each build to the web `releaseId` and `determinismDigest` |
| USDZ export of Three.js builders | Not needed for version 1 | The few Three.js studios run in WebKit; a Quick Look export is considered only if a reader obstacle justifies it |

---

## 3. The Central Decision: A Native Shell Around the Bundled Edition

### 3.1 Options considered

1. **Fully native, as FrankenPatents.** Rewrite the reader faces, readings, semantic equations, 33 instruments, the runtime, and the discovery book in SwiftUI. **Rejected.** It creates a second implementation of every presentation and a third implementation of every law the doctrine assigns to one owner ("Kernels own the law"), a second math engine, and exactly the drift the donor's history documents. Every editorial correction would need two reviews.
2. **A web view of the live site.** **Rejected.** Reading fails without a network; the reading path gains a remote dependency; and App Review guideline 4.2 rejects apps that are a repackaged website without native features, content, or interface.
3. **A cross-platform framework** (React Native, Expo, Capacitor, Flutter). **Rejected.** It adds a second interface framework or plugin ecosystem and a large dependency surface. Capacitor is itself a WKWebView host with plugins; a thin, owned Swift shell with a narrow bridge is smaller, auditable, and consistent with "not a new framework adopted because it is fashionable."
4. **Chosen: a native SwiftUI shell hosting the same static edition, bundled in the app and rendered by WKWebView from a local first-party origin.** Native surfaces are built from the compiler's payloads. Every reading face, equation, instrument, and journey is the web edition itself.

### 3.2 What is native and what is the edition

| Native (SwiftUI and UIKit) | Edition (WKWebView, bundled) |
|---|---|
| App chrome, tabs, sidebar, navigation stacks | Every reader face: German, English, gloss, parallel, reading, results, facsimile, split |
| Library with the frontispiece, paper outlines, "Continue reading" | The four readings, notation toggle, perspective axis, result weave, return stack |
| Discover and Lab catalogues built from payloads | Semantic equations, the interaction ladder, derivation chains, show the code |
| Native search field (the query runs the edition's own search code) | Every instrument, predict mode, tapes, execution labels, typed results |
| Spotlight, Handoff, universal links, share sheet, print and PDF | Discovery journeys, the 1904 desk, foundations, tours, connections, timeline |
| Settings, "Your data on this device," About and edition identity | The notebook, capstone worksheets, notation and sources pages |
| Facsimile download manager | The facsimile face that displays a downloaded PDF |

### 3.3 Doctrine consequences

- **One numerical owner.** Instruments compute in the edition's workers exactly as on the web. No Swift code formats, computes, or caches a physical quantity for display.
- **Labels earned per snapshot.** "Ideal model, computed with FrankenSim" appears only for an accepted WASM result. Where WebKit disables WebAssembly (for example under Lockdown Mode, per the probe's recorded behavior), the runtime shows the host-calculation or unavailable label and the static worked example remains.
- **The book works as a book.** If workers, WASM, or WebGL fail inside WebKit, the static reading faces remain complete.
- **No invented completeness.** Native library states read the coverage ledger and the publication profile; a native screen never claims a paper, translation, or instrument is available when the compiled coverage says otherwise.
- **A change of description is not a change of world.** Native navigation, rotation, backgrounding, and theme changes are presentation changes; they never restart a laboratory or consume randomness.

### 3.4 App Review posture

- **4.2 minimum functionality:** the native value of §3.2 and §8 is real and testable, and the review notes name it.
- **2.5.2 self-contained bundles:** the edition's HTML, JavaScript, and WASM ship inside the signed bundle and execute only in WebKit; version 1 downloads no code. Verify the guideline's current text when preparing the submission.
- **5.1 privacy:** "Data Not Collected," no tracking, and a manifest that matches the code.
- **Export compliance:** only exempt encryption (HTTPS and hashing), recorded as `ITSAppUsesNonExemptEncryption = NO` after checking current requirements.

---

## 4. Repository Layout

```text
ios/
  project.yml                        # XcodeGen source of truth
  AnnusMirabilis.xcodeproj/          # generated and committed; the Apple gate fails when stale
  AnnusMirabilis/
    App/                             # entry point, scenes, DEBUG-only launch arguments
    Shell/                           # library, outlines, tabs, split view, settings, about
    Edition/                         # scheme handler, web view host, bridge, lifecycle
    Native/                          # search host, Spotlight, Handoff, share, print, facsimiles
    Models/Generated/                # Swift models generated from compiler schemas; never hand-edited
    Design/Generated/                # tokens generated from the web theme; never hand-edited
    Resources/                       # Info.plist, PrivacyInfo.xcprivacy, entitlements, asset catalog, fonts
  AnnusMirabilisTests/               # unit and integration tests
  AnnusMirabilisUITests/             # in-app journeys and screenshot producers
  README.md
scripts/app/
  export-edition.ts                  # builds the app edition from the web build at one commit
  export-native-payloads.ts          # native payload snapshot and Swift model generation
  generate-design-tokens.ts          # Swift tokens from the web theme
  apple-quality.ts                   # the `apple` gate family
  verified-app-release.ts            # the only upload entry point
src/platform/app-bridge/             # the web side of the bridge; inert in browsers
generated/app-edition/               # gitignored export output
ios/build/                           # gitignored isolated DerivedData, results, and logs
```

Rules:

- `ios/` joins the root allowlist of the architecture gate with a recorded reason. `ios/` never contains a `src/app`, `pages`, or any App Router file.
- Generated editions, payload snapshots, and build products are not committed. The Xcode build phase refuses to build with a missing or stale edition and prints the command that produces it.
- The web application never imports from `ios/`, and no web bead depends on an app bead. The app can be absent and the website still builds, deploys, and launches.
- Version 1 uses no third-party Swift packages. Adding one requires a recorded reason, a license entry in the third-party inventory, and a privacy-manifest review.

---

## 5. The App Edition

### 5.1 Same commit, same content, a named release

`scripts/app/export-edition.ts` builds the edition from the current commit with the release profile the build targets (`scaffold`, `preview`, or `launch`) and the build target `app`. It reuses the release manifest (`public/release-manifest.json`) and writes `generated/app-edition/edition-manifest.json`:

- `releaseId`, `profile`, `determinismDigest`, `site.commit`, and `schemaVersion`, copied from and checked against the release manifest of the same build;
- every file with `path`, `sha256`, `size`, and `contentType`;
- the declared app-profile exclusions, each with a reason;
- the edition's total size and the budget it was checked against.

### 5.2 Build mode

The edition is a static rendering of the same routes the website serves. The WebKit probe and the stack decision choose between a static export of the Next.js build and a crawl of the production build, and record why. The edition-parity bead proves that, for the same commit and profile, every route and payload in the web release exists in the app edition with the same content hash, except for declared exclusions.

Declared exclusions for version 1: share-card image routes; `robots` and `sitemap`; the "save this chapter for offline reading" action (the whole edition is offline); the clarity-signal endpoint (§11); any route that needs a server at request time (the site should have none).

### 5.3 Size budget

Provisional: the bundled edition at most 80 MB uncompressed and the App Store download at most 150 MB. Facsimile PDFs are never bundled. The budget is checked at export and at archive time, and adjusted only with a recorded measurement.

### 5.4 Integrity

Code signing protects the installed bundle. Integrity work therefore happens at build time: the bundling phase verifies every file against the edition manifest and refuses a mismatch, a missing file, or an unlisted file. Downloaded facsimiles are verified against release-manifest digests on every download (§8.8).

---

## 6. Hosting the Edition in WebKit

### 6.1 The local origin

**Preferred:** a custom URL scheme (`am-edition://edition/`) served by a `WKURLSchemeHandler`. **Fallback:** a loopback HTTP server bound to `127.0.0.1` on a random port, with `NSAllowsLocalNetworking` as the only App Transport Security exception. The WebKit probe chooses by recording, per variant, on the simulator and on at least one real iPhone:

- `isSecureContext` and `crypto.subtle` (the WASM loader hashes artifacts with SubtleCrypto);
- dedicated and module workers loaded from the origin, and `fetch` from inside workers routed to the handler;
- `WebAssembly.compileStreaming` with `application/wasm`, and whether CSP needs `'wasm-unsafe-eval'`;
- Content-Security-Policy delivered by response headers, including on worker scripts;
- client-side navigation and the payload fetches it performs;
- `localStorage` persistence across relaunch;
- WebGL2 for the few Three.js studios, and the pdf.js worker;
- MathML rendering, and VoiceOver reading of a rendered equation;
- `prefers-reduced-motion` following the system setting;
- text selection and `UIFindInteraction`;
- recovery after the WebContent process terminates;
- behavior under Lockdown Mode (JIT and WebAssembly availability).

### 6.2 Scheme handler responsibilities

- Serve only files listed in the edition manifest; normalize paths and reject traversal, encoded separators, and absolute paths.
- Content types from a fixed table (including `text/html; charset=utf-8`, `text/javascript` for classic and module scripts, `application/wasm`, `application/json`, `font/woff2`, `image/svg+xml`, `application/pdf`).
- Security headers generated from the same policy source as the website's headers, so CSP and the other headers cannot drift.
- The edition's own 404 page for unknown paths; no directory listing.
- Range requests where media or PDFs need them.
- Correct cancellation through `webView(_:stop:)`, and thread-safe task handling.

### 6.3 Web view configuration

- `isInspectable` only in DEBUG builds.
- `isFindInteractionEnabled` on, so find in page is native.
- Media playback requires user action; no automatic window opening.
- Back and forward gestures cooperate with the edition's return stack; native navigation never discards the stack.
- Text selection and the system share of selected text work.
- The data store the probe selects; reader data lives in the native storage backend (§7.3) whichever store WebKit uses.

### 6.4 Navigation policy

- Only the edition origin loads inside the web view.
- An `https` link opens outside the reader in `SFSafariViewController`, which shares no state with the app. Links to `annus-mirabilis.com` routes that exist in the bundled edition open in the app instead.
- Every other scheme is refused. Downloads inside the web view are disabled; printing and PDF go through the native print path.

### 6.5 Lifecycle

- Backgrounding triggers the edition's `visibilitychange` handling, which already pauses laboratories under the runtime contract.
- Memory warnings are forwarded to the edition so the runtime can release presentation resources.
- WebContent process termination reloads the same route and anchor. A laboratory resumes only through the runtime's checkpoint validation, otherwise it begins a visibly new run.
- Serious or critical thermal state asks the runtime to reduce presentation detail. It never changes a model, time step, or statistical sample.

---

## 7. The Native–Edition Bridge

### 7.1 Principles

Narrow, versioned, allowlisted, validated in both directions, and capability-detected so the same web build behaves normally in any browser. Native code never evaluates arbitrary JavaScript. The only scripts native injects are fixed document-start user scripts compiled from `src/platform/app-bridge/`, with their hashes recorded in the edition manifest.

### 7.2 Messages in version 1

| Message | Direction | Purpose |
|---|---|---|
| `hello` | edition → native (reply) | Bridge version and native capabilities |
| `storage.read`, `storage.write`, `storage.list`, `storage.clear`, `storage.export` | edition → native (reply) | The storage backend for the web storage layer |
| `settings.changed` | both | Theme, Detail, Perspective, notation, reading-only, type size |
| `route.changed` | edition → native | Route, anchor, and title for "Continue reading," Handoff, and state restoration |
| `share.request` | edition → native | A canonical anchor URL and, optionally, a bounded tape permalink; never private notes |
| `external.open` | edition → native | An `https` URL from a link element |
| `facsimile.status`, `facsimile.request` | edition → native (reply) | Download state and user-initiated download for a pinned facsimile |
| `print.request` | edition → native | Print or PDF of the current chapter |
| `test.log` | edition → native | Test builds only: console and runtime events for failure evidence |
| `lifecycle.visibility`, `lifecycle.memoryWarning`, `lifecycle.thermalState`, `facsimile.updated` | native → edition | System events, dispatched through one fixed function with an enumerated event name |

### 7.3 Validation and safety

- Accept a message only when `frameInfo.isMainFrame` is true and `securityOrigin` equals the edition origin.
- Decode against versioned schemas; reject unknown message types, unknown versions, unknown fields, oversized bodies, and rate-limit abuse.
- Replies use `WKScriptMessageHandlerWithReply` and the result shapes of the web storage layer (`ok`, `missing`, `unavailable`, `corrupt`, `quota`); nothing throws into rendering code.
- 64-bit identities inside tapes stay canonical decimal strings.

---

## 8. Native Surfaces

### 8.1 Library

The frontispiece (Lucien Chavan's portrait of Einstein at the Bern patent office, about 1905, with its credit), the four papers with German titles, working English titles, locators, and the 63 page marks, and each paper's honest state from the coverage ledger and publication profile. The companion record appears only when admitted.

### 8.2 Navigation

- **Compact width:** a `TabView` with **Read** (library, outlines, "Continue reading"), **Discover** (journeys, the 1904 desk, tours, connections, timeline), **Lab** (the instrument catalogue with availability), **Search**, and **More** (notebook, notation, foundations, sources, about, settings, your data).
- **Regular width:** a `NavigationSplitView` with the same sections in a sidebar.
- Scene storage restores the last section, route, and anchor. Every pushed view has a reachable back action, tested on iPhone and iPad.

### 8.3 Search

A native search field whose query executes the edition's own client query module in JavaScriptCore over the same build-time index the website uses. Results match the website's for the same query and index, which a test proves. Results open the edition at the anchor.

### 8.4 Spotlight

Papers, sections, results, instruments, and foundations are indexed with titles and short snippets from the payload snapshot, grouped by paper, re-indexed when the edition changes, and removed when a record leaves the edition. Private notes, predictions, and tours are never indexed.

### 8.5 Universal links

`applinks:annus-mirabilis.com` in the entitlements, an Apple App Site Association file served by the website at `/.well-known/apple-app-site-association` (JSON, no redirect), and a route table generated from the web's route definitions: papers, sections, anchors, `?view=`, `?detail=`, `/discover/[paper]`, `/lab/[experiment]`, `?tape=`, foundations, and the other top-level pages. Paths outside the table stay in Safari.

### 8.6 Handoff, share, and print

- Handoff advertises the current canonical anchor URL as a browsing activity, so Safari on another device opens the same place.
- The share sheet offers the canonical anchor URL and, from an instrument, its bounded tape permalink.
- Print and "Save as PDF" render the current chapter with the edition's print styles.

### 8.7 Settings and your data

- **Theme:** Annalen by default for every reader, an option to follow system appearance (dark maps to Kramgasse Night), and Slate on Discover unless the reader chose a theme. These are the website's rules.
- **Reading:** Detail, Perspective, notation, and reading-only mode.
- **Text size:** follow Dynamic Type (the default) or a custom size, mapped to the edition's type-size setting.
- **Your data on this device:** export and clear by namespace, with the same namespaces as the website.

### 8.8 Facsimiles

A download manager for the pinned facsimile PDFs: size shown before download, user-initiated only, host allowlist (`annus-mirabilis.com`), ephemeral session, size cap, `%PDF` check, SHA-256 equal to the release-manifest digest, staged copy with atomic publish, stored in Caches and excluded from backup, honest states for not downloaded, downloading, verified, failed, and evicted. Removing a download is a reader action in the manager.

### 8.9 About

Edition identity (release id, edition version, and date), the photograph and font credits, the third-party license inventory, and links to the edition's sources and about pages.

---

## 9. Design

- Native tokens (colors per theme, spacing, type scale) are generated from the web theme tokens; a contrast test covers every native text pair.
- Newsreader, Plus Jakarta Sans, and JetBrains Mono subsets ship in the bundle, registered through `UIAppFonts`, with their OFL licenses.
- The app icon is the page-count mark from the placeholder site: four bars in the proportions 17, 12, 31, and 3, drawn procedurally for every required size. The launch screen uses the Annalen paper color.
- Every native string follows the editorial voice and passes the voice lint.

---

## 10. Accessibility

- VoiceOver moves predictably between native chrome and edition content; the web view is one accessibility container, and the edition's landmarks and headings are reachable with the rotor.
- Equations read through the edition's MathML and authored spoken forms. The announcement pattern chosen by the website's assistive-technology matrix is verified again inside the app on a real device.
- Voice Control names match visible labels; Switch Control reaches every action; no action requires a gesture alone.
- Dynamic Type through the accessibility sizes reflows native layouts and maps to the edition's type size.
- Reduced motion follows the system; reading-only mode is available natively and in the edition.
- A hardware keyboard on iPad reaches search (Command-K), find in page (Command-F), and focus navigation.
- Disabled readers test the app's reasoning actions with their own devices before the app ships to external testers.

---

## 11. Privacy

- The privacy manifest declares no tracking, no tracking domains, and no collected data types. It declares required-reason API use only for APIs the code actually uses (for example `UserDefaults` for app-only data, file timestamps within the container, and disk space before a facsimile download), checked against Apple's current list when implemented.
- App Store privacy label: "Data Not Collected."
- Network use: user-initiated facsimile downloads from `annus-mirabilis.com`, and the operating system's own fetch of the association file for universal links. Nothing else.
- The clarity signal is not sent from the app in version 1. Enabling it requires a separately authorized privacy decision and an updated privacy label.
- Notes, predictions, tours, and reading positions stay in the app's container. They are part of the reader's own device backup, never synchronized to a server, never indexed in Spotlight, and never placed in shared links.
- No App Tracking Transparency prompt, because nothing is tracked.

---

## 12. Security

- Scheme handler path safety and manifest-only serving (§6.2).
- Bridge origin checks, schema validation, and limits (§7.3).
- Identical Content-Security-Policy to the website; no remote content in the web view.
- App Transport Security without exceptions, unless the loopback fallback is chosen, in which case `NSAllowsLocalNetworking` is the only exception.
- Facsimile download pinning (§8.8).
- DEBUG-only inspectability and launch arguments, compiled out of release builds.

---

## 13. Testing

### 13.1 Layers

1. **Swift unit and integration tests:** the scheme handler (types, traversal, headers, 404, cancellation); the bridge decoder (malformed, oversized, wrong origin, wrong version); the storage backend against the web storage layer's shared fixtures (quota, corrupt data, migration, quarantine); decoding of every shipped payload with per-record failure; route-table parity with the web routes; token contrast; the facsimile store's concurrent-publish race.
2. **Edition parity:** route and payload-hash parity between the web release and the app edition for the same commit and profile, plus the website's Playwright journeys run in WebKit against the app edition served with the handler's exact headers.
3. **In-app journeys (XCUITest):** per paper, enter through a universal link to a deep passage, switch face, open a foundation, return to the exact argument, operate an instrument with typed entry, confirm the execution label matches the accepted snapshot, and return to the source. Lanes: offline (airplane mode), relaunch restore, iPad, largest accessibility text size, VoiceOver identifiers, and a WebAssembly-unavailable lane.
4. **Performance:** cold launch to readable text, first paint of a section, memory during the BM-01 ensemble, instrument feedback latency, and thermal behavior during a ten-minute laboratory session, on recorded device profiles.
5. **Real devices:** a human-run check on real iPhones with VoiceOver, and assistive-technology sessions with disabled readers.

### 13.2 Logs and evidence

Swift test code writes the shared JSONL schema to `artifacts/test-logs/app-<suite>/<logRunId>.jsonl`, with the standard fields plus `lane`, `device`, `osVersion`, `appVersion`, `appBuild`, and `editionReleaseId`. Failures retain the `.xcresult` bundle, screenshots, the edition's console events (through `test.log`), and a DOM snapshot of the current route. Behavior is tested; source text is never asserted.

### 13.3 Known pitfalls to design around

Dedicated, named simulators so tests never attach to another booted device; readiness signals from the edition instead of sleeps; isolated DerivedData under `ios/build/`; a disk-space check before building; screenshot orientation verified before use in App Store assets.

---

## 14. Build, Release, and the App Store

### 14.1 Toolchain

Xcode, the iOS SDK, the deployment target, the Swift language mode, XcodeGen, SwiftLint, and the test frameworks are pinned by the toolchain decision. The machine that prepared this plan has Xcode 26.1.1, Swift 6.2.1, the iOS 26.1 simulator runtime, and SwiftLint; XcodeGen and fastlane are not installed, and no App Store Connect API key is present.

### 14.2 The Apple gate

`scripts/app/apple-quality.ts`, registered as the `apple` family in the quality-gate registry, local only by default: disk check, XcodeGen regenerate and diff, plist and privacy-manifest lint, SwiftLint, edition export freshness, simulator build without signing, unit tests, UI tests into `.xcresult`, shared JSONL logs. It is required by the app release profile and not by the website's CI.

### 14.3 The verified app release

`scripts/app/verified-app-release.ts` is the only upload path:

1. Take an exclusive lock; refuse a dirty tree or a conflicting build.
2. Run the Apple gate and the web gates required for the profile.
3. Export the edition and require an existing web release record for the same commit and profile with passing candidate checks, and equal `releaseId` and `determinismDigest`.
4. Require a build number greater than the last recorded upload.
5. Archive, export, and upload with an App Store Connect API key whose file lives outside the repository.
6. Write the app release record `artifacts/releases/app/<version>-<build>-<logRunId>.json`: app version and build, edition identity, web release record path, gate results, privacy-manifest digest, and archive digest.

Uploading requires an authorization file with the user's verbatim words, as for web deploys. A dry run prints every step without uploading.

### 14.4 TestFlight and the App Store

- **TestFlight preview:** the preview edition (honest in-preparation states) to internal testers, then external testers after Beta App Review, each step with explicit authorization.
- **App Store launch:** after the website's complete four-paper launch, with the same `releaseId`, explicit authorization, and a phased release. The App Store has no rollback; a defect is fixed with an expedited build, and removal from sale is the last resort. The website never depends on the app.

### 14.5 Corrections cadence

Each web release that changes content records whether an app build follows. The About screen shows the edition identity, so a reader and a reviewer can tell which edition a device holds.

---

## 15. Delivery Plan

| Phase | Batch | Work | Exit evidence |
|---|---|---|---|
| App 0 | batch-b | Identity decision, toolchain lock, WebKit probe | Probe results and the hosting choice recorded in `docs/DECISIONS.md` |
| App 1 | batch-c | Scaffold, Apple gate, edition export and bundling, scheme handler, web view host, bridge, storage backend, settings, payload models, design tokens, test harness, edition parity | The scaffold-profile edition runs offline in the simulator; the Apple gate is green; parity is proven |
| App 2 | batch-d | Native shell, search, universal links, Handoff, share and print, Spotlight, facsimiles, lifecycle, accessibility, journeys, performance, assistive-technology sessions, the app reference slice | Brownian sections 4 and 5 end to end, offline, on a real iPhone with VoiceOver and honest labels |
| App 3 | batch-d | Apple account setup, verified release script, App Store listing, TestFlight preview | Testers run the preview edition from TestFlight |
| App 4 | batch-i | App Store launch after the website's launch | The App Store build carries the launched `releaseId` |
| Later | later | Verified edition updates, microscope video capture for the kitchen mode, a home-screen widget | Each starts only after its stated conditions |

App work never delays a website batch. The app reference slice begins after the website's reference slice has frozen the shared reader and equation architecture; any change the app needs in shared web code goes through that architecture's recorded change process.

---

## 16. Principal Risks

| Risk | Failure mode | Response |
|---|---|---|
| WebKit limits on a local origin | Workers, streaming WASM, SubtleCrypto, or CSP headers fail under a custom scheme | The probe decides before any scaffold; loopback fallback; honest labels when a capability is missing |
| App Review 4.2 | Rejected as a repackaged website | Real native surfaces (§3.2, §8), review notes that name them, bundled offline content |
| Drift between app and website | The app shows content the website corrected | The edition is built from the same commit; parity tests; the release record binds `releaseId` |
| Memory pressure | The WebContent process is terminated during a laboratory | Route and anchor restoration; runtime checkpoint validation or a visibly new run |
| Bundle size | Download exceeds the cellular limit | Edition manifest and enforced budget; facsimiles on demand |
| Assistive technology inside WKWebView | Equations or focus order fail with VoiceOver | Device verification in the app, sessions with disabled readers before external testing |
| Doctrine erosion | A native shortcut computes or paraphrases what the edition owns | Rule: Swift never computes a displayed physical quantity or authors reader-facing scientific text; review checks it |
| Storage loss | WebKit evicts web storage | Native storage backend with the web layer's results and quarantine semantics |
| Toolchain churn | Xcode or iOS changes break WebKit behavior | Pinned toolchain; the probe rerun on each major Xcode or iOS change |
| Lockdown Mode and restricted WebKit | WASM or JIT unavailable | Runtime fallbacks and labels; static worked examples |
| Store identity | The preferred name is unavailable | Decided early with alternatives |

---

## 17. Definition of Done for the App Store Launch

1. The app's edition has the same `releaseId` and `determinismDigest` as the launched website, and edition parity passes.
2. All four papers read offline in the app with every face, reading, equation, instrument, and journey the website offers, with the same execution labels.
3. The native surfaces of §8 exist and pass their tests on iPhone and iPad.
4. The in-app journeys pass in every lane, including offline, relaunch, the largest accessibility text size, and WebAssembly unavailable.
5. Real-device checks and assistive-technology sessions are recorded with reviewer names and dates.
6. Performance budgets pass on the recorded device profiles.
7. The privacy manifest and the App Store label both say no data is collected, and the code matches.
8. The verified app release script produced the uploaded build and its release record, under recorded authorization.

---

## 18. Decisions

**Made by this plan.** A native SwiftUI shell hosts the bundled static edition in WKWebView; the app never reimplements the edition or its physics; content comes from the same commit and release; version 1 is offline with user-initiated facsimile downloads as its only network use; the app is universal for iPhone and iPad without Mac Catalyst; Apple validation runs locally; no third-party Swift packages in version 1; the clarity signal is off in the app.

**To resolve at the point they affect work.** The App Store name, bundle identifier, and Apple team; the minimum iOS version (after the probe); the custom scheme or loopback origin (after the probe); static export or production crawl for the edition; the Swift language mode and test frameworks; the size budget's final numbers; whether a later verified edition update is worth its review and operational cost.
