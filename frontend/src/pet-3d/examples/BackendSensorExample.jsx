import { useEffect, useState } from "react";
import { PetDigitalTwin, normalizePetSensorFrame } from "../index.js";

export default function BackendSensorExample({ endpoint = "/api/pet/sensor" }) {
  const [sensorData, setSensorData] = useState();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let active = true;
    async function poll() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error(`Sensor endpoint returned ${response.status}`);
        const frame = normalizePetSensorFrame(await response.json());
        if (active) { setSensorData(frame); setError(""); }
      } catch (err) {
        if (active && err.name !== "AbortError") setError(err.message);
      } finally {
        // No overlapping requests; use a push transport for sustained high rates.
        if (active) timer = setTimeout(poll, 50);
      }
    }
    setSensorData(undefined);
    poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [endpoint]);
  return <>
    {error && <p role="status">{error}</p>}
    <PetDigitalTwin key={endpoint} sensorData={sensorData} />
  </>;
}
