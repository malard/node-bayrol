// Bayrol PoolManager PM5 / Analyt Modbus-TCP register map.
//
// Source: official Bayrol "Modbus-TCP Protocol Specification for swimming
// pool controllers PoolManager / Analyt" (status 2013-05-20, software
// release 4.3.0+). Verified on a PM5 Bromine running firmware 9.17401.0
// at 192.168.3.115 on 2026-05-07 — every documented register replied with
// a plausible value.
//
// Three register banks, all READ-ONLY:
//   - 2xxx  Discrete-input alarms     (Modbus FC02 — read-discrete-inputs)
//   - 3xxx  Parameters / setpoints    (Modbus FC04 — read-input-registers)
//   - 4xxx  Live measurements         (Modbus FC04 — read-input-registers)
//
// Important constraints (from the spec, re-verified live):
//   - Each request reads exactly 1 register / 1 input. Multi-register reads
//     return Modbus exception 2 (illegal data address). Always quantity=1.
//   - Device ID is not relevant; the controller answers any unit ID.
//   - Values are 16-bit unsigned; the `decimals` hint shifts the implied
//     decimal point for display (e.g. raw 720 with decimals=2 -> 7.20).
//
// To extend this spec: add the register here, give it a short snake_case
// `key`, and `PoolManager.refresh()` will pick it up automatically.

/** A live measurement read out of the 4xxx bank via FC04. */
export interface MeasurementSpec {
  readonly address: number;
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly decimals: 0 | 1 | 2;
}

/** A configured parameter / setpoint read out of the 3xxx bank via FC04. */
export interface ParameterSpec {
  readonly address: number;
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly decimals: 0 | 1 | 2;
}

/** A discrete alarm flag read out of the 2xxx bank via FC02. */
export interface AlarmSpec {
  readonly address: number;
  readonly key: string;
  readonly label: string;
}

export const MEASUREMENTS = [
  { address: 4001, key: "ph", label: "pH", unit: "pH", decimals: 2 },
  { address: 4008, key: "free_chlorine_bromine", label: "Free chlorine / bromine", unit: "mg/l", decimals: 2 },
  { address: 4022, key: "redox", label: "Redox", unit: "mV", decimals: 0 },
  { address: 4033, key: "temp_t1", label: "Temperature T1", unit: "°C", decimals: 1 },
  { address: 4047, key: "battery", label: "Battery", unit: "V", decimals: 2 },
  { address: 4069, key: "temp_t2", label: "Temperature T2", unit: "°C", decimals: 1 },
  { address: 4071, key: "temp_t3", label: "Temperature T3", unit: "°C", decimals: 1 },
  { address: 4077, key: "o2_dosed", label: "O2 dosed amount (BayroSoft)", unit: "l", decimals: 1 },
] as const satisfies readonly MeasurementSpec[];

export const PARAMETERS = [
  { address: 3001, key: "ph_setpoint", label: "Setpoint pH", unit: "pH", decimals: 2 },
  { address: 3002, key: "ph_alarm_lower", label: "pH lower alarm threshold", unit: "pH", decimals: 2 },
  { address: 3003, key: "ph_alarm_upper", label: "pH upper alarm threshold", unit: "pH", decimals: 2 },
  { address: 3017, key: "chlorine_bromine_setpoint", label: "Setpoint Cl/Br", unit: "mg/l", decimals: 2 },
  { address: 3018, key: "chlorine_bromine_alarm_lower", label: "Cl/Br lower alarm threshold", unit: "mg/l", decimals: 2 },
  { address: 3019, key: "chlorine_bromine_alarm_upper", label: "Cl/Br upper alarm threshold", unit: "mg/l", decimals: 2 },
  // The 2013 spec labels 3049/3050 both as "Setpoint Redox", 3051/3052 both
  // as "Redox lower alarm", and 3053/3054 both as "Redox upper alarm". On a
  // PM5 Bromine running 9.17401.0 the on-device GUI shows the user-set
  // values at 3050 / 3051 / 3052, NOT the addresses the spec implies:
  //
  //   address  spec label                live value   actual role (verified)
  //   3049     "Setpoint Redox"          750          unknown / secondary
  //   3050     "Setpoint Redox"          625          setpoint (the target)
  //   3051     "Redox lower alarm"       700          UPPER alarm threshold
  //   3052     "Redox lower alarm"       550          LOWER alarm threshold
  //   3053     "Redox upper alarm"       800          unknown / secondary
  //   3054     "Redox upper alarm"       700          unknown / secondary (mirrors 3051?)
  //
  // The mapping below is what the GUI actually exposes. The three unknown
  // registers (3049, 3053, 3054) are not surfaced as named keys — read them
  // directly via PoolManager's modbus transport if you need them.
  { address: 3050, key: "redox_setpoint", label: "Setpoint Redox", unit: "mV", decimals: 0 },
  { address: 3052, key: "redox_alarm_lower", label: "Redox lower alarm threshold", unit: "mV", decimals: 0 },
  { address: 3051, key: "redox_alarm_upper", label: "Redox upper alarm threshold", unit: "mV", decimals: 0 },
  { address: 3069, key: "temp_t1_alarm_lower", label: "T1 lower alarm threshold", unit: "°C", decimals: 1 },
  { address: 3070, key: "temp_t1_alarm_upper", label: "T1 upper alarm threshold", unit: "°C", decimals: 1 },
  { address: 3074, key: "temp_t2_alarm_lower", label: "T2 lower alarm threshold", unit: "°C", decimals: 1 },
  { address: 3075, key: "temp_t2_alarm_upper", label: "T2 upper alarm threshold", unit: "°C", decimals: 1 },
  { address: 3079, key: "temp_t3_alarm_lower", label: "T3 lower alarm threshold", unit: "°C", decimals: 1 },
  { address: 3080, key: "temp_t3_alarm_upper", label: "T3 upper alarm threshold", unit: "°C", decimals: 1 },
  { address: 3084, key: "o2_base_dose", label: "O2 base dosing amount (BayroSoft)", unit: "l", decimals: 1 },
] as const satisfies readonly ParameterSpec[];

export const ALARMS = [
  { address: 2001, key: "collective", label: "Collective alarm" },
  { address: 2002, key: "power_on_delay", label: "Power-on delay" },
  { address: 2003, key: "no_flow_input_flow", label: "No flow signal (input flow)" },
  { address: 2004, key: "no_flow_input_in1", label: "No flow signal (input IN1)" },
  { address: 2005, key: "ph_upper", label: "Upper alarm pH" },
  { address: 2006, key: "ph_lower", label: "Lower alarm pH" },
  { address: 2009, key: "ph_dosing", label: "Dosing alarm pH" },
  { address: 2010, key: "chlorine_bromine_upper", label: "Upper alarm Cl/Br" },
  { address: 2011, key: "chlorine_bromine_lower", label: "Lower alarm Cl/Br" },
  { address: 2012, key: "chlorine_level", label: "Level alarm chlorine" },
  { address: 2013, key: "chlorine_level_warning", label: "Level warning chlorine" },
  { address: 2014, key: "chlorine_bromine_dosing", label: "Dosing alarm Cl/Br" },
  { address: 2019, key: "redox_upper", label: "Upper alarm redox" },
  { address: 2020, key: "redox_lower", label: "Lower alarm redox" },
  { address: 2021, key: "redox_level", label: "Level alarm redox" },
  { address: 2022, key: "redox_level_warning", label: "Level warning redox" },
  { address: 2023, key: "redox_dosing", label: "Dosing alarm redox" },
  { address: 2024, key: "o2_level", label: "Level alarm O2 (BayroSoft)" },
  { address: 2025, key: "o2_level_warning", label: "Level warning O2 (BayroSoft)" },
  { address: 2028, key: "temp_t1_upper", label: "Upper alarm temperature T1" },
  { address: 2029, key: "temp_t1_lower", label: "Lower alarm temperature T1" },
  { address: 2030, key: "temp_t2_upper", label: "Upper alarm temperature T2" },
  { address: 2031, key: "temp_t2_lower", label: "Lower alarm temperature T2" },
  { address: 2032, key: "temp_t3_upper", label: "Upper alarm temperature T3" },
  { address: 2033, key: "temp_t3_lower", label: "Lower alarm temperature T3" },
  { address: 2034, key: "battery", label: "Battery alarm" },
  { address: 2035, key: "ph_plus_level", label: "Level alarm pH+" },
  { address: 2036, key: "ph_plus_level_warning", label: "Level warning pH+" },
  { address: 2037, key: "ph_minus_level", label: "Level alarm pH-" },
  { address: 2038, key: "ph_minus_level_warning", label: "Level warning pH-" },
  { address: 2039, key: "flockmatic_level", label: "Level alarm Flockmatic" },
] as const satisfies readonly AlarmSpec[];

export type MeasurementKey = (typeof MEASUREMENTS)[number]["key"];
export type ParameterKey = (typeof PARAMETERS)[number]["key"];
export type AlarmKey = (typeof ALARMS)[number]["key"];

const MEAS_BY_KEY = new Map(MEASUREMENTS.map((m) => [m.key, m]));
const PARAM_BY_KEY = new Map(PARAMETERS.map((p) => [p.key, p]));
const ALARM_BY_KEY = new Map(ALARMS.map((a) => [a.key, a]));

export function getMeasurementSpec(key: MeasurementKey): MeasurementSpec {
  const spec = MEAS_BY_KEY.get(key);
  if (!spec) {
    throw new Error(`unknown measurement key: ${key}`);
  }
  return spec;
}

export function getParameterSpec(key: ParameterKey): ParameterSpec {
  const spec = PARAM_BY_KEY.get(key);
  if (!spec) {
    throw new Error(`unknown parameter key: ${key}`);
  }
  return spec;
}

export function getAlarmSpec(key: AlarmKey): AlarmSpec {
  const spec = ALARM_BY_KEY.get(key);
  if (!spec) {
    throw new Error(`unknown alarm key: ${key}`);
  }
  return spec;
}

/**
 * Convert a raw 16-bit register value to its display number using the
 * decimals hint. Raw 720 with decimals=2 returns 7.20.
 */
export function decodeRaw(raw: number, decimals: 0 | 1 | 2): number {
  if (decimals === 0) {
    return raw;
  }
  return raw / Math.pow(10, decimals);
}
