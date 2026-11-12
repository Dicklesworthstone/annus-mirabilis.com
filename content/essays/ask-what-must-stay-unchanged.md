## Change the description, keep the event {#same-event}

An event is something that happens at a place and time, such as a light pulse reaching a detector. Different inertial observers can give that event different coordinates. A transformation connects those descriptions; it does not replace the event with a different experiment. This distinction makes it possible to ask which relations should survive a change of frame. {#event-and-coordinates}

The [relativity paper states the task in terms of the same event](ref:special-relativity/s3-p4): its stationary-system coordinates are to be related to coordinates and a time in the moving system. The [frames-and-events foundation](ref:frames-events) gives the distinction a concrete setting before any calculation. {#the-source-task}

“Unchanged” does not mean every displayed number must be the same. A frequency, a coordinate time or a measured rod length can change with the frame. The question is which physical law or relation the transformation must preserve, and which quantities the law allows to change together. {#choose-the-relation}

## A familiar candidate fails a new requirement {#the-galilean-candidate}

The Galilean candidate subtracts the moving origin's displacement from position and keeps the time coordinate unchanged. It works as the familiar approximation for slow relative motion. Applied to a light ray travelling in the direction of the frame motion, however, it predicts a speed c minus the frame speed. It therefore fails the requirement that this ray have speed c in both inertial systems. {#candidate-and-constraint}

That failure is conditional on the light-speed requirement. It does not follow just from preferring a different algebraic expression, and it does not show that every successful use of the slow-motion approximation was mistaken. It identifies the requirement that this candidate cannot satisfy exactly. {#what-the-failure-means}

Open [the transformation-construction instrument](ref:sr-04) before selecting all the requirements. Its intermediate answers matter: some admitted information can constrain a family of maps without selecting one member. A result that leaves several maps possible is then a correct statement of what the premises establish. {#build-by-requirements}

## Keep both light directions {#both-light-directions}

Assume inertial coordinates, uniform relative motion and coincident origins at time zero. The source [invokes homogeneity when stating that the map must be linear](ref:special-relativity/s3-p5). The following is the edition's shorter pedagogical reconstruction; [the full reading also follows the paper's own synchronisation-based route](ref:special-relativity/arg-sr-lorentz-map). It is a route through the argument, not a reconstruction of its author's private thinking. {#state-the-map-assumptions}

The moving origin follows x = vt, so its moving position must vanish whenever x − vt vanishes. Write the moving coordinate as an unknown speed-dependent scale a multiplying x − vt. Begin the time relation more generally as t′ = bt + dx, with coefficients still to determine. {#begin-with-free-coefficients}

{{equation:eq-model-sr-map-ansatz-position}} {#position-family}

For light travelling right, set x = ct and require x′ = ct′. For light travelling left, set x = −ct and require x′ = −ct′. These are distinct conditions. Adding the resulting coefficient relations gives b = a; subtracting them gives d = −av/c². The time relation is therefore the following. {#combine-the-two-constraints}

{{equation:eq-model-sr-map-ansatz-time}} {#time-family}

The same factor a multiplies both coordinate combinations, and it remains free. Multiplying both transformed coordinates by a common nonzero factor preserves the light-ray conditions. Preserving those rays alone therefore cannot determine the size of the coordinate scales. {#what-remains-free}

## Require the return journey to undo the first {#reciprocity-and-isotropy}

Now transform an event into the moving frame and back. Applying the same family with speed −v must restore the starting coordinates. Substitution gives a(v)a(−v)(1 − v²/c²) = 1. This relates the scales for the outward and return transformations; it does not yet say that they are equal. {#undo-the-description}

Spatial isotropy supplies that further condition: reversing the direction of motion must not change the scale, so a(v) = a(−v). Together these conditions determine its magnitude. Continuity with the identity at zero relative speed selects the positive branch, giving the Lorentz factor. {#choose-the-scale}

{{equation:eq-model-sr-lorentz-factor}} {#lorentz-scale}

{{equation:eq-model-sr-map-position}} {#resolved-position-map}

{{equation:eq-model-sr-map-time}} {#resolved-time-map}

The longitudinal map is now fixed, but the transverse coordinates must also be checked. Applying the light-speed condition to a ray along the transverse direction, with the established longitudinal factor, fixes the magnitude of the transverse scale. The branch preserving orientation and reducing to the identity makes that scale one. The [construction instrument](ref:sr-04) exposes this as a separate requirement so it is not smuggled into the first step. {#the-transverse-condition}

Each stage answers a different question: the light conditions fix the relation between coefficients, reciprocity relates opposite frame changes, isotropy fixes their equality, and the identity branch selects the sign. Seeing those dependencies is more informative than memorising the final map. {#account-for-each-premise}

## Preserve the pair of events you are comparing {#events-and-measurements}

There is a further distinction between transforming a description and changing a measurement procedure. Take events at opposite ends of a rod lying along the relative-motion axis, simultaneous in the rod's rest frame. At nonzero relative speed, the time-mixing term makes that same pair non-simultaneous in the moving frame. Their transformed spatial separation consequently does not, by itself, give the rod's length measured in that frame. {#endpoint-selection}

A moving-frame length measurement needs endpoint events simultaneous in that moving frame. It therefore selects a different pair from the rod's endpoint worldlines. [The rod-events explanation](ref:special-relativity/arg-sr-rod-events) and [its instrument](ref:sr-03) let these choices be compared. Keeping the physical rod fixed does not require keeping the event-selection rule fixed. {#a-length-needs-a-procedure}

This is why an apparently surprising number should prompt a question about its identity before a correction is attempted. Was the same pair transformed, or were new events selected to perform a different measurement? Both operations can be legitimate, but their outputs answer different questions. {#name-what-was-transformed}

## Follow one wave phase through both descriptions {#one-wave-phase}

In the electrodynamics part of the paper, [the transformed wave is still the same wave](ref:special-relativity/s7-p2). Assigning it the same phase at the same event relates its frequency and propagation direction in the two descriptions. Frequency and direction are not separately fixed; they change together as required by the common phase. {#phase-at-an-event}

{{equation:eq-model-sr-doppler-factor}} {#frequency-ratio}

{{equation:eq-model-sr-aberration}} {#changed-direction}

The direction angle in these formulas belongs to the original frame. For an observer receding along the light's direction, the frequency decreases; for an observer approaching the source along that line, it increases. The corresponding factors are reciprocals for equal speed magnitudes. A ray transverse in the original frame has a frequency factor equal to γ, but aberration makes it non-transverse in the moving frame. “Transverse” therefore needs its frame named. {#angle-and-frame}

Use [the Doppler-and-aberration instrument](ref:sr-09) to inspect those cases together. Changing the frame should not generate a new source wave or silently replace the angle convention. The frequency readout, ray direction and phase description should all refer to the same accepted physical setup. {#inspect-both-readouts}

## Separate a requirement from evidence for it {#postulate-and-test}

The invariant light-propagation law is imposed as a postulate in this construction. Deriving a map from that postulate and checking that the map preserves the light rays tests the construction's consistency. It does not provide independent experimental evidence for the postulate itself. A coincidence found while fitting numbers would not supply the missing logical premise either. {#consistency-is-not-measurement}

The same distinction travels to other work. A loop invariant can constrain a program, a conservation law can check a numerical account, and dimensional consistency can rule out proposed formulas. Each check has force because the preserved property is stated in advance, its scope is clear and the remaining freedom is acknowledged. The examples below keep the limits of those checks beside their useful part. {#carry-the-limits}
