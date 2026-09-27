export const SENSOR_HZ = 30;
export const EMPTY_SAMPLE = {
  ax: 0,
  ay: 0,
  az: 9.81,
  gx: 0,
  gy: 0,
  gz: 0,
  pitch: 0,
  roll: 0,
  timestamp: 0,
};
export const ORIENTATION = {
  pitchLimit: 45,
  rollLimit: 35,
  smoothing: 12,
  pitchAxis: "x",
  rollAxis: "z",
  pitchSign: -1,
  rollSign: -1,
};
export const DETECTION = {
  windowMs: 1000,
  minSamples: 10,
  walkRms: 0.45,
  runRms: 1.8,
  shakeGyro: 85,
  shakeCrossings: 4,
  intensityScale: 4.5,
};
export const ANIMATION = {
  crossfade: 0.3,
  headBone: "Head",
  neckBone: "Neck",
  clips: { idle: "Idle", walk: "Walk", run: "Run", walking: "Walk", running: "Run", headShake: "Idle" },
};
