import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evidenceFromPrepared } from "./evidence.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";
import { RADIUS_EXAMPLE } from "./model.ts";
import { renderInferenceWorkbench, renderRadiusResults, renderCameraResults } from "./render.ts";
import { inferenceText, renderCameraMoments, renderInferenceFamily } from "../../components/lab/inferenceView.ts";
import { createBm07Session } from "../../experiments/bm07/session.ts";
import { createBm08Session } from "../../experiments/bm08/session.ts";
const read=(id)=>JSON.parse(readFileSync(new URL(`../../generated/${id}-example.json`,import.meta.url),"utf8"));
const bm07=read("bm07"),bm08=read("bm08");
const ideal=evidenceFromPrepared("ideal",bm07,"a".repeat(64)),camera=evidenceFromPrepared("camera",bm08,"b".repeat(64));
const example={ideal,camera,sourceDigest:`source:sha256:${"c".repeat(64)}`};
const html=renderInferenceWorkbench(example,"test");

test("both families and optional worked solutions are present before hydration",()=>{
 for(const text of ["Can displacements tell radius", "Motion or localization error", "data-static-radius", "data-static-camera", "Static worked example", "data-observation-evidence", "data-result-status=\"underdetermined\"", "data-result-status=\"not-applicable\""])
  assert.ok(html.includes(text),text);
 assert.equal((html.match(/<fieldset disabled/g)||[]).length,2);
 assert.equal((html.match(/<svg /g)||[]).length,2);
 assert.equal((html.match(/data-observation-evidence/g)||[]).length,2);
 assert.ok(!/<script\b|\son\w+=/i.test(html));
});
test("labels are explicit siblings, not value-bearing control containers",()=>{
 assert.ok(!/<label[^>]*>[^<]*<input/.test(html));
 assert.equal((html.match(/data-radius-field=/g)||[]).length,5);
 assert.equal((html.match(/data-camera-information/g)||[]).length,3);
 for(const id of ["test-radius","test-radiusLower","test-radiusUpper","test-radiusCoverage","test-provenance","test-covariance"])
  assert.ok(html.includes(`for="${id}"`));
});
test("untrusted provenance and placement cannot inject markup",()=>{
 assert.throws(()=>renderInferenceWorkbench(example,'bad" onclick="bad'),/Invalid/);
 assert.equal(inferenceText('<img src="x"> & \'text\''),"&lt;img src=&quot;x&quot;&gt; &amp; &#39;text&#39;");
 const session=createRadiusSession("test",ideal);
 session.apply({...RADIUS_EXAMPLE,provenance:'<img src=x onerror="evil()">'});
 const rendered=renderRadiusResults(session.getSnapshot().accepted);
 assert.ok(rendered.includes("&lt;img"));assert.ok(!rendered.includes("<img"));
});
test("camera moment solutions never acquire an independent-increment interval",()=>{
 const session=createCameraInferenceSession("test",camera);
 for(const information of ["variance","covariance","second-interval"]){
  session.apply({information});const rendered=renderCameraResults(session.getSnapshot().accepted);
  assert.ok(rendered.includes("point estimates, not confidence intervals"));
  assert.ok(!rendered.includes("Camera model</th>")); // Hidden generator parameters are not shown.
 }
});
test("the original BM-07 family and BM-08 moments use the shared renderer",()=>{
 const factory=()=>{throw new Error("No Worker may be started by a static view.");};
 const oldRadius=createBm07Session("old-radius",bm07,factory).getSnapshot().accepted;
 const oldCamera=createBm08Session("old-camera",bm08,factory).getSnapshot().accepted;
 const family=renderInferenceFamily(oldRadius),moments=renderCameraMoments(oldCamera);
 assert.equal((family.match(/data-family-curve/g)||[]).length,1);
 assert.ok(family.includes("not a confidence region"));assert.ok(moments.includes("Asymptotic sampling SD"));
 assert.ok(moments.includes('data-output="expectedVariance"'));assert.ok(moments.includes('data-output="sdCovariance"'));
 const familyComponent=readFileSync(new URL("../../components/lab/InferencePlots.tsx",import.meta.url),"utf8");
 const cameraComponent=readFileSync(new URL("../../components/lab/CameraLab.tsx",import.meta.url),"utf8");
 assert.ok(familyComponent.includes("renderInferenceFamily(snapshot)"));
 assert.ok(cameraComponent.includes("<CameraMomentTable snapshot={snapshot}"));
});
test("all tabular scroll regions are named and keyboard focusable",()=>{
 const containers=html.match(/<div class="table-scroll"[^>]*>/g)||[];assert.ok(containers.length>=5);
 for(const tag of containers){assert.ok(tag.includes('role="region"'));assert.ok(tag.includes('aria-label='));assert.ok(tag.includes('tabindex="0"'));}
});
test("deferred companion case contains no invented numbers or blocked questions",()=>{
 const companion=html.split("data-infer-companion>")[1].split("</section>")[0];
 assert.ok(companion.includes("The second measurement, from the viscosity of dilute solutions, is in preparation."));
 assert.ok(!/\d/.test(companion.replace(/<[^>]*>/g,"")));
 assert.ok(html.includes("No independent radius has been admitted"));
});
