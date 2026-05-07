# Changelog

## 0.1.0

Initial release.

- Local Modbus-TCP client for Bayrol PoolManager 5 / Analyt controllers, port 502.
- Reads all registers documented in Bayrol's published Modbus-TCP protocol spec:
  - 8 live measurements (pH, free Cl/Br, Redox, three temperatures, battery, O2 dosed)
  - 19 setpoints / alarm thresholds
  - 31 alarm flags
- `PoolManager` class with `refresh()`, `state`, `watch()` / `unwatch()`, and typed `'change'` / `'error'` events.
- Modbus exception 2 (illegal data address) is silently swallowed — variant-dependent registers simply omit from `state` when not present.
- Decimal-point decoding per the spec's `decimals` hint.
- Verified live against a PM5 Bromine on firmware 9.17401.0.
