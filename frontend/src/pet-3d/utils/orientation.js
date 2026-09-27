import { ORIENTATION } from "../constants.js";
import { clamp } from "./smoothing.js";

export function correctOrientation(sample, offsets) {
  return {
    pitch: sample.pitch - offsets.pitch,
    roll: sample.roll - offsets.roll,
  };
}
export function orientationRadians(orientation, config = ORIENTATION) {
  return {
    pitch:
      (clamp(orientation.pitch, -config.pitchLimit, config.pitchLimit) *
        Math.PI) /
      180,
    roll:
      (clamp(orientation.roll, -config.rollLimit, config.rollLimit) * Math.PI) /
      180,
  };
}
