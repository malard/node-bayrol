// Open a polling watch on a PoolManager and log every change.
//
// Run with:  npx tsx examples/watch.ts
// Stop with: Ctrl-C.

import { PoolManager } from "../src/index.js";

const host = process.env.BAYROL_HOST;
if (!host) {
  console.error("BAYROL_HOST not set. Copy .env.example to .env and fill in your device IP.");
  process.exit(1);
}

const pm = new PoolManager({
  host,
  port: process.env.BAYROL_PORT ? Number(process.env.BAYROL_PORT) : undefined,
  unitId: process.env.BAYROL_UNIT ? Number(process.env.BAYROL_UNIT) : undefined,
  logger: (level, msg, meta) => {
    if (level === "debug") { return; }
    console.log(`[${level}] ${msg}`, meta ?? "");
  },
});

pm.on("change", (state) => {
  const t = new Date(state.lastRefreshAt ?? Date.now()).toISOString();
  const ph = state.measurements.ph ?? "?";
  const cl = state.measurements.free_chlorine_bromine ?? "?";
  const redox = state.measurements.redox ?? "?";
  const t1 = state.measurements.temp_t1 ?? "?";
  const collective = state.alarms.collective ? "ALARM" : "ok";
  console.log(`${t}  pH=${ph}  Cl/Br=${cl}  Redox=${redox}mV  T1=${t1}°C  ${collective}`);
});

pm.on("error", (err) => {
  console.error("[error]", err.message);
});

pm.watch({ intervalMs: 5000 });

process.on("SIGINT", async () => {
  console.log("\nstopping...");
  await pm.disconnect();
  process.exit(0);
});
