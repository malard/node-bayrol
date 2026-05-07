/** Base error type. All node-bayrol throws inherit from this. */
export class BayrolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BayrolError";
  }
}

/** TCP connect / socket errors, timeouts, broken pipes. */
export class BayrolTransportError extends BayrolError {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BayrolTransportError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Modbus-level error reply (exception code 1-4 etc.). Includes the numeric
 * code for callers who care to distinguish "illegal address" (2) from
 * "device busy" (6) etc.
 *
 * Notably, **exception 2 (illegal data address) is normal** when probing
 * registers a given controller variant doesn't populate (e.g. an O2 dosing
 * register on a Chlorine model). The high-level state methods swallow it
 * and simply omit the field — see `PoolManager.refresh`.
 */
export class BayrolModbusError extends BayrolError {
  constructor(message: string, readonly modbusCode: number, readonly registerAddress?: number) {
    super(message);
    this.name = "BayrolModbusError";
  }
}
