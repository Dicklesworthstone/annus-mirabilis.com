import { describe, expect, it } from "bun:test";
import { parseWithU64, stringifyWithU64 } from "../../experiments/identity/jsonCodec.ts";
import { type U64String, U64ValidationError } from "../../experiments/identity/u64.ts";
import {
  encodeU64QueryParams,
  getU64QueryParam,
  parseU64QueryParams,
  setU64QueryParam,
} from "../../experiments/identity/urlCodec.ts";

describe("JSON and URL Codecs for 64-bit identities", () => {
  describe("JSON Codec", () => {
    it("serializes BigInt/U64 values as canonical strings in declared fields", () => {
      const payload = {
        experimentId: "bm-01",
        seed: 9007199254740993n,
        draws: 18446744073709551615n,
        stepCount: 100, // standard number
      };

      const json = stringifyWithU64(payload, ["seed", "draws"]);
      expect(json).toContain('"seed":"9007199254740993"');
      expect(json).toContain('"draws":"18446744073709551615"');
      expect(json).toContain('"stepCount":100');
    });

    it("parses valid canonical strings for declared u64 fields", () => {
      const json = '{"seed":"9007199254740993","draws":"100","stepCount":100}';
      const parsed = parseWithU64<{ seed: U64String; draws: U64String; stepCount: number }>(json, [
        "seed",
        "draws",
      ]);

      expect(parsed.seed).toBe("9007199254740993" as U64String);
      expect(parsed.draws).toBe("100" as U64String);
      expect(parsed.stepCount).toBe(100);
    });

    it("strictly rejects JSON numbers for declared u64 fields to prevent float truncation", () => {
      // 9007199254740993 as raw JSON number would be parsed as 9007199254740992 by float parser
      const dangerousJson = '{"seed":9007199254740993,"stepCount":10}';

      expect(() => parseWithU64(dangerousJson, ["seed"])).toThrow(U64ValidationError);
      try {
        parseWithU64(dangerousJson, ["seed"]);
      } catch (err: unknown) {
        const valErr = err as U64ValidationError;
        expect(valErr.code).toBe("u64-not-string");
        expect(valErr.message).toContain("JSON number received for u64 field");
      }
    });

    it("strictly rejects non-string types for declared u64 fields in JSON", () => {
      const invalidCases = [
        '{"seed":true}',
        '{"seed":null}',
        '{"seed":{}}',
        '{"seed":[]}',
        '{"seed":"-1"}',
        '{"seed":"01"}',
        '{"seed":"1.0"}',
      ];

      for (const json of invalidCases) {
        expect(() => parseWithU64(json, ["seed"])).toThrow(U64ValidationError);
      }
    });

    it("ensures 9007199254740992 and 9007199254740993 remain distinct across JSON roundtrips", () => {
      const p1 = { seed: "9007199254740992" as U64String };
      const p2 = { seed: "9007199254740993" as U64String };

      const json1 = stringifyWithU64(p1, ["seed"]);
      const json2 = stringifyWithU64(p2, ["seed"]);

      expect(json1).not.toBe(json2);

      const parsed1 = parseWithU64<{ seed: U64String }>(json1, ["seed"]);
      const parsed2 = parseWithU64<{ seed: U64String }>(json2, ["seed"]);

      expect(parsed1.seed).toBe("9007199254740992" as U64String);
      expect(parsed2.seed).toBe("9007199254740993" as U64String);
      expect(parsed1.seed).not.toBe(parsed2.seed);
    });
  });

  describe("URL Codec", () => {
    it("extracts and validates canonical u64 parameters from URLs", () => {
      const url1 = "https://annus-mirabilis.com/lab/bm-01?seed=9007199254740993&view=3d";
      const seed1 = getU64QueryParam(url1, "seed");
      expect(seed1).toBe("9007199254740993" as U64String);

      const url2 = "https://annus-mirabilis.com/lab/bm-01?seed=9007199254740992";
      const seed2 = getU64QueryParam(url2, "seed");
      expect(seed2).toBe("9007199254740992" as U64String);

      expect(seed1).not.toBe(seed2);
    });

    it("returns null when parameter is absent", () => {
      const url = "https://annus-mirabilis.com/lab/bm-01?view=3d";
      expect(getU64QueryParam(url, "seed")).toBeNull();
    });

    it("rejects plus sign formatting anomalies in query strings", () => {
      // ?seed=+1 decodes via URLSearchParams to ' 1' (whitespace) -> must throw
      expect(() =>
        getU64QueryParam("https://annus-mirabilis.com/lab/bm-01?seed=+1", "seed"),
      ).toThrow(U64ValidationError);

      // ?seed=%2B1 decodes to '+1' (sign) -> must throw
      expect(() =>
        getU64QueryParam("https://annus-mirabilis.com/lab/bm-01?seed=%2B1", "seed"),
      ).toThrow(U64ValidationError);

      // ?seed=%201 decodes to ' 1' (leading space) -> must throw
      expect(() =>
        getU64QueryParam("https://annus-mirabilis.com/lab/bm-01?seed=%201", "seed"),
      ).toThrow(U64ValidationError);

      // ?seed=1%20 decodes to '1 ' (trailing space) -> must throw
      expect(() =>
        getU64QueryParam("https://annus-mirabilis.com/lab/bm-01?seed=1%20", "seed"),
      ).toThrow(U64ValidationError);
    });

    it("rejects repeated query parameters", () => {
      const url = "https://annus-mirabilis.com/lab/bm-01?seed=123&seed=456";
      expect(() => getU64QueryParam(url, "seed")).toThrow(U64ValidationError);
      try {
        getU64QueryParam(url, "seed");
      } catch (err: unknown) {
        const valErr = err as U64ValidationError;
        expect(valErr.code).toBe("u64-invalid-format");
        expect(valErr.message).toContain("Repeated query parameter");
      }
    });

    it("encodes query parameters canonically and roundtrips without loss", () => {
      const params = {
        seed: "9007199254740993" as U64String,
        index: 18446744073709551614n,
        view: "split",
        active: true,
      };

      const qs = encodeU64QueryParams(params, ["seed", "index"]);
      expect(qs).toContain("seed=9007199254740993");
      expect(qs).toContain("index=18446744073709551614");
      expect(qs).toContain("view=split");
      expect(qs).toContain("active=true");

      const parsed = parseU64QueryParams(`?${qs}`, ["seed", "index"]);
      expect(parsed.seed).toBe("9007199254740993" as U64String);
      expect(parsed.index).toBe("18446744073709551614" as U64String);
    });

    it("sets canonical u64 parameter on URLSearchParams instance", () => {
      const searchParams = new URLSearchParams("view=2d");
      setU64QueryParam(searchParams, "seed", 9007199254740993n);
      expect(searchParams.get("seed")).toBe("9007199254740993");
    });
  });
});
