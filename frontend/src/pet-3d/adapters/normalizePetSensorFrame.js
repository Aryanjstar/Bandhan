const BODY_ACTIVITIES = new Set(["idle", "walk", "run", "jump", "eat", "drink", "sniff", "headShake"]);
export function normalizeActivityInput(value) {
  const action = ({ walking: "walk", running: "run" })[value] || value;
  if (!BODY_ACTIVITIES.has(action)) throw new TypeError(`Unsupported activity: ${value}`);
  return action;
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}

/** @returns {import('../types/sensorTypes.js').NormalizedPetSensorFrame} */
export function normalizePetSensorFrame(payload, { gyroUnit = "deg/s" } = {}) {
  if (!payload || typeof payload !== "object") throw new TypeError("Expected a sensor object");
  if (!["deg/s", "rad/s"].includes(gyroUnit)) throw new TypeError("gyroUnit must be deg/s or rad/s");
  const factor = gyroUnit === "rad/s" ? 180 / Math.PI : 1;
  const accel = {}, gyro = {};
  for (const axis of ["x", "y", "z"]) {
    accel[axis] = finite(payload.accel ? payload.accel[axis] : payload[`a${axis}`], `accel.${axis}`);
    gyro[axis] = finite(finite(payload.gyro ? payload.gyro[axis] : payload[`g${axis}`], `gyro.${axis}`) * factor, `gyro.${axis}`);
  }
  const frame = { accel, gyro, timestamp: finite(payload.timestamp ?? Date.now(), "timestamp") };
  const orientation = payload.orientation ?? payload;
  if (orientation.pitch !== undefined || orientation.roll !== undefined || orientation.yaw !== undefined) {
    frame.orientation = {
      pitch: finite(orientation.pitch, "orientation.pitch"),
      roll: finite(orientation.roll, "orientation.roll"),
      ...(orientation.yaw !== undefined ? { yaw: finite(orientation.yaw, "orientation.yaw") } : {}),
    };
  }
  if (payload.activity !== undefined) frame.activity = normalizeActivityInput(payload.activity);
  return frame;
}

/** Convenience helper for six raw values. No orientation estimation is performed. */
export const createSensorFrame = normalizePetSensorFrame;

// Bridge to the existing detector/calibration math without changing its units.
export function toSensorSample(frame) {
  return {
    ax: frame.accel.x, ay: frame.accel.y, az: frame.accel.z,
    gx: frame.gyro.x, gy: frame.gyro.y, gz: frame.gyro.z,
    pitch: frame.orientation?.pitch ?? 0, roll: frame.orientation?.roll ?? 0,
    timestamp: frame.timestamp,
  };
}
