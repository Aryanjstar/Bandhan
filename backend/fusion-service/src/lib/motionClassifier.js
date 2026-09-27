// On-device motion classifier (PRD FR-1.x) — turns raw single-MPU6050 accel/gyro
// samples into the exact contract backend/README.md documents for /api/sensor-data
// (motionClass, motionEnergy, stillDurationSec). The real firmware (firmware/collar/
// collar.ino) runs the same logic in C++; keep both in sync if thresholds change.
//
// Hardware note (2026-09-27): the collar carries a single MPU6050, not the dual-IMU
// layout the original PRD assumed — PRD.md/SYSTEM_DESIGN.md are updated to match.
// There's no second unit to average against or fall back to, so there's no
// "degraded" reading concept here; a missing/unreadable sensor is a hard failure
// the caller must handle (firmware skips the tick; it doesn't fabricate a reading).
//
// Threshold rationale (docs/SYSTEM_DESIGN.md §12): seeded from the taxonomy of a
// real public dog-IMU dataset (Vehkaoja et al., Mendeley DOI 10.17632/vxhx934tbn,
// CC BY 4.0, distress proxy via its "body shake" companion set DOI 10.17632/mpph6bmn7g)
// — but that dataset's own paper reports no acceleration-magnitude thresholds, so the
// numbers below are literature-informed engineering defaults, not dataset-derived
// constants. They're deliberately conservative and meant to be superseded by each
// dog's own baseline (lib/fusionLogic.js, cold-start flow) rather than trusted as final.
//
// What this does NOT try to classify: "sustained stillness" is intentionally left to
// the cloud-side fusion (lib/fusionLogic.js), which already compares stillDurationSec
// against the dog's own learned rest pattern — duplicating that baseline-relative
// judgment on-device would just be a second, worse copy of the same rule (PRD §5
// rule 3: alerts are relative to the dog's own baseline, never a fixed threshold).
// Likewise, limping-like gait needs a trained model to detect reliably; this rule-based
// classifier only distinguishes rest / normal motion / shake-pattern (jerk-spike) motion
// — that's a known simplification (docs/SYSTEM_DESIGN.md §12), not an oversight.

const REST_ENERGY_G = 0.15; // dynamic accel below this (gravity already removed) counts as "not moving"
const PACING_ENERGY_G = 0.5; // sustained dynamic accel above this = excessive pacing, not just walking
const PACING_MIN_DURATION_MS = 20_000; // has to hold for a while to be "excessive", not one energetic moment
const JERK_SPIKE_G = 2.5; // a single-sample jump in acceleration magnitude this large = an impulse (a shake, a fall)
const JERK_SPIKE_WINDOW_MS = 1500; // spikes must cluster inside this window to look seizure-like, not be one bump
const JERK_SPIKES_FOR_DISTRESS = 3; // repeated impulses in the window, not a single knock against a door frame

function magnitude({ ax, ay, az }) {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

class MotionClassifier {
  constructor() {
    this.lastMagnitude = null;
    this.stillSinceMs = null;
    this.pacingSinceMs = null;
    this.spikeTimestamps = [];
  }

  // reading: { ax, ay, az, gx, gy, gz } from the single MPU6050 — accel in g, gravity
  // NOT pre-removed (this function removes the resting 1g itself); gyro fields
  // accepted but unused by this rule-based pass (reserved for a future posture/gait
  // classifier, PRD §9 Phase 2).
  update(reading, timestampMs) {
    const mag = magnitude(reading);
    const dynamicEnergy = Math.abs(mag - 1); // ~1g at rest under gravity
    const jerk = this.lastMagnitude == null ? 0 : Math.abs(mag - this.lastMagnitude);
    this.lastMagnitude = mag;

    if (jerk >= JERK_SPIKE_G) this.spikeTimestamps.push(timestampMs);
    this.spikeTimestamps = this.spikeTimestamps.filter((t) => timestampMs - t <= JERK_SPIKE_WINDOW_MS);

    const isMoving = dynamicEnergy >= REST_ENERGY_G;
    this.stillSinceMs = isMoving ? null : this.stillSinceMs ?? timestampMs;

    const isPacing = dynamicEnergy >= PACING_ENERGY_G;
    this.pacingSinceMs = isPacing ? this.pacingSinceMs ?? timestampMs : null;

    const stillDurationSec = this.stillSinceMs == null ? 0 : Math.round((timestampMs - this.stillSinceMs) / 1000);
    const pacingDurationMs = this.pacingSinceMs == null ? 0 : timestampMs - this.pacingSinceMs;

    let motionClass = "normal";
    if (this.spikeTimestamps.length >= JERK_SPIKES_FOR_DISTRESS) {
      motionClass = "distress"; // seizure-like: repeated high-jerk impulses clustered in time
    } else if (pacingDurationMs >= PACING_MIN_DURATION_MS) {
      motionClass = "minor_anomaly"; // excessive pacing
    }

    return {
      motionClass,
      motionEnergy: Number(dynamicEnergy.toFixed(3)),
      stillDurationSec,
    };
  }
}

module.exports = { MotionClassifier, magnitude };
