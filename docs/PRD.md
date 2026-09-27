# Pawse (formerly PetPulse / Bandhan) — Product Requirements Document

**Product:** Pawse — a dog collar that detects physical and emotional distress in real time
**Codename / repo:** Pawse (renamed from Bandhan; live Azure resources provisioned before the rename still use the `bandhan-*` prefix — see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md))
**Team:** Origami Treats
**Version:** 1.0
**Status:** Ready to build
**Audience:** Anyone implementing or reviewing a slice

This PRD is the build-ready expansion of the Pawse plan. It does not invent hardware or features beyond §9. Companion doc: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — same plan, engineering detail.

---

## 1. Summary

Dogs can't ask for help. When an owner leaves the house, the dog's day becomes a black box.

Pawse is a collar-mounted wearable that continuously reads a dog's **motion** (one MPU6050 accelerometer/gyroscope unit) and **vocal pattern** (a condenser microphone, pattern only — never raw audio) and compares both against that specific dog's own learned baseline. When the reading deviates enough to look like physical distress (seizure-like shaking, limping, prolonged stillness) or emotional distress (whimpering, crying, atypical barking), the collar beeps immediately and pushes an alert to the owner's website.

A second, secondary feature rides the same hardware: the owner can send the dog a **beep cue** from the website. It ships with two defaults (single beep = "sit", continuous beep = "handshake") but the cue vocabulary is owner-configurable — an owner can rename a cue, change its beep pattern, or add new ones to train and reward tricks with treats. The MPU6050 reads whether the dog's resulting posture matches the cue, and that match/no-match becomes the reward signal for a reinforcement-learning loop that improves the dog's response over time. This is framed as a lightweight **communication channel** between owner and dog — not only a training mechanic.

Owner-facing surface for this build is a **website**, not a native app.

---

## 2. Problem

An owner who leaves a dog home alone has no reliable way to know if the dog is okay. The two existing product categories don't solve it:

- **Cameras** need someone actively watching or scrubbing footage, fail in a crate/car/low light, and raise bandwidth/privacy concerns.
- **Basic activity trackers** count steps but can't say *why* the dog is moving that way, and capture nothing about sound.

Distress shows up through two channels neither product fuses: **motion** (seizures, limping, pacing, unusual stillness) and **sound** (whimpering, crying, distress barking). Nothing today combines both into one read of "is my dog okay right now."

---

## 3. Goals and non-goals

### v1 (MVP) goals

1. Detect abnormal motion (seizure-like shaking, excessive pacing, prolonged stillness, limping-like gait) within seconds of onset, using the collar's MPU6050.
2. Detect distress vocalizations (whimpering, crying, atypical barking) separately from routine sound, using a condenser mic for **pattern analysis only** — no raw audio ever leaves the collar.
3. Fuse motion + vocal-pattern signals into one distress confidence score, not two disconnected readings.
4. Give the owner a local beep (short = minor anomaly, long = distress event) plus a website push, within the latency budget in §13.
5. Build a rolling per-dog baseline so alerts fire on deviation from *that dog's* normal, not a generic threshold.
6. Let the owner send a beep cue (default: single beep = "sit", continuous beep = "handshake"; owner-configurable) from the website and see, via the MPU6050, whether the dog's posture matched — improving over repeated trials via reinforcement learning.
7. Let the owner trigger an on-demand wellness check-in: a beep to get the dog's attention, followed by a short dense stream of live motion data so the owner can tell "just resting" from "not responding" in real time.
8. Keep false alerts low enough that owners trust notifications instead of muting them (target in §13).

### Explicit non-goals (this version)

Two-way live audio · speaker / voice playback ("sit" spoken aloud) · GPS / geofencing · escape detection · smell-based activity triggers · heart-rate/pulse health monitoring · native mobile app · multi-dog households · B2B (daycare/vet) dashboards · cloud storage of raw audio · OTA firmware updates · zero-touch device provisioning (DPS)

These are Phase 2 (§9). v1 is a cohesive monitoring product a real owner could pilot — not every pet-tech feature.

---

## 4. Users

**Primary persona:** an owner who works outside the home or travels regularly, leaves the dog alone for extended stretches, and today has no reliable way to know if the dog is okay beyond a camera or hoping for the best.

### Constraint

One collar, one dog, one owner account in this version. Multi-dog households, shared/family access, and B2B (facility) accounts are out of scope for v1 — see §9.

Other validated use cases for the same hardware (not built in v1, listed for context, not commitments): senior/chronic-condition dog monitoring, separation-anxiety training measurement, daycare/boarding/vet value-add, post-surgery recovery thresholds, escape/fall detection.

---

## 5. Rules that do not bend

1. **No raw audio ever leaves the collar.** The mic's only job is comparing the dog's current vocal pattern against its own baseline. Enforced in firmware, not just policy.
2. **No two-way audio, no speaker.** The buzzer is the only output to the dog. Voice-word playback needs new hardware and is Phase 2, not a software toggle on what's built now.
3. **Alerts are relative to the dog's own baseline**, not a fixed global threshold — breed/age/temperament defaults exist only to seed that baseline, not to replace it.
4. **The collar's own beep never depends on connectivity.** On-device detection and the local buzzer must work with zero network.
5. **"Come to owner" has no GPS in v1.** It is verified by posture only, and the website must show this as an approximate match, not a location-confirmed one.
6. Do not add nav/pages beyond §7. Cue vocabulary ships with two defaults (§11) and is owner-configurable — an "approach"-type cue (posture `approached`, e.g. an owner-added "come to owner") must always report `approximate_match`, never a location-confirmed `match`; this doesn't relax for user-defined cues.

---

## 6. Core objects

Conceptual, not a schema.

**Owner** — name, unique email, password (or website-auth provider identity). One collar in v1.

**Dog** — name, breed, age, known temperament — used only to seed default sensitivity thresholds, not to replace the learned baseline.

**Device (collar)** — device ID, firmware version, battery level, last-seen timestamp, bound to exactly one Dog.

**Baseline** — rolling per-dog stats (motion-energy mean/variance, rest-duration pattern, bark-rate pattern), a `learning` flag during cold-start (§14), periodic snapshots for the trend view.

**Event** — timestamp, class (`minor_anomaly` \| `distress` \| `low_battery` \| `sustained_stillness`), confidence, source signals (motion/vocal/both), owner feedback (`accurate` \| `false` \| unset).

**CommandSession** — cue sent (owner-configured cue id, default `sit` \| `handshake`), timestamp, observed posture, match/no-match, feeds the RL reward log.

**Settings** — sensitivity (per anomaly type), quiet hours, alert-rate cap, cue definitions (id, label, beep pattern, expected posture, approximate flag).

---

## 7. Website page map

| Page | Job |
|---|---|
| Dashboard | Current status tile (normal/learning/anomaly), battery/connection, recent flagged events |
| Activity & vocal trends | Charts of motion/vocal pattern vs. the dog's own baseline over days/weeks |
| Event feed | Full history of flagged events, filterable by severity/date, mark accurate/false |
| Command | Send a cue (sit / come to owner), see the latest command-session outcomes |
| Settings | Sensitivity per anomaly type, quiet hours, dog profile (breed/age/temperament) |
| Account | Login, password, device pairing code |

Do not add sub-nav beyond this table without a product decision — matches the discipline in the hardware/software scope below.

---

## 8. Hardware (bill of materials)

### Core — the collar doesn't work without these

| Component | Purpose |
|---|---|
| ESP32 microcontroller | Brain of the device — sensor reads, on-device anomaly logic, drives the buzzer |
| MPU6050 (accel + gyro) ×1 | Motion/posture sensing for anomaly detection and the command-loop reward signal |
| Condenser microphone | Vocal-pattern capture — pattern analysis only, never raw audio off the collar |
| Buzzer | Two roles: local distress alert (short/long beep) and phone-triggered command cue |
| Jumper wires (M-M, M-F) | Connects the MPU6050 + mic to the ESP32 |
| Breadboard | Prototyping before a soldered version |
| 5V 1A power adapter, or battery + USB-C | Untethered wearable demo power |
| Resistor box | Pull-up/pull-down, mic circuit biasing, LED current limiting |

### Strongly recommended

| Component | Purpose |
|---|---|
| Soldering kit | Breadboard wiring won't survive being worn on a moving dog |
| RGB LED / individual LEDs | Demo-friendly status indicator (green = normal, red = anomaly) |
| Toggle switch or push button | Power on/off, or manual "mark this as an event" for calibration |
| 3D printing filament (PLA) | Printed collar housing — matters for how real the product feels |

### Explicitly deferred (Phase 2, not in this BOM)

Audio-output module for voice-word playback (e.g. DFPlayer-style MP3 module + micro speaker, or an ESP32-driven TTS chip) — the buzzer cannot speak words, and this component isn't chosen yet. Heart-rate/pulse sensor. Scent module for smell-based triggers.

---

## 9. MVP (v1) vs. Phase 2

### MVP (v1)

- MPU6050 + mic sensing, on-device posture + vocal-pattern baselining, on-device anomaly detection, local beep (short/long).
- Phone-triggered, owner-configurable command cues (default: single beep = "sit", continuous beep = "handshake") + RL training loop using MPU6050 posture verification as the reward signal.
- Owner-initiated wellness check-in: a beep to the collar plus a short high-rate telemetry burst, so a website click gets a live real-time read of the dog's motion, not just a static status tile.
- General-purpose training dataset (Kaggle-sourced) for initial classification, plus dog-specific baseline data recorded per collar.
- WiFi connectivity to a companion **website**.
- Push notifications for distress events.
- Basic activity + vocal-pattern dashboard and sensitivity settings.

### Phase 2

- Voice-word commands ("sit", "come") replacing beep cues — pending the audio-output hardware decision (§8).
- Smell-based activity triggers.
- Heart-rate/pulse health monitoring with in-app danger alerts.
- Cloud fusion model with continuous retraining from owner feedback (already designed in SYSTEM_DESIGN.md; MVP ships a simpler version).
- Long-term trend view for senior-dog health and post-surgery recovery use cases.
- Multi-dog household support.
- GPS/location — needed for a real "come to owner" verification and escape detection.
- B2B dashboard for daycare/boarding facilities.
- Vet-facing data sharing view.
- Zero-touch device provisioning (DPS), OTA firmware updates.

---

## 10. Functional requirements

IDs are stable. Acceptance criteria are the test.

### Motion & posture (FR-1.x)

**FR-1.1 Motion read**
The MPU6050 feeds a continuous posture/motion-energy read at all times the collar is powered.
**AC:** A failed/unreadable sensor tick is skipped (logged), holding the last known class, rather than crashing the detection loop or fabricating a reading. Vocal-pattern distress detection (FR-2.x) is independent of this sensor, so a motion-read failure doesn't blind the collar entirely.

**FR-1.2 Motion anomaly classes**
Classify into `normal`, `minor_anomaly` (excessive pacing, brief unusual stillness), `distress` (seizure-like shaking, limping-like gait, prolonged stillness beyond baseline).
**AC:** Each class maps to the alert tiers in §12. Classification runs on-device without waiting on connectivity.

### Vocal pattern (FR-2.x)

**FR-2.1 Vocal pattern capture**
Mic feeds a rolling pattern classifier: `normal_bark`, `whine_cry`, `distress_bark`, `silence` — feature vectors only.
**AC:** No raw audio sample is ever written to flash for uplink or stored beyond the immediate classification window. Ambient non-dog noise is filtered, not classified as the dog's own signal.

### Fusion & alerting (FR-3.x)

**FR-3.1 Fusion score**
Combine motion class + vocal class into one distress confidence score.
**AC:** A `distress` motion class with `normal_bark` vocal reading still escalates (motion alone can justify `distress`); same the other way for vocal-only signals.

**FR-3.2 Local beep**
`minor_anomaly` → short beep, logged only. `distress` → long beep + push. `sustained_stillness` beyond the dog's normal rest pattern with no vocal activity → short beep ("check-in prompt") + push after a configurable threshold.
**AC:** Beep fires even with zero connectivity (FR-3 never blocks on network).

### Baseline (FR-4.x)

**FR-4.1 Rolling baseline**
Continuously update per-dog motion-energy and vocal-pattern baseline.
**AC:** Baseline is per-device/per-dog, never shared or averaged across dogs.

**FR-4.2 Cold-start**
First 3–7 days flagged `learning` on the website. Anomaly logging stays on; push notifications suppressed except a hard motion-energy ceiling independent of the unreliable baseline.
**AC:** Website visibly shows "learning your dog" state and does not claim baseline-driven confidence during this window.

### Command loop (FR-5.x)

**FR-5.1 Send a cue**
Owner sends a cue from the website. Ships with two defaults: `sit` (single beep) and `handshake` (continuous beep). Owners can rename either, change its beep pattern, or add new cues from Settings.
**AC:** No voice playback, ever — cues are beep-only regardless of how many an owner configures.

**FR-5.2 Posture verification**
Collar watches MPU6050 posture for a configurable window after the cue and reports match/no-match against that cue's configured expected posture.
**AC:** `sit` verified by stationary posture confirmation. Any cue configured with `approximate: true` (posture-only, no GPS — e.g. an owner-added "come to owner") is verified by posture only and the website labels the result "approximate match," never implies location confirmation. This flag can't be turned off for approach-type cues.

**FR-5.3 RL reward loop**
Match/no-match feeds a reinforcement-learning update so response accuracy is expected to improve over repeated trials.
**AC:** Command-session history (§6 CommandSession) is visible per cue on the Command page.

**FR-5.4 Wellness check-in**
Owner triggers an on-demand check-in from the website (Command page or Dashboard). The collar beeps once (distinct from any trainable cue) to get the dog's attention, then streams motion telemetry at a much higher rate than the normal duty cycle for a short window, so the dashboard shows a dense live read of real motion instead of the usual trickle.
**AC:** Not a trainable cue — no posture match/no-match is scored, no CommandSession is created, and it doesn't feed the RL loop. Purpose is purely "is my dog actually okay right now," distinguishing quiet-but-fine from quiet-and-unresponsive using real accel/gyro data, not a guess.

### Website (FR-6.x)

**FR-6.1 Dashboard**
Status tile, battery/connection, recent events.
**AC:** Reflects `learning` state per FR-4.2.

**FR-6.2 Event feedback**
Owner marks any event `accurate` or `false`.
**AC:** Feedback feeds model retraining (SYSTEM_DESIGN.md §3.6); does not require a page beyond the event feed.

**FR-6.3 Settings**
Per-anomaly-type sensitivity, quiet hours.
**AC:** Sensitivity changes propagate to the collar without a firmware reflash.

---

## 11. Command cue vocabulary

| Cue | Default meaning | Beep pattern |
|---|---|---|
| `sit` | "Sit" | Single beep |
| `handshake` | "Handshake" | Continuous beep |

These are the shipped defaults, not a hard lock — owners can rename them, change the beep pattern, or add their own cues from Settings (§7) to train and reward additional tricks. Every cue definition carries: an id/label, a beep pattern, an expected posture used for match verification, and an `approximate` flag (§10 FR-5.2) that can't be cleared for posture-only "approach" cues. Voice-word cues are still Phase 2, pending the audio-output hardware decision in §8 — configurability of the *beep* vocabulary doesn't pull voice playback forward.

---

## 12. Alert logic

| Signal | Trigger | Beep | Website |
|---|---|---|---|
| Minor anomaly | Low-confidence baseline deviation | Short beep | Logged in activity feed, no push |
| Distress event | High-confidence physical or vocal distress pattern | Long beep | Push notification with the detected pattern |
| Sustained stillness/silence beyond baseline | No motion + no vocal activity longer than the dog's normal rest pattern | Short beep (check-in prompt) | Push after a configurable threshold |
| Low battery | < 15% | — | Push (an unmonitored dog is the exact failure mode this product prevents) |

Thresholds are configurable per dog on the Settings page (breed/age/temperament seed sensible defaults).

---

## 13. Success metrics (pilot validation)

| Metric | Target |
|---|---|
| Distress-event detection recall | ≥ 85% against vet-reviewed/labeled test recordings |
| False positive rate | ≤ 1 false alert per dog per day of normal activity |
| Alert-to-notification latency | < 10 seconds from event to website push |
| Battery life | 18–24 hours continuous monitoring per charge |
| Command-response accuracy | Improves measurably over training trials (baseline vs. post-training comparison) |
| Owner-reported peace of mind | Measurable increase via pre/post pilot survey |

---

## 14. Edge cases

The product must behave calmly here — not new pages.

**Baseline / detection**
- Dog is genuinely new to the collar (day 1) → `learning` state, hard-ceiling-only alerting (FR-4.2).
- The MPU6050 fails/disconnects → motion classification pauses (logged) until it recovers; vocal-pattern distress detection via the mic keeps running independently, so the collar isn't fully blind.
- Ambient household noise (TV, other pets) → vocal classifier must not treat it as the dog's own pattern.

**Alerting**
- Repeated borderline readings inside the post-alert cooldown → logged, not re-pushed.
- Sustained stillness that's actually normal sleep at an unusual hour → baseline should absorb this over the cold-start window, not require a manual override page.

**Command loop**
- Owner sends "come" while out of range of the collar's WiFi → cue queues at the backend, delivered on reconnect, or times out with a clear "collar offline" result — never a false no-match.
- Dog ignores the cue entirely → reported as no-match, not a false positive distress event.
- "Come to owner" posture match without any location signal → website must never claim more confidence than "approximate."

**Connectivity**
- Collar loses WiFi mid-day → local beep still fires; events queue and flush with original timestamps on reconnect (no gap in the website history beyond a visible "offline" marker).

**Battery**
- Battery crosses the low threshold mid-alert → the low-battery push still fires even if it means one extra push above the false-positive budget in §13 (an unmonitored dog outweighs alert fatigue here).

---

## 15. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Local beep < 1s from on-device detection; website push < 10s end-to-end |
| Battery | 18–24h continuous monitoring per charge; duty-cycled sampling required to hit this |
| Privacy | No raw audio ever leaves the collar; only feature vectors/classifications transmitted |
| Data retention | Configurable; default event history 90 days hot, rolled to archive after |
| Owner device | Website must be usable on a phone browser (owner is often out, checking from a phone) |
| Durability | IP rating and chew-resistance are hard requirements for any physical build beyond a demo, not nice-to-haves |
| Locale | English UI, local timezone for timestamps |
| Isolation | One owner account maps to exactly one collar/dog in v1 — no cross-account data leakage |
| Stack | Not locked in this document — see SYSTEM_DESIGN.md |

---

## 16. Success criteria

**Product-level (v1 complete):** An owner can pair one collar to one dog, see it move through a `learning` baseline window into active monitoring, receive a beep + website push within the latency budget when a real physical or vocal distress pattern occurs, mark alerts accurate/false, and send a sit/come beep cue and see whether the dog's posture matched — all without any raw audio leaving the collar or any GPS dependency.

**Pilot metrics:** see §13.

---

## 17. Decisions already locked

Do not reopen in implementation without an explicit product change:

- Product name: **Pawse** (renamed from PetPulse; repo codename was Bandhan). Team: **Origami Treats**.
- Core deliverable this build: **passive distress monitoring** (MPU6050 + mic + local beep). Command-training loop is an added feature, not the primary deliverable.
- Hardware is a single MPU6050 (superseded 2026-09-27 from an earlier two-unit assumption; see SYSTEM_DESIGN.md §5 note) — FR-1.1 and the BOM (§8) reflect this.
- Wellness check-in is a third command-loop feature alongside sit/handshake (§11): owner-initiated, not a trainable cue, no posture match is scored for it.
- No speaker, no raw audio, no two-way live audio, ever — mic is pattern-analysis only.
- Command cue vocabulary is beep-only for v1, owner-configurable, shipping with two defaults: single beep = "sit", continuous beep = "handshake" (replaces the earlier "come to owner" default — superseded 2026-09-27; see SYSTEM_DESIGN.md §5 note). It is framed as a communication channel between owner and dog, not only a training mechanic.
- Voice-word playback, smell-based triggers, and heart-rate/pulse monitoring are Phase 2 — not this build.
- Owner-facing surface is a **website**, not a native mobile app, for this build.
- Data pipeline: real public dog-IMU dataset (Vehkaoja et al. dog movement/behavior sensor dataset, dual collar+harness accelerometer/gyroscope, Mendeley DOI 10.17632/vxhx934tbn, CC BY 4.0 — see SYSTEM_DESIGN.md §12 for how it seeds the on-device classifier) plus per-dog baseline recorded from the actual collar.
- Connectivity is **WiFi**, not BLE, for the primary uplink — BLE range would tie monitoring to "phone near the dog," which defeats the "owner is out of the house" use case.
- "Come to owner" is verified by posture only in v1 — no GPS. This is a known, disclosed limitation, not silently overstated.
- One owner, one dog, one collar in v1. Multi-dog and B2B are Phase 2.

No open product questions for v1. Implementation may choose stack, hosting, and library detail — see SYSTEM_DESIGN.md.
