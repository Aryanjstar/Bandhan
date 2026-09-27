import { useMemo } from "react";
import { PetDigitalTwin, createSensorFrame } from "../index.js";

export default function ExternalDataExample({ ax = 0, ay = 0, az = 9.81,
  gx = 0, gy = 0, gz = 0, pitch, roll, timestamp, activity = "idle" }) {
  const sensorData = useMemo(() => createSensorFrame({
    ax, ay, az, gx, gy, gz, pitch, roll, timestamp,
  }), [ax, ay, az, gx, gy, gz, pitch, roll, timestamp]);
  return <PetDigitalTwin sensorData={sensorData} activity={activity} />;
}
