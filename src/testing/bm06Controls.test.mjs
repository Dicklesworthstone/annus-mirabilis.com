import test from "node:test";
import assert from "node:assert/strict";
import { formatScaledDecimal, parseScaledDecimal } from "../units/decimalScale.ts";
import { toBm06Draft, fromBm06Draft } from "../experiments/bm06/controls.ts";
import { BM06_DEFAULTS, BM06_PRESETS } from "../experiments/bm06/definition.ts";
import { display } from "../components/lab/presentation.ts";

test("all presets roundtrip exactly through human display units", () => {
 for (const preset of Object.values(BM06_PRESETS)) assert.deepEqual(fromBm06Draft(toBm06Draft(preset.parameters)),preset.parameters);
 assert.equal(toBm06Draft(BM06_DEFAULTS).dx,"0.1");
 assert.equal(fromBm06Draft({...toBm06Draft(BM06_DEFAULTS),dx:"0.1"}).dx,1e-7);
});
test("an unchanged physical field does not drift when the interval is edited", () => {
 const parameters={...BM06_DEFAULTS,a:1.00017e-7,dx:1.00017e-7};
 assert.notEqual((parameters.a*1e6)/1e6,parameters.a); // Regression witness for naive conversion.
 const draft=toBm06Draft(parameters);draft.lower="0";
 const changed=fromBm06Draft(draft);
 for (const key of Object.keys(parameters)) if(key!=="lower") assert.equal(changed[key],parameters[key]);
});
test("decimal scaling roundtrips across binary64 exponents and unit powers", () => {
 for (const power of [-12,-6,0,3,6,12]) for (const value of [0,1,-1,Number.MIN_VALUE,Number.MAX_VALUE,...Array.from({length:601},(_,i)=>Number(`1.234567890123456e${i-300}`))]) {
  assert.equal(parseScaledDecimal(formatScaledDecimal(value,power),power),value);
 }
});
test("nonfinite input, nonzero underflow and malformed decimals are refused", () => {
 for(const value of ["", "abc", "Infinity", "NaN", "1e400", "1e-400", "1e99999999999999999999", "0x10"]) assert.throws(()=>parseScaledDecimal(value,0));
 assert.equal(parseScaledDecimal("0e-400",0),0);
 assert.throws(()=>formatScaledDecimal(Infinity,6));
});
test("unit display does not fabricate infinity or zero at extreme scales", () => {
 assert.equal(display(1e307,1e12),"1e319");
 assert.notEqual(display(Number.MIN_VALUE,1e-6),"0");
 assert.equal(display(4.294395645549615e-13,1e12),"0.42944");
});

test("rounding the largest finite value cannot overflow the reader's display", () => {
 assert.equal(display(Number.MAX_VALUE), "1.7977e308");
 assert.equal(display(Number.MAX_VALUE, 1e12), "1.7977e320");
 assert.equal(display(-Number.MAX_VALUE, 1e-6), "-1.7977e302");
});
