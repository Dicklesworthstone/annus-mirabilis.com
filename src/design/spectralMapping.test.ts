import { describe, expect, test } from "bun:test";
import {
  FALSE_COLOR_BANDS,
  frequencyHzToWavelengthNm,
  frequencyTHzToWavelengthNm,
  getSpectralBand,
  isLegitimateSpectralColorSymbol,
  LEGITIMATE_SPECTRAL_COLOR_SYMBOLS,
  PHYSICAL_SPECTRAL_ANCHORS,
  resolveSpectralColor,
  SPECTRAL_CALL_SITE_EXEMPTIONS,
  SPECTRAL_MAPPING_MODULE_SPECIFIER,
  SPEED_OF_LIGHT_KM_PER_S,
  SPEED_OF_LIGHT_M_PER_S,
  spectralColor,
  spectralColorFromFrequency,
  spectralColorFromFrequencyHz,
  VISIBLE_BAND_NM,
  wavelengthNmToFrequencyHz,
  wavelengthNmToFrequencyTHz,
} from "./spectralMapping";

describe("VISIBLE_BAND_NM: the declared boundary and its source", () => {
  test("is 380-780 nm with a non-empty recorded source", () => {
    expect(VISIBLE_BAND_NM.min).toBe(380);
    expect(VISIBLE_BAND_NM.max).toBe(780);
    expect(VISIBLE_BAND_NM.source.length).toBeGreaterThan(0);
  });
});

describe("spectralColor: a wavelength sweep at 5 nm steps across and beyond the band", () => {
  test("below the band is outside-visible on the ultraviolet side", () => {
    for (let nm = 100; nm < VISIBLE_BAND_NM.min; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("outside-visible");
      if (result.kind === "outside-visible") expect(result.side).toBe("ultraviolet");
    }
  });

  test("above the band is outside-visible on the infrared side", () => {
    for (let nm = VISIBLE_BAND_NM.max + 1; nm <= 1200; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("outside-visible");
      if (result.kind === "outside-visible") expect(result.side).toBe("infrared");
    }
  });

  test("strictly inside the band is always a visible color, a real #rrggbb string", () => {
    for (let nm = VISIBLE_BAND_NM.min + 1; nm < VISIBLE_BAND_NM.max; nm += 5) {
      const result = spectralColor(nm);
      expect(result.kind).toBe("visible");
      if (result.kind === "visible") expect(result.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("exactly at each boundary is declared: both endpoints are visible (the band is closed)", () => {
    expect(spectralColor(VISIBLE_BAND_NM.min).kind).toBe("visible");
    expect(spectralColor(VISIBLE_BAND_NM.max).kind).toBe("visible");
    expect(spectralColor(VISIBLE_BAND_NM.min - 1).kind).toBe("outside-visible");
    expect(spectralColor(VISIBLE_BAND_NM.max + 1).kind).toBe("outside-visible");
  });

  test("rejects non-finite wavelengths with a RangeError", () => {
    expect(() => spectralColor(Number.NaN)).toThrow(RangeError);
    expect(() => spectralColor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("spectralColor: recognizable landmark hues", () => {
  test("blue light (~450nm) has a dominant blue channel", () => {
    const result = spectralColor(450);
    if (result.kind !== "visible") throw new Error("expected visible");
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    expect(b).toBeGreaterThan(r);
  });

  test("red light (~700nm) has a dominant red channel", () => {
    const result = spectralColor(700);
    if (result.kind !== "visible") throw new Error("expected visible");
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  test("green light (~550nm) has a dominant green channel", () => {
    const result = spectralColor(550);
    if (result.kind !== "visible") throw new Error("expected visible");
    const g = Number.parseInt(result.color.slice(3, 5), 16);
    const r = Number.parseInt(result.color.slice(1, 3), 16);
    const b = Number.parseInt(result.color.slice(5, 7), 16);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
});

describe("Physical spectroscopic anchors: real values with historical citations", () => {
  test("Sodium D lines are yellow with high red and green channels (589 nm)", () => {
    const { sodiumD1, sodiumD2, sodiumDMean } = PHYSICAL_SPECTRAL_ANCHORS;

    // Check wavelength validity against citable values
    expect(sodiumD2.wavelengthNm).toBeCloseTo(589.0, 1);
    expect(sodiumD1.wavelengthNm).toBeCloseTo(589.59, 2);
    expect(sodiumDMean.wavelengthNm).toBe(589.3);

    // Check citations
    expect(sodiumD2.citation).toContain("NIST");
    expect(sodiumD1.citation).toContain("NIST");
    expect(sodiumDMean.citation).toContain("NIST");

    // Check physical color output
    const resD2 = spectralColor(sodiumD2.wavelengthNm);
    const resD1 = spectralColor(sodiumD1.wavelengthNm);
    const resMean = spectralColor(sodiumDMean.wavelengthNm);

    expect(resD2.kind).toBe("visible");
    expect(resD1.kind).toBe("visible");
    expect(resMean.kind).toBe("visible");

    if (resMean.kind === "visible") {
      const r = Number.parseInt(resMean.color.slice(1, 3), 16);
      const g = Number.parseInt(resMean.color.slice(3, 5), 16);
      const b = Number.parseInt(resMean.color.slice(5, 7), 16);
      // Yellow light has high red and green, minimal blue
      expect(r).toBeGreaterThan(200);
      expect(g).toBeGreaterThan(180);
      expect(b).toBe(0);
    }
  });

  test("Hydrogen Balmer series yields distinct physical optical spectral colors", () => {
    const { hydrogenAlpha, hydrogenBeta, hydrogenGamma, hydrogenDelta } = PHYSICAL_SPECTRAL_ANCHORS;

    // Citations to Balmer (1885)
    expect(hydrogenAlpha.citation).toContain("Balmer (1885)");
    expect(hydrogenBeta.citation).toContain("Balmer (1885)");
    expect(hydrogenGamma.citation).toContain("Balmer (1885)");
    expect(hydrogenDelta.citation).toContain("Balmer (1885)");

    // Balmer Alpha (656.28 nm): deep red (Fraunhofer C line)
    const resAlpha = spectralColor(hydrogenAlpha.wavelengthNm);
    expect(resAlpha.kind).toBe("visible");
    if (resAlpha.kind === "visible") {
      const r = Number.parseInt(resAlpha.color.slice(1, 3), 16);
      const g = Number.parseInt(resAlpha.color.slice(3, 5), 16);
      const b = Number.parseInt(resAlpha.color.slice(5, 7), 16);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(resAlpha.color).toBe("#ff0000");
    }

    // Balmer Beta (486.13 nm): cyan / blue-green (Fraunhofer F line)
    const resBeta = spectralColor(hydrogenBeta.wavelengthNm);
    expect(resBeta.kind).toBe("visible");
    if (resBeta.kind === "visible") {
      const r = Number.parseInt(resBeta.color.slice(1, 3), 16);
      const g = Number.parseInt(resBeta.color.slice(3, 5), 16);
      const b = Number.parseInt(resBeta.color.slice(5, 7), 16);
      expect(r).toBe(0);
      expect(g).toBeGreaterThan(200);
      expect(b).toBe(255);
    }

    // Balmer Gamma (434.05 nm): violet / blue-violet (Fraunhofer G' line)
    const resGamma = spectralColor(hydrogenGamma.wavelengthNm);
    expect(resGamma.kind).toBe("visible");
    if (resGamma.kind === "visible") {
      const r = Number.parseInt(resGamma.color.slice(1, 3), 16);
      const g = Number.parseInt(resGamma.color.slice(3, 5), 16);
      const b = Number.parseInt(resGamma.color.slice(5, 7), 16);
      expect(b).toBe(255);
      expect(g).toBe(0);
      expect(r).toBeGreaterThan(0);
    }

    // Balmer Delta (410.17 nm): deep violet
    const resDelta = spectralColor(hydrogenDelta.wavelengthNm);
    expect(resDelta.kind).toBe("visible");
    if (resDelta.kind === "visible") {
      const r = Number.parseInt(resDelta.color.slice(1, 3), 16);
      const g = Number.parseInt(resDelta.color.slice(3, 5), 16);
      const b = Number.parseInt(resDelta.color.slice(5, 7), 16);
      expect(b).toBeGreaterThan(r);
      expect(g).toBe(0);
    }
  });

  test("Mercury green line (546.07 nm) yields dominant green calibration color", () => {
    const { mercuryGreen } = PHYSICAL_SPECTRAL_ANCHORS;
    expect(mercuryGreen.citation).toContain("NIST");
    const resHg = spectralColor(mercuryGreen.wavelengthNm);
    expect(resHg.kind).toBe("visible");
    if (resHg.kind === "visible") {
      const g = Number.parseInt(resHg.color.slice(3, 5), 16);
      expect(g).toBe(255);
    }
  });

  test("Helium D3 line (587.56 nm) yields historic solar yellow-orange line", () => {
    const { heliumD3 } = PHYSICAL_SPECTRAL_ANCHORS;
    expect(heliumD3.citation).toContain("Lockyer (1868)");
    const resHe = spectralColor(heliumD3.wavelengthNm);
    expect(resHe.kind).toBe("visible");
  });
});

describe("Frequency in, color out: exact physical conversion", () => {
  test("speed of light constants match SI definition", () => {
    expect(SPEED_OF_LIGHT_M_PER_S).toBe(299792458);
    expect(SPEED_OF_LIGHT_KM_PER_S).toBe(299792.458);
  });

  test("frequency in THz maps to accurate wavelength and color", () => {
    // 508.73 THz corresponds to ~589.3 nm (Sodium D)
    const lambdaNm = frequencyTHzToWavelengthNm(508.73);
    expect(lambdaNm).toBeCloseTo(589.3, 1);

    const resFromFreq = spectralColorFromFrequency(508.73);
    const resFromWavelength = spectralColor(lambdaNm);
    expect(resFromFreq).toEqual(resFromWavelength);
  });

  test("frequency in Hz maps to accurate wavelength and color", () => {
    // 5.0873e14 Hz = 508.73 THz
    const lambdaNm = frequencyHzToWavelengthNm(5.0873e14);
    expect(lambdaNm).toBeCloseTo(589.3, 1);

    const resFromHz = spectralColorFromFrequencyHz(5.0873e14);
    expect(resFromHz.kind).toBe("visible");
    const res589 = spectralColor(589.3);
    if (resFromHz.kind === "visible" && res589.kind === "visible") {
      expect(resFromHz.color).toBe(res589.color);
    }
  });

  test("round-trip wavelength <-> frequency conversions are exact", () => {
    const testWavelengths = [400, 500, 589.3, 650, 750];
    for (const w of testWavelengths) {
      const nuTHz = wavelengthNmToFrequencyTHz(w);
      const backW = frequencyTHzToWavelengthNm(nuTHz);
      expect(backW).toBeCloseTo(w, 4);

      const nuHz = wavelengthNmToFrequencyHz(w);
      const backWFromHz = frequencyHzToWavelengthNm(nuHz);
      expect(backWFromHz).toBeCloseTo(w, 4);
    }
  });

  test("resolveSpectralColor polymorphic dispatch works for all supported shapes", () => {
    const fromNum = resolveSpectralColor(550);
    const fromWavelength = resolveSpectralColor({ wavelengthNm: 550 });
    const fromTHz = resolveSpectralColor({ frequencyTHz: wavelengthNmToFrequencyTHz(550) });
    const fromHz = resolveSpectralColor({ frequencyHz: wavelengthNmToFrequencyHz(550) });

    expect(fromNum).toEqual(fromWavelength);
    expect(fromNum).toEqual(fromTHz);
    expect(fromNum).toEqual(fromHz);
  });

  test("frequency conversion rejects invalid inputs with RangeError", () => {
    expect(() => frequencyTHzToWavelengthNm(0)).toThrow(RangeError);
    expect(() => frequencyTHzToWavelengthNm(-10)).toThrow(RangeError);
    expect(() => frequencyTHzToWavelengthNm(Number.NaN)).toThrow(RangeError);

    expect(() => frequencyHzToWavelengthNm(0)).toThrow(RangeError);
    expect(() => wavelengthNmToFrequencyTHz(-500)).toThrow(RangeError);
    expect(() => wavelengthNmToFrequencyHz(0)).toThrow(RangeError);
  });
});

describe("Canonical spectral band classifier (getSpectralBand)", () => {
  test("ultraviolet frequency (> 789 THz) returns false-color UV band", () => {
    const band = getSpectralBand({ frequencyTHz: 850 });
    expect(band.band).toBe("ultraviolet");
    expect(band.isVisible).toBe(false);
    expect(band.isFalseColor).toBe(true);
    expect(band.color).toBe(FALSE_COLOR_BANDS.ultraviolet.hex);
    expect(band.falseColorReason).toBeDefined();
  });

  test("infrared frequency (< 384 THz) returns false-color IR band", () => {
    const band = getSpectralBand({ frequencyTHz: 350 });
    expect(band.band).toBe("infrared");
    expect(band.isVisible).toBe(false);
    expect(band.isFalseColor).toBe(true);
    expect(band.color).toBe(FALSE_COLOR_BANDS.infrared.hex);
    expect(band.falseColorReason).toBeDefined();
  });

  test("visible optical frequencies return real physical colors without false-color flag", () => {
    const greenBand = getSpectralBand(550);
    expect(greenBand.band).toBe("green");
    expect(greenBand.isVisible).toBe(true);
    const res550 = spectralColor(550);
    if (res550.kind === "visible") {
      expect(greenBand.color).toBe(res550.color);
    }

    const redBand = getSpectralBand(656);
    expect(redBand.band).toBe("red");
    expect(redBand.isVisible).toBe(true);
    expect(redBand.isFalseColor).toBe(false);

    const blueBand = getSpectralBand(460);
    expect(blueBand.band).toBe("blue");
    expect(blueBand.isVisible).toBe(true);
    expect(blueBand.isFalseColor).toBe(false);

    const yellowBand = getSpectralBand(580);
    expect(yellowBand.band).toBe("yellow");
    expect(yellowBand.isVisible).toBe(true);
    expect(yellowBand.isFalseColor).toBe(false);
  });

  test("accepts bare number, wavelength object, or frequency object", () => {
    const b1 = getSpectralBand(589.3);
    const b2 = getSpectralBand({ wavelengthNm: 589.3 });
    const b3 = getSpectralBand({ frequencyTHz: wavelengthNmToFrequencyTHz(589.3) });

    expect(b1.band).toBe("yellow");
    expect(b2.band).toBe("yellow");
    expect(b3.band).toBe("yellow");
    expect(b1.color).toBe(b2.color);
    expect(b1.color).toBe(b3.color);
  });
});

describe("Exemption mechanism & allowlists for raw-hex ratchet", () => {
  test("module specifier is canonical and accurate", () => {
    expect(SPECTRAL_MAPPING_MODULE_SPECIFIER).toBe("src/design/spectralMapping.ts");
  });

  test("LEGITIMATE_SPECTRAL_COLOR_SYMBOLS lists all authorized producers", () => {
    expect(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS).toContain("spectralColor");
    expect(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS).toContain("spectralColorFromFrequency");
    expect(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS).toContain("getSpectralBand");
    expect(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS).toContain("PHYSICAL_SPECTRAL_ANCHORS");
    expect(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS).toContain("FALSE_COLOR_BANDS");
  });

  test("isLegitimateSpectralColorSymbol validates legitimate symbols and rejects arbitrary ones", () => {
    expect(isLegitimateSpectralColorSymbol("spectralColor")).toBe(true);
    expect(isLegitimateSpectralColorSymbol("getSpectralBand")).toBe(true);
    expect(isLegitimateSpectralColorSymbol("PHYSICAL_SPECTRAL_ANCHORS")).toBe(true);

    expect(isLegitimateSpectralColorSymbol("arbitraryPalette")).toBe(false);
    expect(isLegitimateSpectralColorSymbol("randomHexColor")).toBe(false);
  });

  test("SPECTRAL_CALL_SITE_EXEMPTIONS provides structured rationale for every legitimate symbol", () => {
    expect(SPECTRAL_CALL_SITE_EXEMPTIONS.length).toBe(LEGITIMATE_SPECTRAL_COLOR_SYMBOLS.length);
    for (const ex of SPECTRAL_CALL_SITE_EXEMPTIONS) {
      expect(ex.module).toBe("src/design/spectralMapping.ts");
      expect(ex.symbol.length).toBeGreaterThan(0);
      expect(ex.rationale.length).toBeGreaterThan(15);
    }
  });
});

describe("spectralColor: theme independence (a fixture sweep, not a screenshot)", () => {
  test("calling spectralColor takes no theme argument and needs none: it is the same function call regardless of which theme's tokens are loaded elsewhere in the process", () => {
    const wavelengths = [400, 450, 500, 550, 600, 650, 700, 750];
    for (const nm of wavelengths) {
      expect(spectralColor(nm)).toEqual(spectralColor(nm));
    }
  });
});
