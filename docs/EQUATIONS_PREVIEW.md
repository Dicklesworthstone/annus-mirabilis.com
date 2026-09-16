# Inspectable Brownian equations

The Brownian reader and `/lab/bm-01/` now include three inspectable model
relations: Stokes–Einstein diffusivity, coordinate RMS displacement, and
interval-dependent apparent speed. These are original **modern pedagogical
records with editorial review pending**, not transcriptions of printed equations
or a completed historical notation concordance.

## Reader experience

Select a symbol or an operation in the displayed formula, or use its labeled
term/operation button. The single formula keyboard stop supports Down to enter
an operation, Up to its parent, Left/Right between siblings, Home/End within a
sibling set, and Escape to clear. Tab leaves the formula. Whole-formula MathML
is independent of the visual hit targets. Selection announcements contain the
selected explanation, not a stream of changing numerical values.

The inspector explains roles, units, quantity identity and assumptions. Square
roots and division have their own explanations, not just the neighboring
symbols. Prerequisite links use the reader's real clarification/return stack;
on standalone lab pages they are ordinary links to full foundation pages.
Selection, monochrome pattern mode, and input-focus actions make no numerical
requests. Input editing still requires the laboratory's explicit apply action.

Within a laboratory, selecting the same canonical quantity highlights its
occurrences in the other equation cards and corresponding model table values.
A separately opened laboratory has its own selection store and trial. The
reader's explanatory cards remain symbolic rather than guessing which nearby
experiment they should use. Its embedded laboratory has its own exact primary
slot and live equations.

## Live values and scientific meaning

Each live card consumes one immutable accepted BM-01 snapshot. It displays the
same accepted instance, run, revisions and snapshot version as the graph/table.
The numerical owners now publish temperature, viscosity, radius, observation
interval and the active Boltzmann constant alongside their model outputs.
Protocol `bm01-host-v2` rejects input echoes that disagree with the request.

Unapplied drafts do not change equation values. Pending, refused, stopped and
unavailable calculations retain the accepted values with an explanation of
which state they describe. A missing or ambiguous instance slot stays symbolic;
it never resolves to the first mounted experiment. Non-numeric scientific
statuses remain explanations. In particular, apparent speed at zero interval
is not replaced with zero or infinity. Coordinate model RMS is never replaced
by a sample RMS or total vector distance just because their dimensions agree.

The initial values are labeled **Static worked example**; only an accepted
calculation earns **Ideal model, host calculation**. This scoped label checks
accepted owner contracts and source provenance. It does not claim a verified
WASM artifact or implement the general multi-owner capability admission system.
The view formats existing outputs and exact display factors, but evaluates no
Brownian formula and draws no random numbers.

## Authoring and compilation

`content/equations/brownian-motion/*.json` declares stable equation-qualified
term/operation identities, quantity bindings, expression structure, sentences,
node explanations, foundation links and assumptions. The content compiler
checks those references and joins the records to the existing argument exports.
Its versioned Markdown and JSON exports include the equation records.

The bounded expression model supports scalar sums/products/quotients, exact
powers and roots, grouping, averages, selected elementary functions, relations,
and simple derivatives/integrals. Reduced BigInt rationals represent dimensions
in the pinned order `[length, mass, time, temperature, current, amount]`.
Dimensionless function arguments and dimensional relations are checked exactly;
direct symbol relations also reject mismatched semantic kinds. Dimensional
consistency is not a proof of a model or a general semantic type-inference system.
Unsupported structures fail rather than earn a successful check.

`prepare:content` validates the records and generates the route-local equation
payload with pinned KaTeX. Plain TeX, unmarked MathML, visual markup, selection
hierarchy and quantity metadata derive from the same tree. The renderer trusts
only generated role classes and the exact registered `data-term`/`data-op`
attribute/value pairs; authors cannot supply HTML or arbitrary TeX. Every
selectable node must actually survive rendering or compilation fails. Math is
rendered at build time, not parsed in the browser. The payload records renderer
and equation hashes; the general content URLs include compiler/input identity.

## Run and exercise

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run dev
# Open /lab/bm-01/ or /papers/brownian-motion/

npm run test:reference
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

In the tracer lab, select “Why a square root?”, then select “Dynamic viscosity”
and focus its real input. Double viscosity and apply; the equation values and
model table update together. Request an off-grid interval and verify that the
accepted values remain. At time zero, inspect the apparent-speed explanation.
Open a second ensemble to compare independent placements. In the reader, open
the square-root prerequisite and return to the selected equation.

The tests exercise the actual typed model, content records, KaTeX renderer,
immutable store, real worker outputs, production pages and reader return stack.
Screenshots and structured browser checks are retained by the existing workflow.
Each workflow result applies only to its exact commit. The preview workflow uses
Node 22.16.0, not the separately ratified Node/Bun combination.

## Remaining boundaries

Only three modern Brownian model equations and their BM-01 primary-slot bindings
are delivered here. The full source/translation equation inventory, cross-paper
notation concordance, indexed/tensor/matrix expression rules, richer contextual
units, general manifest/capability adapters, selection permalinks and route-wide
lifetime persistence remain open. Firefox, WebKit, real-device, manual
screen-reader and disabled-reader reviews are not claimed. No production
deployment, historical review signoff or closure of the broader P0 beads is
implied by this implementation.
