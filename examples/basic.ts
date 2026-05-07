// Connect to a Bayrol PoolManager, take one snapshot, print it, and exit.
//
// Run with:  npx tsx examples/basic.ts
// Reads BAYROL_HOST / BAYROL_PORT / BAYROL_UNIT from .env (or defaults).

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
});

const state = await pm.refresh();

console.log("Measurements:");
for (const [k, v] of Object.entries(state.measurements)) {
  console.log(`  ${k}: ${v}`);
}
console.log("\nParameters:");
for (const [k, v] of Object.entries(state.parameters)) {
  console.log(`  ${k}: ${v}`);
}
console.log("\nActive alarms:");
const active = Object.entries(state.alarms).filter(([, v]) => v);
if (active.length === 0) {
  console.log("  (none)");
} else {
  for (const [k] of active) {
    console.log(`  ${k}`);
  }
}

await pm.disconnect();
