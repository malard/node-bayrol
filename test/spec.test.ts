import { describe, expect, it } from "vitest";
import {
  ALARMS,
  MEASUREMENTS,
  PARAMETERS,
  decodeRaw,
  getAlarmSpec,
  getMeasurementSpec,
  getParameterSpec,
} from "../src/spec.js";

describe("spec", () => {
  it("MEASUREMENTS keys are unique", () => {
    const keys = MEASUREMENTS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("PARAMETERS keys are unique", () => {
    const keys = PARAMETERS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ALARMS keys are unique", () => {
    const keys = ALARMS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("addresses fall in the documented banks", () => {
    for (const m of MEASUREMENTS) {
      expect(m.address).toBeGreaterThanOrEqual(4001);
      expect(m.address).toBeLessThanOrEqual(4099);
    }
    for (const p of PARAMETERS) {
      expect(p.address).toBeGreaterThanOrEqual(3001);
      expect(p.address).toBeLessThanOrEqual(3099);
    }
    for (const a of ALARMS) {
      expect(a.address).toBeGreaterThanOrEqual(2001);
      expect(a.address).toBeLessThanOrEqual(2099);
    }
  });

  it("getMeasurementSpec returns the spec for a known key", () => {
    expect(getMeasurementSpec("ph").address).toBe(4001);
    expect(getMeasurementSpec("redox").unit).toBe("mV");
  });

  it("getMeasurementSpec throws on unknown key", () => {
    expect(() => getMeasurementSpec("nope" as never)).toThrow(/unknown measurement key/);
  });

  it("getParameterSpec returns the spec for a known key", () => {
    expect(getParameterSpec("ph_setpoint").address).toBe(3001);
  });

  it("getAlarmSpec returns the spec for a known key", () => {
    expect(getAlarmSpec("collective").address).toBe(2001);
  });
});

describe("decodeRaw", () => {
  it("matches the spec's worked examples", () => {
    // From the PDF: raw 720 with decimals=2 -> 7.20.
    expect(decodeRaw(720, 2)).toBe(7.2);
    // Raw 250 with decimals=1 -> 25.0.
    expect(decodeRaw(250, 1)).toBe(25);
    // Raw 650 with decimals=0 -> 650.
    expect(decodeRaw(650, 0)).toBe(650);
  });

  it("matches the live-probe pH reading", () => {
    // 2026-05-07: live PM5 returned raw 730 for register 4001 (pH), shown as 7.30.
    expect(decodeRaw(730, 2)).toBe(7.3);
  });
});
