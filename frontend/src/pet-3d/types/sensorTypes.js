/**
 * @typedef {{x:number, y:number, z:number}} VectorXYZ
 * @typedef {Object} NormalizedPetSensorFrame
 * @property {VectorXYZ} accel Acceleration including gravity, m/s².
 * @property {VectorXYZ} gyro Angular velocity, degrees/second.
 * @property {{pitch:number, roll:number, yaw?:number}} [orientation] Upstream fused angles in degrees; yaw is currently unused.
 * @property {number} timestamp Monotonically increasing source milliseconds (epoch recommended).
 * @property {'idle'|'walk'|'run'|'jump'|'eat'|'drink'|'sniff'|'headShake'} [activity]
 */
export {};
