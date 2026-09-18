import {describe,expect,test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import generated from "../../generated/missing-steps.json";
import type {CompiledMissingStepLesson} from "./compiled.ts";
import {MissingStepDisclosure,MissingStepPanel} from "./MissingStepPanel.tsx";
const lesson=generated.lessons[0] as CompiledMissingStepLesson | undefined;
if(!lesson)throw new Error("Prepare the scaffold's missing-step content before running these rendering tests.");
const example=lesson;
describe("missing-step reader content",()=>{
 test("renders four keyboard links and four complete native disclosures",()=>{
  const html=renderToStaticMarkup(<MissingStepDisclosure lesson={example}/>);
  expect(html.match(/data-clarification-open=/g)?.length).toBe(4);
  for(const step of example.steps)expect(html).toContain(`id="static-${step.id}"`);
  expect(html).toContain("also works without JavaScript");expect(html).toContain("not the paper’s printed calculation");
 });
 test("both sides mark the precise cross subtree without color dependence",()=>{
  const step=example.steps.find(s=>s.id==="bm-variance-cross");if(!step)throw new Error("Cross step absent.");
  const html=renderToStaticMarkup(<MissingStepPanel lesson={example} step={step}/>);
  expect(html.match(/data-expression-id="crossTerm"/g)?.length).toBe(2);
  expect(html.match(/<math /g)?.length).toBe(2);
  expect(html).toContain("the cross-term average");expect(html).toContain("The increments A and B are independent.");
  expect(html).toContain("Each increment has mean zero.");
 });
 test("enumerated alternatives have headed, keyboard-scrollable tables",()=>{
  const step=example.steps[0];if(!step)throw new Error("Expansion absent.");
  const html=renderToStaticMarkup(<MissingStepPanel lesson={example} step={step}/>);
  expect(html.match(/<table>/g)?.length).toBe(3);
  expect(html.match(/scope="col"/g)?.length).toBe(18);
  expect(html).toContain("Always the same direction");expect(html).toContain("Always opposite directions");
  expect(html).toContain("not observations or simulated Brownian paths");
  expect(html).toContain('tabindex="0"');
 });
 test("author prose is escaped and never evaluated as HTML",()=>{
  const step=example.steps[0];if(!step)throw new Error("Expansion absent.");
  const html=renderToStaticMarkup(<MissingStepPanel lesson={{...example,sourceNotice:'<script>bad()</script>'}} step={step}/>);
  expect(html).not.toContain("<script>");expect(html).toContain("&lt;script&gt;");
 });
});
