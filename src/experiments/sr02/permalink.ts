/**
 * THE ONE DECLARED MODE ON THE SITE, MADE REACHABLE BY URL (am-f3e4 follow-on, dispatch 359).
 *
 * `DECLARED_MODES` carries exactly one entry, sr-02's `apparatus`, and this laboratory implements
 * it: MagnetConductorLab branches on `p.mode === "apparatus"` and stamps
 * `data-instrument-id="sr-02:apparatus"` on its root when a reader is in it. Until this module the
 * site declared that address, wrote it into the DOM, and could not serve it: `src/experiments/sr02/`
 * held no permalink, so a reader who reached the apparatus view could not link to it, bookmark it,
 * return to it or send it to anyone.
 *
 * THE CATALOGUE IS THE AUTHORITY, not a second string comparison here. `decodeSr02Settings` builds
 * the address `sr-02:<mode>` and hands it to `resolveCatalogueAddress`, so the set of linkable modes
 * is whatever `DECLARED_MODE_OVERRIDES` declares and cannot drift from it. Declaring another mode
 * there makes it linkable here with no change to this file; undeclaring `apparatus` makes this
 * module refuse it, which is the coupling that keeps the two from disagreeing.
 *
 * `analytic` IS NOT A DECLARED MODE and a link naming it is refused, although it is the state this
 * laboratory starts in. That is deliberate: the catalogue addresses the states a reader can ASK for,
 * and the default state's address is the bare `sr-02`.
 *
 * THIS MODULE DECODES AND DOES NOT ENCODE, which is the one-share-control invariant
 * (src/testing/oneShareControl.test.ts): a laboratory that shares a `?tape=` link offers that link
 * only, and its older settings link still LOADS when opened because the decoder stays. ec26d8d2
 * shipped an `encodeSr02Settings` beside the tape link and gave sr-02 two share controls, which is
 * the defect that test exists to stop; it held HEAD red and refused a deploy. The encoder is gone
 * and nothing is lost, because `mode` is an sr-02 parameter and the tape already carries it: a tape
 * built at `mode: "apparatus"` has `initialConditions.mode === "apparatus"`, and following that one
 * link lands with `data-instrument-id="sr-02:apparatus"` stamped.
 *
 * WITHOUT JAVASCRIPT THIS DOES NOTHING, and the laboratory says so rather than pretending. The site
 * is a static export (`output: "export"`), so a server component cannot read `searchParams` and no
 * page in `src/app` does; the query is read in the browser, as it is for the four laboratories that
 * already consume one (sr-06, sr-12, me-03, lq-09). A no-JavaScript reader following
 * `/lab/sr-02/?mode=apparatus` gets the default worked example, and the laboratory's noscript notice
 * names that limit.
 */
import { resolveCatalogueAddress } from "../catalogue.ts";
import { SR02_DEFAULTS, type Sr02Parameters } from "./definition.ts";
import { validateSr02Parameters } from "./parameters.ts";

export type Sr02PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr02Parameters }
  | { kind: "invalid"; message: string; requested: string };

/**
 * Reads `?mode=` and returns the parameters to apply, or a refusal naming what was asked for.
 * `base` is the state the mode is applied to, so a link changes the mode and nothing else; it
 * defaults to this laboratory's declared defaults.
 */
export function decodeSr02Settings(
  search: string,
  base: Sr02Parameters = SR02_DEFAULTS,
): Sr02PermalinkResult {
  if (!search || search === "?") return { kind: "none" };
  const requested = new URLSearchParams(search).get("mode");
  if (requested === null) return { kind: "none" };
  const resolved = resolveCatalogueAddress(`sr-02:${requested}`);
  if ("error" in resolved) {
    return {
      kind: "invalid",
      requested,
      // The resolver's own sentence, which names the declared modes, rather than a second wording
      // of the same refusal that could fall out of step with it.
      message: `This link asks for a view this laboratory does not offer: ${resolved.error}. The settings below are the worked example, not the link's.`,
    };
  }
  const checked = validateSr02Parameters({ ...base, mode: resolved.mode ?? base.mode });
  if (checked.kind !== "accepted") {
    return {
      kind: "invalid",
      requested,
      message: "The link settings are outside the model domain.",
    };
  }
  return { kind: "settings", parameters: checked.data };
}
