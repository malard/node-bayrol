// Thin Modbus-TCP wrapper. Encapsulates `modbus-serial` so the rest of the
// codebase only depends on the small surface we actually use, and so future
// transport swaps (e.g. a custom socket implementation) stay local.

import ModbusRTU from "modbus-serial";
import { BayrolModbusError, BayrolTransportError } from "./errors.js";
import type { BayrolLogger } from "./types.js";

export interface ModbusTransportOpts {
  host: string;
  port: number;
  unitId: number;
  timeoutMs: number;
  logger?: BayrolLogger | undefined;
}

/**
 * One open Modbus-TCP connection to a PoolManager. Use `connect()` to open,
 * `readInputRegister()` / `readDiscreteInput()` to issue requests, `close()`
 * to release the socket.
 *
 * Spec quirks honored:
 *   - Always quantity = 1 (multi-register reads return exception 2).
 *   - Modbus exception 2 (illegal data address) is wrapped as
 *     `BayrolModbusError` with `modbusCode === 2` so callers can swallow
 *     it for variant-dependent registers.
 */
export class ModbusTransport {
  readonly #opts: ModbusTransportOpts;
  readonly #client: ModbusRTU;
  #connected = false;

  constructor(opts: ModbusTransportOpts) {
    this.#opts = opts;
    this.#client = new ModbusRTU();
    this.#client.setID(opts.unitId);
    this.#client.setTimeout(opts.timeoutMs);
  }

  get connected(): boolean {
    return this.#connected;
  }

  async connect(): Promise<void> {
    if (this.#connected) {
      return;
    }
    try {
      await this.#client.connectTCP(this.#opts.host, { port: this.#opts.port });
      this.#connected = true;
      this.#opts.logger?.("info", "modbus: connected", {
        host: this.#opts.host,
        port: this.#opts.port,
        unitId: this.#opts.unitId,
      });
    } catch (err) {
      throw new BayrolTransportError(
        `connect ${this.#opts.host}:${this.#opts.port} failed: ${(err as Error).message}`,
        err,
      );
    }
  }

  async close(): Promise<void> {
    if (!this.#connected) {
      return;
    }
    return new Promise((resolve) => {
      this.#client.close(() => {
        this.#connected = false;
        this.#opts.logger?.("info", "modbus: closed");
        resolve();
      });
    });
  }

  /** Read a single 16-bit input register (Modbus FC04). */
  async readInputRegister(address: number): Promise<number> {
    await this.#ensureConnected();
    try {
      const r = await this.#client.readInputRegisters(address, 1);
      const raw = r.data[0];
      if (raw === undefined) {
        throw new BayrolTransportError(`empty response for input register ${address}`);
      }
      this.#opts.logger?.("debug", "modbus: read input register", { address, raw });
      return raw;
    } catch (err) {
      throw this.#wrap(err, address, "readInputRegisters");
    }
  }

  /** Read a single discrete input bit (Modbus FC02). */
  async readDiscreteInput(address: number): Promise<boolean> {
    await this.#ensureConnected();
    try {
      const r = await this.#client.readDiscreteInputs(address, 1);
      const bit = r.data[0];
      if (bit === undefined) {
        throw new BayrolTransportError(`empty response for discrete input ${address}`);
      }
      this.#opts.logger?.("debug", "modbus: read discrete input", { address, value: bit });
      return Boolean(bit);
    } catch (err) {
      throw this.#wrap(err, address, "readDiscreteInputs");
    }
  }

  async #ensureConnected(): Promise<void> {
    if (!this.#connected) {
      await this.connect();
    }
  }

  #wrap(err: unknown, address: number, op: string): Error {
    if (err instanceof BayrolModbusError || err instanceof BayrolTransportError) {
      return err;
    }
    const e = err as { name?: string; message?: string; modbusCode?: number };
    if (e.modbusCode !== undefined) {
      return new BayrolModbusError(
        `modbus exception ${e.modbusCode} on ${op}(${address}): ${e.message ?? ""}`,
        e.modbusCode,
        address,
      );
    }
    return new BayrolTransportError(
      `${op}(${address}) failed: ${e.message ?? String(err)}`,
      err,
    );
  }
}
