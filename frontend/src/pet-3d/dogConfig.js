// Inspected against the bundled Quaternius Shiba Inu. GLTFLoader removes dots
// from bone names (e.g. BackLeg.L -> BackLegL); use loaded names here.
export const DOG_MODEL_URL = "/models/dog/dog.glb";
export const DOG_ANIMATIONS = {
  idle: "Idle",
  walk: "Walk",
  run: "Gallop",
  jump: "Jump_ToIdle",
  eat: "Eating",
  drink: null,
  scratch: null,
  sniff: null,
  headShake: null,
};
export const DOG_RIG_CONFIG = {
  name: "Quaternius Shiba Inu",
  scale: 0.62,
  position: [0, 0.02, -0.25],
  crossfade: 0.3,
  clips: DOG_ANIMATIONS,
  headBone: "Head",
  neckBone: "Neck1",
  sensorBone: "Neck1",
  bones: {
    body: ["Body"],
    spine: ["Torso3"],
    neck: ["Neck1"],
    neckTip: ["Neck3"],
    head: ["Head"],
    rearHip: ["BackLegL"],
    rearKnee: ["BackUpperLegL"],
    rearAnkle: ["BackLowerLegL"],
    frontLeft: ["FrontUpperLegL"],
    frontRight: ["FrontUpperLegR"],
    rearLeft: ["BackLegL"],
    rearRight: ["BackLegR"],
  },
  orientation: {
    space: "model",
    pitchAxis: "x",
    rollAxis: "z",
    pitchSign: -1,
    rollSign: -1,
    pitchLimit: 45,
    rollLimit: 35,
    smoothing: 12,
  },
  // Procedural behaviors can use a held, sampled native pose as their base.
  poseBases: {
    drink: { clip: "Eating", time: 1.2 },
    sniff: { clip: "Eating", time: 0.6 },
  },
};
export const ACTION_LABELS = {
  idle: "Idle",
  walk: "Walking",
  run: "Running",
  jump: "Jumping",
  eat: "Eating",
  drink: "Drinking",
  scratch: "Scratching",
  sniff: "Sniffing",
  headShake: "Head shake",
  tiltLeft: "Head Tilt Left",
  tiltRight: "Head Tilt Right",
  lookUp: "Look Up",
  lookDown: "Look Down",
};
export const HEAD_ACTIONS = [
  "tiltLeft",
  "tiltRight",
  "lookUp",
  "lookDown",
  "headShake",
];
export const BODY_ACTIONS = [
  "idle",
  "walk",
  "run",
  "jump",
  "eat",
  "drink",
  "scratch",
  "sniff",
];
export const normalizeActivity = (value) =>
  ({ walking: "walk", running: "run" })[value] || value;
