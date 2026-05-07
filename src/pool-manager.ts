// High-level wrapper around a Bayrol PoolManager / Analyt over Modbus-TCP.
//
// Surface mirrors node-dreame's Vacuum class so consumers (e.g. dunbar-os)
// see the same shape:
//   - construct, optionally `connect()`
//   - `refresh()` — read all known registers, populate `state`, return it
//   - `watch({ intervalMs })` — start a polling loop that emits 'change'
//     when any register's value differs from the cached state
//   - `state` — last-known snapshot
//   - `on('change' | 'error', ...)` — typed event channels

import { ALARMS, MEASUREMENTS, PARAMETERS, decodeRaw } from "./spec.js";
import type { AlarmKey, MeasurementKey, ParameterKey } from "./spec.js";
import { ModbusTransport } from "./modbus.js";
import { BayrolModbusError } from "./errors.js";
import type { BayrolClientOptions, BayrolLogger } from "./types.js";
import { TypedEmitter } from "./typed-emitter.js";

const DEFAULT_PORT = 502;
const DEFAULT_UNIT_ID = 1;
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_WATCH_INTERVAL_MS = 5000;

/**
 * Last-observed snapshot. Each field is `undefined` until first observed,
 * and may go back to `undefined` if the register starts replying with
 * Modbus exception 2 (e.g. variant-dependent register).
 */
export type PoolManagerState = {
  measurements: Partial<Record<MeasurementKey, number>>;
  parameters: Partial<Record<ParameterKey, number>>;
  alarms: Partial<Record<AlarmKey, boolean>>;
  /** ms-epoch of the last successful refresh that populated any field. */
  lastRefreshAt?: number;
};

export interface RefreshOptions {
  /** Stop polling early on the first transport error. Defaults to false. */
  failFast?: boolean;
}

export interface WatchOptions {
  /** Poll interval in ms. Defaults to 5000. Minimum enforced is 500. */
  intervalMs?: number;
}

type Events = {
  change: [PoolManagerState];
  error: [Error];
};

/** Drop-in client for one PoolManager / Analyt on the local network. */
export class PoolManager extends TypedEmitter<Events> {
  readonly #transport: ModbusTransport;
  readonly #logger?: BayrolLogger | undefined;
  #state: PoolManagerState = { measurements: {}, parameters: {}, alarms: {} };
  #watchTimer: NodeJS.Timeout | null = null;
  #watchInflight = false;

  constructor(opts: BayrolClientOptions) {
    super();
    if (!opts.host) {
      throw new Error("BayrolClientOptions.host is required");
    }
    this.#logger = opts.logger;
    this.#transport = new ModbusTransport({
      host: opts.host,
      port: opts.port ?? DEFAULT_PORT,
      unitId: opts.unitId ?? DEFAULT_UNIT_ID,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(opts.logger ? { logger: opts.logger } : {}),
    });
  }

  /** Last-known snapshot. Populated by `refresh()` and the `watch()` loop. */
  get state(): Readonly<PoolManagerState> {
    return this.#state;
  }

  get connected(): boolean {
    return this.#transport.connected;
  }

  /**
   * Open the underlying Modbus-TCP connection. Optional — `refresh()` will
   * connect lazily on first use. Call this explicitly when you want the
   * "is the device reachable" signal up front.
   */
  async connect(): Promise<void> {
    await this.#transport.connect();
  }

  /**
   * Close the underlying Modbus-TCP connection. Stops `watch()` if active.
   * Idempotent.
   */
  async disconnect(): Promise<void> {
    this.unwatch();
    await this.#transport.close();
  }

  /**
   * Read every register in the spec and populate `state`. Returns the
   * resulting state for convenience.
   *
   * Modbus exception 2 (illegal data address) on individual registers is
   * silently swallowed — that's how the controller signals "this variant
   * doesn't have this register" (e.g. an O2 dosing register on a Chlorine
   * model). All other Modbus / transport errors propagate.
   *
   * Reads are sequential because the controller does not support
   * multi-register reads.
   */
  async refresh(opts: RefreshOptions = {}): Promise<PoolManagerState> {
    await this.#transport.connect();
    const next: PoolManagerState = {
      measurements: {},
      parameters: {},
      alarms: {},
    };

    for (const m of MEASUREMENTS) {
      const raw = await this.#tryRead(() => this.#transport.readInputRegister(m.address), m.address, opts);
      if (raw !== undefined) {
        next.measurements[m.key] = decodeRaw(raw, m.decimals);
      }
    }
    for (const p of PARAMETERS) {
      const raw = await this.#tryRead(() => this.#transport.readInputRegister(p.address), p.address, opts);
      if (raw !== undefined) {
        next.parameters[p.key] = decodeRaw(raw, p.decimals);
      }
    }
    for (const a of ALARMS) {
      const bit = await this.#tryRead(() => this.#transport.readDiscreteInput(a.address), a.address, opts);
      if (bit !== undefined) {
        next.alarms[a.key] = bit;
      }
    }

    next.lastRefreshAt = Date.now();
    const changed = this.#hasChanged(this.#state, next);
    this.#state = next;
    if (changed) {
      this.emit("change", this.#state);
    }
    return this.#state;
  }

  /**
   * Start polling on a fixed interval. Each tick calls `refresh()`; if the
   * snapshot differs from the previous one, a `change` event fires. Errors
   * during a tick are emitted as `error` events and the loop continues —
   * call `unwatch()` to stop.
   */
  watch(opts: WatchOptions = {}): void {
    if (this.#watchTimer !== null) {
      return;
    }
    const intervalMs = Math.max(500, opts.intervalMs ?? DEFAULT_WATCH_INTERVAL_MS);
    this.#logger?.("info", "watch: starting", { intervalMs });
    const tick = async (): Promise<void> => {
      if (this.#watchInflight) {
        return;
      }
      this.#watchInflight = true;
      try {
        await this.refresh();
      } catch (err) {
        this.emit("error", err as Error);
      } finally {
        this.#watchInflight = false;
      }
    };
    this.#watchTimer = setInterval(() => { void tick(); }, intervalMs);
    // Don't keep the Node process alive purely for the polling loop.
    this.#watchTimer.unref?.();
    // Fire one immediate tick so consumers don't wait `intervalMs` for first state.
    void tick();
  }

  /** Stop polling. Idempotent. */
  unwatch(): void {
    if (this.#watchTimer !== null) {
      clearInterval(this.#watchTimer);
      this.#watchTimer = null;
      this.#logger?.("info", "watch: stopped");
    }
  }

  async #tryRead<T>(
    fn: () => Promise<T>,
    address: number,
    opts: RefreshOptions,
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof BayrolModbusError && err.modbusCode === 2) {
        // "illegal data address" — register not populated on this variant.
        this.#logger?.("debug", "register not supported by device", { address });
        return undefined;
      }
      if (opts.failFast) {
        throw err;
      }
      this.#logger?.("warn", "register read failed", {
        address,
        error: (err as Error).message,
      });
      return undefined;
    }
  }

  #hasChanged(prev: PoolManagerState, next: PoolManagerState): boolean {
    for (const bucket of ["measurements", "parameters", "alarms"] as const) {
      const a = prev[bucket] as Record<string, unknown>;
      const b = next[bucket] as Record<string, unknown>;
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        if (a[k] !== b[k]) {
          return true;
        }
      }
    }
    return false;
  }
}
