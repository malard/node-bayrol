# Changelog

## 0.1.0

Initial release.

- Local Modbus-TCP client for Bayrol PoolManager 5 / Analyt controllers, port 502.
- Reads all registers documented in Bayrol's published Modbus-TCP protocol spec:
  - 8 live measurements (pH, free Cl/Br, Redox, three temperatures, battery, O2 dosed)
  - 16 setpoints / alarm thresholds
  - 31 alarm flags
- `PoolManager` class with `refresh()`, `state`, `watch()` / `unwatch()`, and typed `'change'` / `'error'` events.
- Modbus exception 2 (illegal data address) is silently swallowed — variant-dependent registers simply omit from `state` when not present.
- Decimal-point decoding per the spec's `decimals` hint.
- Verified live against a PM5 Bromine on firmware 9.17401.0.
- Redox setpoint / alarm thresholds: the 2013 spec lists six near-identical
  Redox parameter registers (3049–3054), most of them with duplicated labels.
  Live verification against the on-device GUI shows the user-set values
  actually live at 3050 (setpoint), 3052 (lower alarm), 3051 (upper alarm) —
  NOT the addresses the spec's labels imply. The remaining three registers
  (3049, 3053, 3054) hold values whose role hasn't been characterized and
  are not surfaced as named keys.
