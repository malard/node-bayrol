/**
 * Severity levels used by the logger callback. Roughly:
 *   - `debug` — fine-grained diagnostic noise (per-register).
 *   - `info`  — single-shot lifecycle events (connect, disconnect, watch start).
 *   - `warn`  — recoverable anomalies (retry, fall back to next reading).
 *   - `error` — irrecoverable failures the caller should attend to.
 */
export type BayrolLogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger callback. Consumers can filter by `level` and forward the rest to
 * their own logging stack.
 */
export type BayrolLogger = (
  level: BayrolLogLevel,
  msg: string,
  meta?: Record<string, unknown>,
) => void;

export interface BayrolClientOptions {
  /** IPv4 / hostname of the PoolManager on the local network. */
  host: string;
  /** Modbus-TCP port. Defaults to 502. */
  port?: number;
  /**
   * Modbus unit ID. The PoolManager spec says this is "Not Relevant"; the
   * device accepts any value. Defaults to 1.
   */
  unitId?: number;
  /** Per-request timeout in ms. Defaults to 2000. */
  timeoutMs?: number;
  /** Logger hook. */
  logger?: BayrolLogger;
}

/** Which PoolManager variant is connected, inferred from spec language. */
export type PoolManagerVariant =
  | "chlorine"
  | "bromine"
  | "oxygen"
  | "pro"
  | "analyt-2"
  | "analyt-3"
  | "unknown";
