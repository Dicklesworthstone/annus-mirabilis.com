#if DEBUG
    import Foundation

    /// DEBUG-only launch arguments that open any route and anchor, for UI tests
    /// and screenshots (App plan §2.4). Release builds contain none of this.
    ///
    /// `-AMOpenRoute /papers/brownian-motion/ -AMOpenAnchor s4 -AMUITest -AMStateSuite run-1`
    ///
    /// `-AMOpenSiteURL https://annus-mirabilis.com/papers/brownian-motion/#s4` hands the app a
    /// website link exactly as a universal link would arrive, through the same handler.
    ///
    /// `-AMStateSuite` keeps the app's own remembered state in a separate store,
    /// so each UI test starts clean without deleting anything a reader saved.
    ///
    /// Arguments that do not begin with `-AM` belong to the system or to Xcode
    /// and are ignored. An unknown `-AM` flag is an error, so a typo in a test
    /// fails loudly instead of opening the home page.
    struct LaunchArguments: Equatable, Sendable {
        var openRoute: String?
        var openAnchor: String?
        var openSiteURL: URL?
        var stateSuite: String?
        var uiTest = false
        /// Delays the first page load by three seconds, so a UI test can see what is painted before it.
        var holdLoad = false
        /// Ends the page's web process once, after the first page reports ready, as the system does
        /// when it reclaims memory, so a UI test can watch the app bring the passage back.
        var killWebContentOnceReady = false

        enum ParseError: Error, Equatable {
            case missingValue(flag: String)
            case repeated(flag: String)
            case unknownFlag(String)
            case invalidRoute(String)
            case invalidAnchor(String)
            case invalidStateSuite(String)
            case invalidSiteURL(String)
        }

        static func parse(_ arguments: [String]) -> Result<LaunchArguments, ParseError> {
            var parsed = LaunchArguments()
            var seen = Set<String>()
            var index = 0
            while index < arguments.count {
                let flag = arguments[index]
                index += 1
                guard flag.hasPrefix("-AM") else { continue }
                guard seen.insert(flag).inserted else { return .failure(.repeated(flag: flag)) }
                switch flag {
                case "-AMOpenRoute", "-AMOpenAnchor", "-AMStateSuite", "-AMOpenSiteURL":
                    guard index < arguments.count, !arguments[index].hasPrefix("-") else {
                        return .failure(.missingValue(flag: flag))
                    }
                    if let error = parsed.assign(flag, value: arguments[index]) { return .failure(error) }
                    index += 1
                case "-AMUITest":
                    parsed.uiTest = true
                case "-AMHoldLoad":
                    parsed.holdLoad = true
                case "-AMKillWebContentOnceReady":
                    parsed.killWebContentOnceReady = true
                default:
                    return .failure(.unknownFlag(flag))
                }
            }
            return .success(parsed)
        }

        private mutating func assign(_ flag: String, value: String) -> ParseError? {
            switch flag {
            case "-AMOpenRoute":
                guard Self.isRoute(value) else { return .invalidRoute(value) }
                openRoute = value
            case "-AMOpenAnchor":
                guard Self.isAnchor(value) else { return .invalidAnchor(value) }
                openAnchor = value
            case "-AMOpenSiteURL":
                // Any https address: deciding what the app does with it is the handler's job.
                guard let url = URL(string: value), url.scheme == "https", url.host() != nil else {
                    return .invalidSiteURL(value)
                }
                openSiteURL = url
            default:
                guard Self.isAnchor(value), !value.hasPrefix(".") else { return .invalidStateSuite(value) }
                stateSuite = value
            }
            return nil
        }

        /// A path inside the edition: absolute, no scheme, no parent segments.
        static func isRoute(_ value: String) -> Bool {
            guard value.hasPrefix("/"), !value.contains("://") else { return false }
            if value.contains(where: { $0.isWhitespace || $0 == "#" || $0 == "\\" }) { return false }
            return !value.split(separator: "/").contains("..")
        }

        /// An anchor id as the edition writes them (`s3-p2-s1`, `eq-12`), without `#`.
        static func isAnchor(_ value: String) -> Bool {
            !value.isEmpty
                && value.allSatisfy {
                    $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == ".")
                }
        }
    }
#endif
