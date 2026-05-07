# Unknown registers — research backlog

Every readable Modbus register on the PoolManager whose role we have NOT
yet identified. Captured so we can pick this up cold later without
re-probing.

## Reference snapshot

- **Device:** Bayrol PM5 (Bromine variant)
- **Firmware:** 9.17401.0
- **Probed from:** 192.168.3.115 (LAN)
- **Probe date:** 2026-05-07
- **Modbus surface confirmed:** FC02 (discrete inputs), FC04 (input
  registers). FC01 (coils) and FC03 (holding registers) both reply with
  exception 1 ("illegal function") — this device does not implement them.
  This means **there is no Modbus write path on this controller.**
- **Sweep range covered:** 2001–2080, 3001–3120, 4001–4103. Did not scan
  beyond. There may be more registers further up.

## Investigation method (when we revisit)

Cheapest way to label any of these:

1. Note the current value of every unknown register (run a "snapshot"
   probe — see `examples/basic.ts` plus a small extension to dump the
   full register list, not yet written).
2. Change exactly one setting on the device (web GUI at `Martin`/`user2`
   or via the front panel).
3. Re-snapshot. The single register whose value moved is the one tied to
   that setting.
4. Repeat for each setting of interest.

Don't try to deduce roles from value patterns alone — too ambiguous.
The diff method gives a definite answer per setting in seconds.

---

## Group 1 — Three repeating per-channel parameter blocks (3001-3047)

Each channel (pH / Cl-Br / Redox) has a 16-register block at the same
field offsets. The first three offsets in each block ARE documented
(setpoint + lower alarm + upper alarm); offsets 3-15 are not. The
shape is too regular to be coincidence — almost certainly per-channel
dosing-pump / control-loop settings.

| Offset | pH (3001+) | Cl/Br (3017+) | Redox (3033+) | Hypothesis | Confidence |
|--------|-----------|---------------|---------------|------------|------------|
| 0 | 3001=730 ✅ | 3017=150 ✅ | 3033=150 | setpoint | high |
| 1 | 3002=650 ✅ | 3018=50 ✅ | 3034=50 | lower alarm | high |
| 2 | 3003=780 ✅ | 3019=250 ✅ | 3035=250 | upper alarm | high |
| 3 | 3004=500 | 3020=240 | 3036=240 | ? | none |
| 4 | 3005=1 | 3021=1 | 3037=1 | enable flag (0/1) | medium |
| 5 | 3006=50 | 3022=70 | 3038=70 | ? | none |
| 6 | 3007=1000 | 3023=1000 | 3039=1000 | scale factor / max-dose? | low |
| 9 | 3010=30 | 3026=30 | 3042=30 | seconds (interval?) | low |
| 10 | 3011=33 | 3027=24 | 3043=24 | hours (24h cycle?) | low |
| 11 | 3012=735 | 3028=150 | 3044=150 | ? | none |
| 12 | 3013=900 | 3029=150 | 3045=150 | ? | none |
| 14 | 3015=596 | 3031=5000 | 3047=5000 | ? | none |

(✅ = officially documented, role known.)

## Group 2 — Redox "secondary" registers

The 2013 PDF spec labels six Redox parameter registers, three with
duplicate labels each. We've nailed three of them via GUI cross-check:

| Address | Live | Role | Confidence |
|---------|------|------|------------|
| 3050 | 625 | setpoint | confirmed (matches GUI) |
| 3051 | 700 | upper alarm | confirmed (matches GUI) |
| 3052 | 550 | lower alarm | confirmed (matches GUI) |
| **3049** | **750** | **unknown** | — |
| **3053** | **800** | **unknown** | — |
| **3054** | **700** | **unknown** | — |

Hypotheses for the three unknowns:
- **Factory limits / max-allowable values?** 800 and 750 are at the high
  end of plausible Redox.
- **Secondary mode setpoints?** Some Bayrol controllers support a "low
  Redox" night mode — these might be the alternate setpoints.
- **Calibration anchors?** Less likely.

Investigation: cycle the device through any "modes" the GUI offers and
see if 3049/3053/3054 move.

## Group 3 — Higher 3xxx registers (3055-3120)

Doesn't fit the per-channel block shape. Likely global system config —
schedules, system limits, or feature flags.

```
3055=240   3056=999   3057=1     3058=150   3060=1000
3063=30    3064=30    3065=24    3067=465
3072=290   3073=21    3077=250   3082=250
3085=2     3086=170   3088=24    3089=40    3090=10
3091=40    3092=10    3093=40    3094=10    3095=40
3096=20    3097=55    3098=1     3099=1     3100=1     3101=1
3102=55    3103=15    3104=15    3105=15    3106=30    3107=15    3108=15    3109=15
3110=60    3111=60    3112=60    3113=60    3114=60
3115=5     3116=5     3117=15    3118=250   3119=10    3120=250
```

Specific shape clues:
- **3098-3101 = four 1s.** Could be enable flags for four feature
  switches, or four "weekday active" booleans.
- **3110-3114 = five 60s.** Could be five timing slots in minutes, or
  five same-default duration parameters.
- **3103-3109 = mostly 15s.** Could be a per-day-of-week 15-minute
  cycle, or 15-second intervals across seven slots (note 7 entries).
- **3056=999** is a "max" value — might be a threshold ceiling.

Investigation: look at the GUI's schedule / weekly-program pages. If
those exist, change a daily program and watch this range.

## Group 4 — 4xxx mirrors of documented measurements

Almost certainly redundant read aliases (legacy / BMS compatibility).
Low priority.

| Documented | Mirrors |
|------------|---------|
| 4001=730 (pH) | 4002=730, 4003=730, 4004=730 |
| 4022=585 (Redox) | 4023=585, 4051=585, 4052=585, 4053=585 |
| 4033=286 (T1) | 4034=286 |
| 4069=534 (T2) | 4070=534 |
| 4071=999 (T3) | 4072=999 |

Confirm by reading them while the underlying value is changing — if
they track, they're aliases.

## Group 5 — 4xxx "no-sensor" sentinels

| Register | Value |
|----------|-------|
| 4005, 4006, 4007 | 65532 (= 0xFFFC = -4 if int16) |

Almost certainly "channel exists in firmware but no sensor wired".
Likely 4-th, 5-th, 6-th pH-channel slots.

## Group 6 — 4xxx measurement triplets at unique values

Five sets of three same-value registers. Strong "raw sensor counts /
per-replica readings" shape but not confirmed.

```
4025=28    4026=28    4027=28
4048=694   4049=694   4050=694
4054=23    4055=23    4056=23
4057=9     4058=9     4059=9
4060=377   4061=377   4062=377
4063=507   4064=507   4065=507
4066=772   4067=772   4068=772
```

Hypothesis: each triplet is a per-sensor raw quantity (the controller
averages or majority-votes across three sensor reads for stability).
The 4048-4050=694 triplet is suggestive — 694 is close to the 700
upper-Redox-alarm — could be uncalibrated raw mV.

Investigation: physically perturb a sensor (lift the pH probe out of
solution briefly) and watch which triplet jumps.

## Group 7 — 4xxx single-value undocumented

| Register | Value | Best guess |
|----------|-------|-----------|
| 4012, 4013 | 48 | ? possibly % output / flow / saturation index |
| 4015 | 60 | ? |
| 4016, 4017 | 65 | ? |
| 4019, 4020 | 36 | ? |
| 4021 | 10 | ? |
| 4024 | 15 | ? |
| 4037 | 100 | looks like a percentage |
| 4039, 4040, 4042, 4044 | 1 | binary states |
| 4045 | 59 | ? |
| 4046 | 50 | ? |
| 4073 | 1 | binary state |
| 4074 | 116 | ? |
| 4075 | 50 | ? |
| 4102, 4103 | 250 | ? |

Investigation: run a long-duration `examples/watch.ts` and see which of
these tick over time on their own — anything that changes without GUI
interaction is a runtime counter or live derived value.

## Group 8 — 2xxx alarm bank beyond 2039

Documented up to 2039. Sweep 2001–2080 returned no additional active
alarms — but since the device only signals "is this alarm currently
1", we cannot distinguish a non-existent register from an inactive one
without triggering the alarm. The full alarm catalogue is **unknown**.

Investigation: deliberately trip a known alarm (e.g. unplug a flow
switch) and run a 2001-2080 sweep — anything that goes 0→1 was a real
alarm slot.

---

## Out of scope (intentional, per project decision 2026-05-07)

We are not pursuing the controller's other interfaces:

- **Web GUI / FastCGI** at `/cgi-bin/webgui.fcgi`
- **Bayrol "Pool Connect" cloud MQTT** (firmware ≥ 9.0.0)
- **SSH on port 22**
- **Service menu** (`partner` / `pool` per spec PDF)

These are noted only so a future re-scoping decision has the context.
