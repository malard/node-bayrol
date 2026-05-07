// Unit tests for PoolManager. The Modbus transport is faked at the
// `modbus-serial` boundary so these run without a device.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoolManager } from "../src/pool-manager.js";
import { ALARMS, MEASUREMENTS, PARAMETERS } from "../src/spec.js";
import { BayrolModbusError } from "../src/errors.js";

type FakeReply<T> = { data: T[] };

function modbusException(code: number): Error & { modbusCode: number } {
  const e = new Error(`fake modbus exception ${code}`) as Error & { modbusCode: number };
  e.modbusCode = code;
  return e;
}

const fake = {
  setID: vi.fn(),
  setTimeout: vi.fn(),
  connectTCP: vi.fn(async () => {}),
  close: vi.fn((cb: () => void) => cb()),
  readInputRegisters: vi.fn(async (_addr: number, _qty: number): Promise<FakeReply<number>> => ({ data: [0] })),
  readDiscreteInputs: vi.fn(async (_addr: number, _qty: number): Promise<FakeReply<boolean>> => ({ data: [false] })),
};

vi.mock("modbus-serial", () => ({
  default: function ModbusRTU() { return fake; },
}));

beforeEach(() => {
  fake.setID.mockClear();
  fake.setTimeout.mockClear();
  fake.connectTCP.mockClear();
  fake.close.mockClear();
  fake.readInputRegisters.mockReset();
  fake.readDiscreteInputs.mockReset();
  fake.readInputRegisters.mockImplementation(async () => ({ data: [0] }));
  fake.readDiscreteInputs.mockImplementation(async () => ({ data: [false] }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PoolManager", () => {
  it("rejects construction without a host", () => {
    expect(() => new PoolManager({ host: "" })).toThrow(/host is required/);
  });

  it("connects with the provided port + unit", async () => {
    const pm = new PoolManager({ host: "10.0.0.5", port: 5020, unitId: 7 });
    await pm.connect();
    expect(fake.setID).toHaveBeenCalledWith(7);
    expect(fake.connectTCP).toHaveBeenCalledWith("10.0.0.5", { port: 5020 });
    await pm.disconnect();
  });

  it("refresh() reads every spec'd register and decodes decimals", async () => {
    const irByAddress = new Map<number, number>([
      [4001, 730],   // pH 7.30
      [4022, 585],   // Redox 585
      [4033, 286],   // T1 28.6
      [3001, 730],   // setpoint pH 7.30
    ]);
    fake.readInputRegisters.mockImplementation(async (addr: number) => ({
      data: [irByAddress.get(addr) ?? 0],
    }));
    fake.readDiscreteInputs.mockImplementation(async (addr: number) => ({
      data: [addr === 2001], // collective alarm = true
    }));

    const pm = new PoolManager({ host: "x" });
    const state = await pm.refresh();

    expect(state.measurements.ph).toBe(7.3);
    expect(state.measurements.redox).toBe(585);
    expect(state.measurements.temp_t1).toBe(28.6);
    expect(state.parameters.ph_setpoint).toBe(7.3);
    expect(state.alarms.collective).toBe(true);
    expect(state.alarms.ph_upper).toBe(false);
    expect(state.lastRefreshAt).toBeTypeOf("number");

    // Every documented register should have been requested exactly once.
    expect(fake.readInputRegisters).toHaveBeenCalledTimes(MEASUREMENTS.length + PARAMETERS.length);
    expect(fake.readDiscreteInputs).toHaveBeenCalledTimes(ALARMS.length);
  });

  it("refresh() always reads quantity=1 (multi-register reads aren't supported)", async () => {
    const pm = new PoolManager({ host: "x" });
    await pm.refresh();
    for (const call of fake.readInputRegisters.mock.calls) {
      expect(call[1]).toBe(1);
    }
    for (const call of fake.readDiscreteInputs.mock.calls) {
      expect(call[1]).toBe(1);
    }
  });

  it("refresh() omits registers that reply with Modbus exception 2 (illegal address)", async () => {
    fake.readInputRegisters.mockImplementation(async (addr: number) => {
      if (addr === 4077) {
        throw modbusException(2);
      }
      return { data: [0] };
    });

    const pm = new PoolManager({ host: "x" });
    const state = await pm.refresh();
    expect(state.measurements.o2_dosed).toBeUndefined();
    expect(state.measurements.ph).toBe(0);
  });

  it("refresh({ failFast: true }) propagates non-illegal-address errors", async () => {
    fake.readInputRegisters.mockImplementation(async () => {
      throw modbusException(6); // Server Device Busy
    });
    const pm = new PoolManager({ host: "x" });
    await expect(pm.refresh({ failFast: true })).rejects.toBeInstanceOf(BayrolModbusError);
  });

  it("emits 'change' only when state actually changes", async () => {
    const pm = new PoolManager({ host: "x" });
    const seen: number[] = [];
    pm.on("change", (s) => seen.push(s.measurements.ph ?? -1));

    fake.readInputRegisters.mockImplementation(async (addr: number) => ({ data: [addr === 4001 ? 730 : 0] }));
    await pm.refresh();
    expect(seen.length).toBe(1);

    // Same values second time — no change.
    await pm.refresh();
    expect(seen.length).toBe(1);

    // pH moves — should fire.
    fake.readInputRegisters.mockImplementation(async (addr: number) => ({ data: [addr === 4001 ? 731 : 0] }));
    await pm.refresh();
    expect(seen.length).toBe(2);
  });

  it("watch() polls and emits change events on a fake timer", async () => {
    vi.useFakeTimers();
    const pm = new PoolManager({ host: "x" });
    const events: number[] = [];
    pm.on("change", (s) => events.push(s.measurements.ph ?? -1));

    let phRaw = 730;
    fake.readInputRegisters.mockImplementation(async (addr: number) => ({ data: [addr === 4001 ? phRaw : 0] }));

    pm.watch({ intervalMs: 1000 });
    // Immediate tick after watch().
    await vi.waitFor(() => expect(events).toHaveLength(1));

    phRaw = 731;
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(events).toHaveLength(2));

    pm.unwatch();
    await pm.disconnect();
  });

  it("watch() emits 'error' instead of crashing the loop on transport failure", async () => {
    vi.useFakeTimers();
    const pm = new PoolManager({ host: "x" });
    const errors: Error[] = [];
    pm.on("error", (e) => errors.push(e));

    fake.connectTCP.mockImplementationOnce(async () => { throw new Error("ECONNREFUSED"); });
    pm.watch({ intervalMs: 1000 });

    await vi.waitFor(() => expect(errors.length).toBeGreaterThan(0));
    expect(errors[0]?.message).toMatch(/ECONNREFUSED/);
    pm.unwatch();
  });
});
