export { PoolManager } from "./pool-manager.js";
export type {
  PoolManagerState,
  RefreshOptions,
  WatchOptions,
} from "./pool-manager.js";

export type {
  BayrolClientOptions,
  BayrolLogger,
  BayrolLogLevel,
  PoolManagerVariant,
} from "./types.js";

export {
  BayrolError,
  BayrolModbusError,
  BayrolTransportError,
} from "./errors.js";

export {
  MEASUREMENTS,
  PARAMETERS,
  ALARMS,
  decodeRaw,
  getMeasurementSpec,
  getParameterSpec,
  getAlarmSpec,
} from "./spec.js";
export type {
  MeasurementKey,
  ParameterKey,
  AlarmKey,
  MeasurementSpec,
  ParameterSpec,
  AlarmSpec,
} from "./spec.js";
