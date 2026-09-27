import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import DigitalTwinScene from "./DigitalTwinScene.jsx";
import { DOG_MODEL_URL, DOG_RIG_CONFIG } from "./dogConfig.js";
import { normalizeActivityInput } from "./adapters/normalizePetSensorFrame.js";
import { useSensorFrame } from "./hooks/useSensorFrame.js";
import { useSensorCalibration } from "./hooks/useSensorCalibration.js";
import { detectActivity } from "./utils/activityDetection.js";
import "./pet-3d.css";

/** Transport-independent viewer. Send a new sensorData object for each packet. */
const PetDigitalTwin = forwardRef(function PetDigitalTwin({
  sensorData, activity, activityMode = "automatic", playing = true,
  staleAfterMs = 2000, connected: connectionOverride,
  modelUrl = DOG_MODEL_URL, modelConfig = DOG_RIG_CONFIG,
  revision = 0, onComplete, onModelInfo, onSensorError,
  headAction, className = "", style,
}, ref) {
  const sensor = useSensorFrame(sensorData, staleAfterMs, onSensorError);
  const calibration = useSensorCalibration(sensor.sample);
  const detection = useMemo(() => detectActivity(sensor.history), [sensor.history]);
  const requested = activity ?? sensor.frame?.activity ??
    (activityMode === "automatic" ? detection.activity : "idle");
  // Invalid activity props fail closed to Idle; malformed packet activities are rejected by the adapter.
  let selected;
  try { selected = normalizeActivityInput(requested); } catch { selected = "idle"; }
  const [completed, setCompleted] = useState(null);
  // Changing away from a completed jump permits the next jump without a new revision.
  useEffect(() => {
    if (completed && (completed.activity !== selected || completed.revision !== revision)) {
      setCompleted(null);
    }
  }, [completed, selected, revision]);
  const renderedActivity = selected === "jump" && completed ? "idle" : selected;
  const command = useRef({ activity: selected, revision });
  command.current = { activity: selected, revision };
  const finish = useCallback(id => {
    if (command.current.activity !== "jump" || command.current.revision !== id) return;
    setCompleted({ ...command.current });
    onComplete?.(id);
  }, [onComplete]);
  const hasOrientation = !!sensor.frame?.orientation;
  useImperativeHandle(ref, () => ({
    calibrate() {
      if (!hasOrientation || !sensor.connected) return false;
      calibration.calibrate();
      return true;
    },
    resetCalibration: calibration.reset,
    getState: () => ({ calibrated: calibration.calibrated, offsets: { ...calibration.offsets },
      orientation: hasOrientation ? { ...calibration.corrected } : { pitch: 0, roll: 0 },
      activity: renderedActivity, connected: sensor.connected }),
  }));
  return <DigitalTwinScene
    activity={renderedActivity}
    orientation={hasOrientation ? calibration.corrected : { pitch: 0, roll: 0 }}
    playing={playing && (connectionOverride ?? sensor.connected)}
    connected={connectionOverride ?? sensor.connected}
    modelUrl={modelUrl} modelConfig={modelConfig}
    revision={revision} onComplete={finish} onModelInfo={onModelInfo}
    headAction={headAction} className={className} style={style}
  />;
});
export default PetDigitalTwin;
