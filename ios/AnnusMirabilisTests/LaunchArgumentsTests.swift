import Testing

@testable import AnnusMirabilis

@Suite("DEBUG launch arguments")
struct LaunchArgumentsTests {
    @Test("a route, an anchor and the test flag parse together")
    func valid() throws {
        let parsed = try LaunchArguments.parse([
            "/path/to/AnnusMirabilis", "-AMOpenRoute", "/papers/brownian-motion/", "-AMOpenAnchor", "s4-p2",
            "-AMUITest",
        ]).get()
        #expect(parsed.openRoute == "/papers/brownian-motion/")
        #expect(parsed.openAnchor == "s4-p2")
        #expect(parsed.uiTest)
        #expect(parsed.stateSuite == nil)
    }

    @Test("arguments that belong to the system or Xcode are ignored")
    func systemArgumentsIgnored() throws {
        let parsed = try LaunchArguments.parse([
            "-NSDoubleLocalizedStrings", "YES", "-ApplePersistenceIgnoreState", "YES",
        ]).get()
        #expect(parsed == LaunchArguments())
    }

    @Test("a value flag at the end, or followed by another flag, has no value")
    func missingValue() {
        #expect(LaunchArguments.parse(["-AMOpenRoute"]) == .failure(.missingValue(flag: "-AMOpenRoute")))
        #expect(
            LaunchArguments.parse(["-AMOpenAnchor", "-AMUITest"]) == .failure(.missingValue(flag: "-AMOpenAnchor")))
    }

    @Test("an unknown -AM flag fails instead of opening the home page")
    func unknownFlag() {
        #expect(LaunchArguments.parse(["-AMOpenRout", "/papers/"]) == .failure(.unknownFlag("-AMOpenRout")))
    }

    @Test("a repeated flag fails rather than silently keeping one value")
    func repeatedFlag() {
        #expect(
            LaunchArguments.parse(["-AMOpenRoute", "/a/", "-AMOpenRoute", "/b/"])
                == .failure(.repeated(flag: "-AMOpenRoute")))
    }

    @Test(
        "a route must stay inside the edition",
        arguments: ["papers/", "/../Info.plist", "/papers/../../x", "https://example.com/", "/a b/", "/papers/#s4"])
    func invalidRoute(route: String) {
        #expect(LaunchArguments.parse(["-AMOpenRoute", route]) == .failure(.invalidRoute(route)))
    }

    @Test("an anchor is an id, without # or spaces", arguments: ["#s4", "s4 p2", "s4/p2"])
    func invalidAnchor(anchor: String) {
        #expect(LaunchArguments.parse(["-AMOpenAnchor", anchor]) == .failure(.invalidAnchor(anchor)))
    }

    @Test("a state suite names a separate store, and only a plain name is accepted")
    func stateSuite() throws {
        let parsed = try LaunchArguments.parse(["-AMStateSuite", "uitest-3F2A"]).get()
        #expect(parsed.stateSuite == "uitest-3F2A")
        #expect(LaunchArguments.parse(["-AMStateSuite", "../x"]) == .failure(.invalidStateSuite("../x")))
        #expect(LaunchArguments.parse(["-AMStateSuite", ".."]) == .failure(.invalidStateSuite("..")))
        #expect(LaunchArguments.parse(["-AMStateSuite"]) == .failure(.missingValue(flag: "-AMStateSuite")))
    }

    @Test("the retired reset flag is refused, so no test can ask the app to delete data")
    func resetFlagRetired() {
        #expect(LaunchArguments.parse(["-AMResetLocalData"]) == .failure(.unknownFlag("-AMResetLocalData")))
    }
}
