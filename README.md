# node-bayrol

[![CI](https://github.com/malard/node-bayrol/actions/workflows/ci.yml/badge.svg)](https://github.com/malard/node-bayrol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A524-brightgreen.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)](./tsconfig.json)

Node.js client for the **Bayrol PoolManager** / **Analyt** swimming-pool controllers, over **local Modbus-TCP**. No cloud, no scraping — talks directly to the controller using the Modbus register map Bayrol publishes.

> **Status:** v0.1 — read-only. Covers every register in the published Modbus-TCP spec. Verified live against a PM5 Bromine on firmware 9.17401.0.

## Why this exists

Most existing Bayrol integrations use:

- **Bayrol's German cloud** ([razem-io/ha-bayrol-cloud](https://github.com/razem-io/ha-bayrol-cloud)) — requires a Bayrol Pool Access account, scrapes their web portal, depends on internet connectivity.
- **The on-device web GUI** — a custom FastCGI/JS app that re-issues a fresh session token per page; brittle to scrape.

Both have moved several steps away from the controller. This library targets the path Bayrol themselves document for building-management-system integration: **Modbus-TCP on the local network**, port 502, no auth, no cloud.

## Scope

- **In scope (v0.1):** all live measurements, configured setpoints, and alarm flags documented in Bayrol's PM5 Modbus-TCP protocol spec. Polling-based change events.
- **Out of scope (today):** writing setpoints, schedule control, dosing pump control, history, firmware updates. Modbus is read-only on this controller; writes have to go through the web GUI, which is a separate reverse-engineering project (see [Limitations](#limitations) below).

## Install

```bash
npm install node-bayrol
```

Requires Node.js 24 or newer.

## Usage

```ts
import { PoolManager } from "node-bayrol";

const pm = new PoolManager({
  host: "192.168.1.100",   // your controller's local IP
  // port: 502,            // default
  // unitId: 1,            // default; controller ignores it
  // timeoutMs: 2000,      // default per request
});

const state = await pm.refresh();

console.log(state.measurements.ph);                // 7.30
console.log(state.measurements.redox);             // 585
console.log(state.measurements.temp_t1);           // 28.6
console.log(state.parameters.ph_setpoint);         // 7.30
console.log(state.alarms.collective);              // false

await pm.disconnect();
```

CommonJS:

```js
const { PoolManager } = require("node-bayrol");
```

## Live updates via polling

The Modbus-TCP protocol has no push channel — the controller is a passive server. Use `watch()` to start a polling loop that emits a `'change'` event whenever any register's value differs from the previous tick:

```ts
const pm = new PoolManager({ host });

pm.on("change", (state) => {
  console.log("pH:", state.measurements.ph);
});
pm.on("error", (err) => {
  console.error("poll failed:", err.message);
});

pm.watch({ intervalMs: 5000 });
```

The default poll interval is 5 s; the minimum enforced interval is 500 ms. The loop survives transient errors — they're emitted as `'error'` events instead of stopping the watch.

`refresh()` always issues one Modbus request per register (the controller does not support multi-register reads; this is a hard spec constraint). On a fresh connection, a full refresh hits ~50 registers and takes well under a second on a local LAN.

## State shape

```ts
type PoolManagerState = {
  measurements: Partial<Record<MeasurementKey, number>>;
  parameters: Partial<Record<ParameterKey, number>>;
  alarms: Partial<Record<AlarmKey, boolean>>;
  lastRefreshAt?: number;  // ms-epoch
};
```

Each numeric value is **already decoded** — the spec encodes pH as `730` with `decimals=2`; `state.measurements.ph` gives you `7.30` directly.

A field is `undefined` if the controller replied with Modbus exception 2 (illegal data address) for that register on the latest refresh. That's how the device signals "this variant doesn't have this register" — e.g. an O2 dosing register on a Chlorine model. Iterate `Object.entries(state.measurements)` rather than referencing every key by name.

The complete key catalogues live in [`src/spec.ts`](./src/spec.ts) — `MEASUREMENTS`, `PARAMETERS`, `ALARMS`. Each entry has `address`, `key`, `label`, `unit`, and `decimals` (where applicable).

## Limitations

- **Read-only.** The Modbus-TCP server on the controller is read-only by design (Bayrol's spec document is explicit about this). Adjusting setpoints, controlling dosing pumps, changing schedules etc. has to go through the web GUI, and the web GUI uses a fresh per-session token plus a custom `wui.*` JS protocol — that's a much bigger reverse-engineering project, planned but not in v0.1.
- **No multi-register reads.** Each register is fetched in its own request. On a local LAN this is fine; on a high-latency link it adds up.
- **No live push.** Modbus has no subscription model. Polling is the only path; `watch()` wraps it.
- **MQTT.** Recent PM5 firmware (≥ 9.0.0) supports MQTT, but the broker is Bayrol's "Pool Connect" cloud, not a local one — the controller's local TCP ports 1883/8883 are closed. Out of scope for a local-first library.

## Supported devices

The Modbus protocol document covers the entire PoolManager 5 family from 2012 onward:

- PoolManager Chlorine / Bromine / Oxygen
- PoolManager PRO
- Analyt 2
- Analyt 3 / Analyt 3 Hotel

Verified live against a **PM5 Bromine** (firmware 9.17401.0) on 2026-05-07. Other variants should work — the register map is shared — but variant-specific registers (e.g. `o2_dosed` only populates on Oxygen models) appear/disappear automatically based on what the controller chooses to answer.

The Modbus protocol requires firmware **4.3.0 or later** (May 2013). Older controllers can be updated from the official downloads at https://www.bayrol.de/.

## Reverse-engineering notes

`src/spec.ts` is the canonical register catalogue. It cites each register's source and indicates which entries are duplicated in the official spec (Bayrol lists `redox_setpoint` at both 3049 and 3050 with identical labels but different live values — both kept distinct here as `redox_setpoint` and `redox_setpoint_alt` until the difference is properly characterized).

Probe scripts and the original PDFs live in `.research/` (gitignored). To regenerate the text dumps:

```bash
python3 .research/extract_pdf.py
```

## License

MIT — see [LICENSE](./LICENSE).
