import { useState } from "react";
import { correctOrientation } from "../utils/orientation.js";
export function useSensorCalibration(sample) {
  const [offsets, setOffsets] = useState({ pitch: 0, roll: 0 });
  const [calibrated, setCalibrated] = useState(false);
  const reset = () => {
    setOffsets({ pitch: 0, roll: 0 });
    setCalibrated(false);
  };
  return {
    corrected: correctOrientation(sample, offsets),
    offsets,
    calibrated,
    calibrate: () => {
      setOffsets({ pitch: sample.pitch, roll: sample.roll });
      setCalibrated(true);
    },
    reset,
  };
}
