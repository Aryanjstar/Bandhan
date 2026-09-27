import { DETECTION } from "../constants.js";
import { clamp } from "./smoothing.js";

export function detectActivity(samples, config = DETECTION) {
  if (samples.length < config.minSamples)
    return { activity: "idle", intensity: 0, rms: 0, ready: false };
  const means = ["ax", "ay", "az"].map(
    (key) => samples.reduce((sum, s) => sum + s[key], 0) / samples.length,
  );
  const variance =
    samples.reduce(
      (sum, s) =>
        sum +
        ["ax", "ay", "az"].reduce(
          (v, key, i) => v + (s[key] - means[i]) ** 2,
          0,
        ),
      0,
    ) / samples.length;
  const rms = Math.sqrt(variance);
  // Ignore the dead zone so noise around zero does not count as a head shake.
  let sign = 0;
  let crossings = 0;
  for (const s of samples) {
    if (Math.abs(s.gz) < config.shakeGyro) continue;
    const next = Math.sign(s.gz);
    if (sign && next !== sign) crossings++;
    sign = next;
  }
  const shake = crossings >= config.shakeCrossings;
  return {
    activity: shake
      ? "headShake"
      : rms >= config.runRms
        ? "running"
        : rms >= config.walkRms
          ? "walking"
          : "idle",
    intensity: Math.round(
      clamp(
        Math.max(rms / config.intensityScale, shake ? 0.65 : 0) * 100,
        0,
        100,
      ),
    ),
    rms,
    ready: true,
  };
}
