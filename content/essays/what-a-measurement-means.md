## Start with the record {#start-with-the-record}

A clock reading, a particle position and a sensor voltage are records made by particular devices under particular conditions. To report a time at another place, a displacement over an interval or a temperature, we also need a rule connecting those records to the named quantity. Putting that rule on the page makes its assumptions available for inspection. {#records-and-rules}

This distinction does not make measurement arbitrary. A procedure can be repeated, instruments can be compared, and a model can fail against a recorded result. It does mean that a numerical answer is incomplete until we know which operations produced it and which inference gave it its meaning. {#repeatable-procedures}

## Clock readings at two places {#two-clocks}

At the start of the relativity paper, Einstein asks [what physical meaning to give the time in a description of motion](ref:special-relativity/s1-p3). A nearby event and a clock reading can be compared at the same place. A distant event presents another question: the time its light reaches an observer depends on where that observer is. [Reception time therefore cannot silently stand in for a shared time at the event's location](ref:special-relativity/s1-p6). {#local-and-distant}

Section 1 specifies a procedure. A light signal leaves A when the clock there reads tₐ, reflects at B when the clock there reads tᵦ, and returns to A when A's clock reads t′ₐ. The departure and return are local events beside the same clock. Reflection is a local event beside B's clock. To coordinate the two clocks, [Einstein defines synchronism by equality of the assigned outward and return travel times](ref:special-relativity/s1-p7). {#clock-procedure}

{{equation:eq-model-sr-sync-equal-legs}} {#clock-equation}

The display uses the site's modern teaching notation: A's return reading carries the word “return” where the paper puts a prime. The equation assigns B's reflection event the midpoint of the two A readings. Its two sides are not separately measured travel times obtained before the clocks have been coordinated. Equal assigned times are the stipulation defining their synchronisation. The paper then [assumes that this definition can be applied consistently across a system of clocks](ref:special-relativity/s1-p8). {#synchronisation-stipulation}

In [the clock-synchronisation instrument](ref:sr-01), follow departure, reflection and reception separately. Ask which reading occurs next to which clock, then ask which remote time has been assigned. This separates a signal's arrival from the procedure that gives distant events a common time coordinate. The physical claims of the theory still depend on its stated assumptions; a change of labels alone is not a new prediction. {#try-clock-procedure}

## A displacement names an interval {#displacement-interval}

The Brownian-motion paper gives a different example. It describes a distribution of coordinate displacements over a specified elapsed time. Einstein identifies [the root of the mean squared displacement](ref:brownian-motion/s4-p11): square the signed coordinate changes, average them, then take the square root. A signed average can cancel; the root-mean-square quantity measures the spread. Neither is the total length of a particle's unobserved winding path. {#displacement-statistic}

Within the ideal diffusion model, the root-mean-square coordinate displacement grows with the square root of the elapsed time. Dividing it by that time gives an apparent coordinate speed proportional to the inverse square root of the observation interval. A smaller interval gives a larger apparent speed even though the same diffusion coefficient describes the process. {#apparent-speed}

{{equation:eq-model-bm-apparent-speed}} {#apparent-speed-equation}

This is a consequence of the ideal model, not an explicit warning about instantaneous velocity quoted from the 1905 paper. The paper's stated qualification is that [the intervals used in its construction must be long enough for successive motions to be treated as independent](ref:brownian-motion/s4-p3). Extending the diffusion description to arbitrarily short times would discard that qualification. The limiting expression is not a measurement of an actual infinite particle velocity. {#interval-limit}

Use [the Brownian displacement instrument](ref:bm-01) to vary the interval and compare displacement with apparent speed. Keep the distinction between an ensemble statistic and one measured displacement. Then [inspect the observation workbench](ref:bm-08), where the observation procedure itself can change: finite exposure and position noise belong in the account of what was recorded. {#try-displacements}

## Questions a measurement can answer {#measurement-questions}

For each example, three questions make the claim more precise. They are prompts for this reading, rather than a reconstructed account of how Einstein discovered a result. {#questions-introduction}

- What event or signal was actually recorded, and where?
- Which rule turns that record into the reported quantity?
- Which assumptions would have to be checked before comparing it with another measurement?
{#questions-to-ask}

The useful transfer is to keep those parts visible. A clock convention, a statistical observable and an instrument calibration solve different problems. In each case, an explicit procedure helps identify both what a result says and what further information it would need. {#measurement-transfer}
