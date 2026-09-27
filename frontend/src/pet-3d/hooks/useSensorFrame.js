import { useEffect, useMemo, useState } from "react";
import { normalizePetSensorFrame, toSensorSample } from "../adapters/normalizePetSensorFrame.js";
import { DETECTION, EMPTY_SAMPLE } from "../constants.js";

export function useSensorFrame(sensorData, staleAfterMs, onSensorError) {
  const input = useMemo(() => {
    if (sensorData == null) return { frame: null };
    try { return { frame: normalizePetSensorFrame(sensorData) }; }
    catch (error) { return { error }; }
  }, [sensorData]);
  const [state, setState] = useState({ input: null, frame: null, sample: EMPTY_SAMPLE, history: [], stale: true });
  useEffect(() => {
    if (input.error) onSensorError?.(input.error);
  }, [input.error, onSensorError]);
  useEffect(() => {
    setState(previous => {
      if (previous.input === input) return previous;
      if (input.frame && (!previous.frame || input.frame.timestamp >= previous.frame.timestamp)) {
        const sample = toSensorSample(input.frame);
        return { input, frame: input.frame, sample, stale: false,
          history: [...previous.history.filter(s => s.timestamp !== sample.timestamp && sample.timestamp - s.timestamp <= DETECTION.windowMs), sample].slice(-100) };
      }
      return { ...previous, input };
    });
  }, [input]);
  useEffect(() => {
    if (!state.frame || staleAfterMs === 0) return;
    const timer = setTimeout(() => setState(previous => ({ ...previous, stale: true })), staleAfterMs);
    return () => clearTimeout(timer);
  }, [state.frame, staleAfterMs]);
  return { ...state, connected: sensorData != null && !!state.frame && !state.stale, error: input.error };
}
